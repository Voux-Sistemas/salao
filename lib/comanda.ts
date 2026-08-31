import 'server-only'
import { sql } from '@/lib/db'
import type { Cents } from '@/lib/money'
import type { PaymentMethod } from '@/lib/status'

/**
 * NÃO HÁ COMANDA SEPARADA — A COMANDA É A MARCAÇÃO. Os itens já lá
 * estão, com profissional e preço congelados.
 *
 * Fechar acrescenta três coisas: o desconto (no máximo um, com motivo e
 * autor), os pagamentos (uma linha por método) e o fecho — que trava
 * novos pagamentos e dá a conta por arrumada.
 *
 * O desconto não mexe no preço congelado dos itens: é abatido por cima,
 * e o que se recebeu fica registado pagamento a pagamento.
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
 * meia em dinheiro. É por aqui que se sabe quanto entrou e como.
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
  | { ok: true }
  | {
      ok: false
      reason: 'not_found' | 'closed' | 'unpaid' | 'cancelled'
    }

type ItemRow = { price_cents: number }

/**
 * Fechar trava novos pagamentos e descontos: a partir daqui a conta
 * desta cliente é história. Tudo numa transação.
 *
 * FAZIA MAIS DUAS COISAS, E JÁ NÃO FAZ NENHUMA.
 *
 * Lançava o dinheiro vivo na gaveta, e recusava o fecho se a gaveta do
 * dia não estivesse aberta — a casa não usa gaveta, e o que restava era
 * um fecho barrado por um registo que ninguém abria.
 *
 * E gerava as comissões item a item, com a percentagem congelada. A
 * casa também não as usa: quem paga a equipa faz essa conta fora daqui.
 * Sem o ecrã que as mostrava e as pagava, continuar a gerá-las era
 * escrever linhas que ninguém voltava a ler.
 *
 * O que se pagou e como está tudo nos pagamentos, que ficam.
 */
export async function closeComanda(input: {
  appointmentId: string
  byStaffId: string
}): Promise<CloseResult> {
  return sql.begin(async (tx) => {
    const rows = await tx<
      {
        id: string
        status: string
        closed_at: Date | null
        discount_cents: number
      }[]
    >`
      select a.id, a.status, a.closed_at, a.discount_cents
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
      select price_cents
        from appointment_item
       where appointment_id = ${appointment.id}
    `

    const payments = await tx<{ amount_cents: number }[]>`
      select amount_cents from payment
       where appointment_id = ${appointment.id}
    `

    const itemsCents = items.reduce((sum, i) => sum + i.price_cents, 0)
    const due = Math.max(0, itemsCents - appointment.discount_cents)
    const paid = payments.reduce((sum, p) => sum + p.amount_cents, 0)
    if (paid < due) return { ok: false, reason: 'unpaid' } as CloseResult

    await tx`
      update appointment
         set closed_at = now(), closed_by_staff_id = ${input.byStaffId}
       where id = ${appointment.id}
    `

    return { ok: true } as CloseResult
  })
}
