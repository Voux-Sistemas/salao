import 'server-only'
import { sql } from '@/lib/db'
import type { Cents } from '@/lib/money'
import type { IsoDay } from '@/lib/time'

/**
 * A CAIXA, por loja e por dia.
 *
 * Abre-se com um valor inicial, recebe movimentos — o dinheiro vivo
 * entra por si quando a comanda fecha; reforços e sangrias são à mão —
 * e fecha-se CONTANDO A GAVETA.
 *
 * O sistema mostra o esperado (abertura + entradas − sangrias), guarda o
 * contado e regista a diferença. Não esconde a diferença nem a corrige:
 * a diferença é informação.
 */

export type CashKind = 'sale' | 'reinforcement' | 'withdrawal' | 'adjustment'

export const KIND_LABEL: Record<CashKind, string> = {
  sale: 'Venda',
  reinforcement: 'Reforço',
  withdrawal: 'Sangria',
  adjustment: 'Acerto',
}

export type CashSession = {
  id: string
  unit_id: string
  business_date: IsoDay
  status: 'open' | 'closed'
  opening_cents: number
  opened_at: Date
  opened_by: string | null
  expected_cents: number | null
  counted_cents: number | null
  difference_cents: number | null
  closing_note: string | null
  closed_at: Date | null
  closed_by: string | null
}

export type CashMovement = {
  id: string
  kind: CashKind
  amount_cents: number
  note: string | null
  created_at: Date
  by_staff: string | null
  appointment_id: string | null
  client_name: string | null
}

/**
 * As mesmas colunas em todas as leituras. É uma função, e não uma
 * constante, porque a ligação só pode ser tocada dentro de um pedido.
 */
function sessionColumns() {
  return sql`
    cs.id, cs.unit_id,
    to_char(cs.business_date, 'YYYY-MM-DD') as business_date,
    cs.status, cs.opening_cents, cs.opened_at,
    o.name as opened_by,
    cs.expected_cents, cs.counted_cents, cs.difference_cents,
    cs.closing_note, cs.closed_at, c.name as closed_by
  `
}

/** Só há uma caixa aberta por loja de cada vez. */
export async function openSession(unitId: string): Promise<CashSession | null> {
  const rows = await sql<CashSession[]>`
    select ${sessionColumns()}
      from cash_session cs
      left join staff o on o.id = cs.opened_by_staff_id
      left join staff c on c.id = cs.closed_by_staff_id
     where cs.unit_id = ${unitId} and cs.status = 'open'
     limit 1
  `
  return rows[0] ?? null
}

export async function recentSessions(
  unitId: string,
  limit = 14,
): Promise<CashSession[]> {
  return sql<CashSession[]>`
    select ${sessionColumns()}
      from cash_session cs
      left join staff o on o.id = cs.opened_by_staff_id
      left join staff c on c.id = cs.closed_by_staff_id
     where cs.unit_id = ${unitId} and cs.status = 'closed'
     order by cs.business_date desc
     limit ${limit}
  `
}

export async function loadMovements(
  sessionId: string,
): Promise<CashMovement[]> {
  return sql<CashMovement[]>`
    select m.id, m.kind, m.amount_cents, m.note, m.created_at,
           s.name as by_staff, m.appointment_id, cl.name as client_name
      from cash_movement m
      left join staff s on s.id = m.by_staff_id
      left join appointment a on a.id = m.appointment_id
      left join client cl on cl.id = a.client_id
     where m.cash_session_id = ${sessionId}
     order by m.created_at
  `
}

/** Esperado = abertura + entradas − sangrias. */
export function expectedCents(
  session: { opening_cents: number },
  movements: readonly { amount_cents: number }[],
): Cents {
  return (
    session.opening_cents + movements.reduce((sum, m) => sum + m.amount_cents, 0)
  )
}

export type CashResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: 'already_open' | 'day_closed' | 'not_found' | 'closed' | 'invalid' }

