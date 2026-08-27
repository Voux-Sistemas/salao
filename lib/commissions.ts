import 'server-only'
import { sql } from '@/lib/db'
import type { Cents } from '@/lib/money'

/**
 * COMISSÕES.
 *
 * A regra é uma percentagem, e a precedência vai do mais específico ao
 * mais genérico: profissional + serviço → profissional → serviço → casa.
 * Quem decide isso é a base de dados (effective_commission_percent);
 * aqui só se escreve a regra e se paga o que já foi gerado.
 *
 * As entradas nascem NO FECHO da comanda, com a percentagem congelada.
 * Mudar a regra amanhã não reescreve o que já foi calculado — e por isso
 * nada aqui recalcula nada.
 */

export type RuleScope = 'staff_service' | 'staff' | 'service' | 'house'

export type CommissionRule = {
  id: string
  staff_id: string | null
  service_id: string | null
  staff_name: string | null
  service_name: string | null
  percent: string
}

export function scopeOf(rule: {
  staff_id: string | null
  service_id: string | null
}): RuleScope {
  if (rule.staff_id && rule.service_id) return 'staff_service'
  if (rule.staff_id) return 'staff'
  if (rule.service_id) return 'service'
  return 'house'
}

export const SCOPE_LABEL: Record<RuleScope, string> = {
  staff_service: 'Profissional + serviço',
  staff: 'Profissional',
  service: 'Serviço',
  house: 'Casa',
}

/** Ordenadas como a precedência as lê: da mais específica à da casa. */
export async function listRules(orgId: string): Promise<CommissionRule[]> {
  return sql<CommissionRule[]>`
    select r.id, r.staff_id, r.service_id, r.percent::text as percent,
           s.name as staff_name, sv.name as service_name
      from commission_rule r
      left join staff s on s.id = r.staff_id
      left join service sv on sv.id = r.service_id
     where r.org_id = ${orgId}
     order by (r.staff_id is not null and r.service_id is not null) desc,
              (r.staff_id is not null) desc,
              (r.service_id is not null) desc,
              s.name nulls first, sv.name nulls first
  `
}

/** Quem e o quê se pode escolher ao escrever uma regra. */
export async function ruleOptions(orgId: string): Promise<{
  staff: { id: string; name: string }[]
  services: { id: string; name: string }[]
}> {
  const [staff, services] = await Promise.all([
    sql<{ id: string; name: string }[]>`
      select id, name from staff
       where org_id = ${orgId} and is_active
       order by name
    `,
    sql<{ id: string; name: string }[]>`
      select sv.id, sv.name
        from service sv
        left join service_category cat on cat.id = sv.category_id
       where sv.org_id = ${orgId} and sv.is_active
       order by cat.sort_order nulls last, cat.name nulls last, sv.name
    `,
  ])
  return { staff, services }
}

export type RuleResult = { ok: true } | { ok: false; reason: 'invalid' }

/**
 * Uma regra por combinação: gravar a mesma outra vez é mudar a
 * percentagem, não criar uma segunda.
 */
export async function saveRule(
  orgId: string,
  input: { staffId: string | null; serviceId: string | null; percent: number },
): Promise<RuleResult> {
  if (!Number.isFinite(input.percent)) return { ok: false, reason: 'invalid' }
  if (input.percent < 0 || input.percent > 100) {
    return { ok: false, reason: 'invalid' }
  }

  await sql`
    insert into commission_rule (org_id, staff_id, service_id, percent)
    values (${orgId}, ${input.staffId}, ${input.serviceId}, ${input.percent})
    on conflict (org_id, staff_id, service_id)
      do update set percent = excluded.percent
  `
  return { ok: true }
}

export async function removeRule(orgId: string, id: string): Promise<void> {
  await sql`
    delete from commission_rule where id = ${id} and org_id = ${orgId}
  `
}

// ---------------------------------------------------------------------
// Pagar
// ---------------------------------------------------------------------

export type PendingEntry = {
  id: string
  generated_at: Date
  unit_name: string
  client_name: string
  service_name: string
  item_price_cents: number
  discount_share_cents: number
  base_cents: number
  percent: string
  amount_cents: number
  appointment_id: string
  unit_slug: string
}

export async function pendingEntries(
  orgId: string,
  staffId: string,
): Promise<PendingEntry[]> {
  return sql<PendingEntry[]>`
    select e.id, e.generated_at, u.name as unit_name, u.slug as unit_slug,
           c.name as client_name, i.service_name,
           e.item_price_cents, e.discount_share_cents, e.base_cents,
           e.percent::text as percent, e.amount_cents, e.appointment_id
      from commission_entry e
      join unit u on u.id = e.unit_id
      join appointment a on a.id = e.appointment_id
      join client c on c.id = a.client_id
      join appointment_item i on i.id = e.appointment_item_id
     where e.org_id = ${orgId} and e.staff_id = ${staffId}
       and e.status = 'pending'
     order by e.generated_at
  `
}

export type PayResult =
  | { ok: true; payoutId: string; totalCents: Cents; entries: number }
  | {
      ok: false
      reason: 'changed' | 'nothing'
      totalCents?: Cents
      entries?: number
    }

/**
 * Pagar em lote, por profissional — e com uma verificação: se o total
 * mudou entre o que se mostrou e o que se vai pagar (fechou-se outra
 * comanda entretanto), NÃO se paga. Volta-se a mostrar a conta nova.
 */
export async function payCommissions(input: {
  orgId: string
  staffId: string
  expectedCents: Cents
  expectedEntries: number
  note: string | null
  byStaffId: string
}): Promise<PayResult> {
  return sql.begin(async (tx) => {
    const rows = await tx<{ id: string; amount_cents: number }[]>`
      select id, amount_cents from commission_entry
       where org_id = ${input.orgId}
         and staff_id = ${input.staffId}
         and status = 'pending'
       order by generated_at
         for update
    `

    const total = rows.reduce((sum, row) => sum + row.amount_cents, 0)
    if (rows.length === 0) {
      return { ok: false, reason: 'nothing' } as PayResult
    }
    if (total !== input.expectedCents || rows.length !== input.expectedEntries) {
      return {
        ok: false,
        reason: 'changed',
        totalCents: total,
        entries: rows.length,
      } as PayResult
    }

    const created = await tx<{ id: string }[]>`
      insert into commission_payout
        (org_id, staff_id, total_cents, entry_count, note, paid_by_staff_id)
      values
        (${input.orgId}, ${input.staffId}, ${total}, ${rows.length},
         ${input.note}, ${input.byStaffId})
      returning id
    `
    const payout = created[0]
    if (!payout) return { ok: false, reason: 'nothing' } as PayResult

    await tx`
      update commission_entry
         set status = 'paid', payout_id = ${payout.id}, paid_at = now()
       where id = any(${rows.map((row) => row.id)}::uuid[])
    `

    return {
      ok: true,
      payoutId: payout.id,
      totalCents: total,
      entries: rows.length,
    } as PayResult
  })
}

export type Payout = {
  id: string
  staff_name: string
  total_cents: number
  entry_count: number
  note: string | null
  paid_at: Date
  paid_by: string | null
}

export async function recentPayouts(
  orgId: string,
  limit = 12,
): Promise<Payout[]> {
  return sql<Payout[]>`
    select p.id, s.name as staff_name, p.total_cents, p.entry_count,
           p.note, p.paid_at, b.name as paid_by
      from commission_payout p
      join staff s on s.id = p.staff_id
      left join staff b on b.id = p.paid_by_staff_id
     where p.org_id = ${orgId}
     order by p.paid_at desc
     limit ${limit}
  `
}
