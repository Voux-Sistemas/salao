import 'server-only'
import { sql } from '@/lib/db'
import { distributeProportionally, type Cents } from '@/lib/money'
import type { PaymentMethod } from '@/lib/status'

/**
 * NÃO HÁ COMANDA SEPARADA — A COMANDA É A MARCAÇÃO. Os itens já lá
 * estão, com profissional e preço congelados.
 *
 * Fechar acrescenta três coisas: o desconto (no máximo um, com motivo e
 * autor), os pagamentos (uma linha por método) e o fecho — que trava
 * novos pagamentos e é o GATILHO DAS COMISSÕES.
 *
 * O desconto não mexe no preço congelado dos itens: é abatido por cima
 * e, para a comissão, RATEADO PROPORCIONALMENTE pelos itens sem perder
 * cêntimos.
 */

export type ComandaTotals = {
  itemsCents: Cents
  discountCents: Cents
  totalCents: Cents
  paidCents: Cents
  dueCents: Cents
}

export type ComandaPayment = {
  id: string
  method: PaymentMethod
  amount_cents: number
  note: string | null
  received_at: Date
  received_by: string | null
}

export async function loadPayments(
  appointmentId: string,
): Promise<ComandaPayment[]> {
  return sql<ComandaPayment[]>`
    select p.id, p.method, p.amount_cents, p.note, p.received_at,
           s.name as received_by
      from payment p
      left join staff s on s.id = p.received_by_staff_id
     where p.appointment_id = ${appointmentId}
     order by p.received_at
  `
}

export function totals(
  itemsCents: Cents,
  discountCents: Cents,
  payments: readonly { amount_cents: number }[],
): ComandaTotals {
  const total = Math.max(0, itemsCents - discountCents)
  const paid = payments.reduce((sum, p) => sum + p.amount_cents, 0)
  return {
    itemsCents,
    discountCents,
    totalCents: total,
    paidCents: paid,
    dueCents: total - paid,
  }
}

// ---------------------------------------------------------------------
// Desconto
// ---------------------------------------------------------------------

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'closed' | 'invalid' }

/** No máximo um desconto por marcação, com motivo e autor. */
export async function setDiscount(input: {
  appointmentId: string
  cents: Cents
  reason: string
  byStaffId: string
}): Promise<WriteResult> {
  if (input.cents < 0) return { ok: false, reason: 'invalid' }
  if (input.cents > 0 && !input.reason.trim()) {
    return { ok: false, reason: 'invalid' }
  }

  return sql.begin(async (tx) => {
    const rows = await tx<{ closed_at: Date | null; items_cents: number }[]>`
      select a.closed_at,
             coalesce((
               select sum(i.price_cents) from appointment_item i
                where i.appointment_id = a.id
             ), 0)::int as items_cents
        from appointment a
       where a.id = ${input.appointmentId}
         for update
    `
    const appointment = rows[0]
    if (!appointment) return { ok: false, reason: 'not_found' } as WriteResult
    if (appointment.closed_at) return { ok: false, reason: 'closed' } as WriteResult
    if (input.cents > appointment.items_cents) {
      return { ok: false, reason: 'invalid' } as WriteResult
    }

    await tx`
      update appointment
         set discount_cents = ${input.cents},
             discount_reason = ${input.cents > 0 ? input.reason.trim() : null},
             discount_by_staff_id = ${input.cents > 0 ? input.byStaffId : null},
             discount_at = ${input.cents > 0 ? new Date() : null}
       where id = ${input.appointmentId}
    `
    return { ok: true } as WriteResult
  })
}

// ---------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------

/**
 * Uma linha por método, porque uma visita pode ser meia em cartão e
 * meia em dinheiro. O dinheiro entra na caixa por si — mas só quando a
 * comanda fecha, que é quando o dia se acerta.
 */
export async function addPayment(input: {
  appointmentId: string
  method: PaymentMethod
  cents: Cents
  note?: string | null
  byStaffId: string
}): Promise<WriteResult> {
  if (input.cents <= 0) return { ok: false, reason: 'invalid' }

  return sql.begin(async (tx) => {
    const rows = await tx<{ unit_id: string; closed_at: Date | null }[]>`
      select unit_id, closed_at from appointment
       where id = ${input.appointmentId}
         for update
    `
    const appointment = rows[0]
    if (!appointment) return { ok: false, reason: 'not_found' } as WriteResult
    if (appointment.closed_at) return { ok: false, reason: 'closed' } as WriteResult

    await tx`
      insert into payment
        (appointment_id, unit_id, method, amount_cents, note, received_by_staff_id)
      values
        (${input.appointmentId}, ${appointment.unit_id}, ${input.method},
         ${input.cents}, ${input.note ?? null}, ${input.byStaffId})
    `
    return { ok: true } as WriteResult
  })
}