/**
 * Abrir. Um dia tem uma caixa: se a de hoje já foi fechada, não se
 * reabre — o que aparecer depois é reforço, sangria ou acerto de amanhã.
 */
export async function openCash(input: {
  unitId: string
  businessDate: IsoDay
  openingCents: Cents
  byStaffId: string
}): Promise<CashResult> {
  if (input.openingCents < 0) return { ok: false, reason: 'invalid' }

  const existing = await sql<{ id: string; status: string }[]>`
    select id, status from cash_session
     where unit_id = ${input.unitId}
       and (status = 'open' or business_date = ${input.businessDate}::date)
     order by (status = 'open') desc
     limit 1
  `
  const found = existing[0]
  if (found) {
    return {
      ok: false,
      reason: found.status === 'open' ? 'already_open' : 'day_closed',
    }
  }

  /*
   * O SELECT lá de cima e este INSERT não são um gesto só: um duplo
   * toque no botão de abrir passa duas vezes pela verificação e a
   * segunda escrita bate no índice único. Esse embate é a resposta
   * certa — só que dita por palavras, não com um ecrã rebentado.
   */
  try {
    const rows = await sql<{ id: string }[]>`
      insert into cash_session
        (unit_id, business_date, opening_cents, opened_by_staff_id)
      values
        (${input.unitId}, ${input.businessDate}::date, ${input.openingCents},
         ${input.byStaffId})
      returning id
    `
    const session = rows[0]
    if (!session) return { ok: false, reason: 'not_found' }
    return { ok: true, sessionId: session.id }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      String((error as { code: unknown }).code) === '23505'
    ) {
      return { ok: false, reason: 'already_open' }
    }
    throw error
  }
}

/**
 * Reforço entra positivo, sangria sai negativa. As vendas não passam por
 * aqui: entram sozinhas quando a comanda fecha.
 */
export async function addMovement(input: {
  unitId: string
  kind: 'reinforcement' | 'withdrawal' | 'adjustment'
  cents: Cents
  note: string | null
  byStaffId: string
}): Promise<CashResult> {
  if (input.cents <= 0 && input.kind !== 'adjustment') {
    return { ok: false, reason: 'invalid' }
  }
  if (input.cents === 0) return { ok: false, reason: 'invalid' }

  const session = await openSession(input.unitId)
  if (!session) return { ok: false, reason: 'not_found' }

  const amount =
    input.kind === 'withdrawal' ? -Math.abs(input.cents) : Math.abs(input.cents)

  await sql`
    insert into cash_movement
      (cash_session_id, kind, amount_cents, note, by_staff_id)
    values
      (${session.id}, ${input.kind}, ${amount}, ${input.note}, ${input.byStaffId})
  `
  return { ok: true, sessionId: session.id }
}

/**
 * Fechar é contar a gaveta. Guarda-se o que se contou e a diferença
 * fica registada — para bem ou para mal.
 */
export async function closeCash(input: {
  unitId: string
  countedCents: Cents
  note: string | null
  byStaffId: string
}): Promise<CashResult> {
  if (input.countedCents < 0) return { ok: false, reason: 'invalid' }

  return sql.begin(async (tx) => {
    const rows = await tx<{ id: string; opening_cents: number }[]>`
      select id, opening_cents from cash_session
       where unit_id = ${input.unitId} and status = 'open'
         for update
    `
    const session = rows[0]
    if (!session) return { ok: false, reason: 'not_found' } as CashResult

    const sums = await tx<{ total: number }[]>`
      select coalesce(sum(amount_cents), 0)::int as total
        from cash_movement where cash_session_id = ${session.id}
    `
    const expected = session.opening_cents + (sums[0]?.total ?? 0)

    await tx`
      update cash_session
         set status = 'closed',
             expected_cents = ${expected},
             counted_cents = ${input.countedCents},
             difference_cents = ${input.countedCents - expected},
             closing_note = ${input.note},
             closed_at = now(),
             closed_by_staff_id = ${input.byStaffId}
       where id = ${session.id}
    `
    return { ok: true, sessionId: session.id } as CashResult
  })
}