export async function removePayment(input: {
  paymentId: string
  appointmentId: string
}): Promise<WriteResult> {
  return sql.begin(async (tx) => {
    const rows = await tx<{ closed_at: Date | null }[]>`
      select closed_at from appointment
       where id = ${input.appointmentId}
         for update
    `
    const appointment = rows[0]
    if (!appointment) return { ok: false, reason: 'not_found' } as WriteResult
    if (appointment.closed_at) return { ok: false, reason: 'closed' } as WriteResult

    await tx`
      delete from payment
       where id = ${input.paymentId} and appointment_id = ${input.appointmentId}
    `
    return { ok: true } as WriteResult
  })
}

// ---------------------------------------------------------------------
// Fecho
// ---------------------------------------------------------------------

export type CloseResult =
  | { ok: true; commissionCents: Cents }
  | {
      ok: false
      reason: 'not_found' | 'closed' | 'unpaid' | 'cancelled'
    }

type ItemRow = {
  id: string
  staff_id: string
  service_id: string
  price_cents: number
}

/**
 * Fechar trava novos pagamentos e descontos e gera as comissões item a
 * item. Tudo numa transação: ou é tudo ou não é nada.
 *
 * Houve aqui um terceiro trabalho: lançar o dinheiro vivo na gaveta, e
 * recusar o fecho se a gaveta do dia não estivesse aberta. A casa não
 * usa gaveta — conta o dinheiro à maneira dela — e o que restava era um
 * fecho que barrava por causa de um registo que ninguém abria. A
 * comanda continua a dizer quanto foi em dinheiro: está nos pagamentos.
 */
export async function closeComanda(input: {
  appointmentId: string
  byStaffId: string
}): Promise<CloseResult> {
  return sql.begin(async (tx) => {
    const rows = await tx<
      {
        id: string
        org_id: string
        unit_id: string
        status: string
        closed_at: Date | null
        discount_cents: number
      }[]
    >`
      select a.id, a.org_id, a.unit_id, a.status, a.closed_at, a.discount_cents
        from appointment a
       where a.id = ${input.appointmentId}
         for update
    `
    const appointment = rows[0]
    if (!appointment) return { ok: false, reason: 'not_found' } as CloseResult
    if (appointment.closed_at) return { ok: false, reason: 'closed' } as CloseResult
    if (
      appointment.status === 'cancelled_by_client' ||
      appointment.status === 'cancelled_by_salon' ||
      appointment.status === 'no_show'
    ) {
      return { ok: false, reason: 'cancelled' } as CloseResult
    }

    const items = await tx<ItemRow[]>`
      select id, staff_id, service_id, price_cents
        from appointment_item
       where appointment_id = ${appointment.id}
       order by sort_order, starts_at
    `

    const payments = await tx<{ id: string; method: string; amount_cents: number }[]>`
      select id, method, amount_cents from payment
       where appointment_id = ${appointment.id}
    `

    const itemsCents = items.reduce((sum, i) => sum + i.price_cents, 0)
    const due = Math.max(0, itemsCents - appointment.discount_cents)
    const paid = payments.reduce((sum, p) => sum + p.amount_cents, 0)
    if (paid < due) return { ok: false, reason: 'unpaid' } as CloseResult

    // --- comissões --------------------------------------------------
    // O desconto rateia-se proporcionalmente pelos itens ANTES de
    // aplicar a percentagem, e o rateio não perde cêntimos.
    const shares = distributeProportionally(
      Math.min(appointment.discount_cents, itemsCents),
      items.map((i) => i.price_cents),
    )

    let commissionTotal = 0
    for (const [index, item] of items.entries()) {
      const percentRows = await tx<{ percent: string | null }[]>`
        select effective_commission_percent(
          ${appointment.org_id}::uuid, ${item.staff_id}::uuid, ${item.service_id}::uuid
        ) as percent
      `
      const raw = percentRows[0]?.percent
      // Sem regra nenhuma não se gera entrada — zero não é o mesmo que
      // "a casa não definiu".
      if (raw === null || raw === undefined) continue

      const percent = Number(raw)
      const share = shares[index] ?? 0
      const base = Math.max(0, item.price_cents - share)
      // Arredonda-se ao cêntimo, meia unidade para cima.
      const amount = Math.round((base * percent) / 100)
      commissionTotal += amount

      await tx`
        insert into commission_entry
          (org_id, unit_id, appointment_id, appointment_item_id, staff_id,
           item_price_cents, discount_share_cents, base_cents, percent, amount_cents)
        values
          (${appointment.org_id}, ${appointment.unit_id}, ${appointment.id},
           ${item.id}, ${item.staff_id},
           ${item.price_cents}, ${share}, ${base}, ${percent}, ${amount})
        on conflict (appointment_item_id) do nothing
      `
    }

    await tx`
      update appointment
         set closed_at = now(), closed_by_staff_id = ${input.byStaffId}
       where id = ${appointment.id}
    `

    return { ok: true, commissionCents: commissionTotal } as CloseResult
  })
}
