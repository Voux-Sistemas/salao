'use server'

import { revalidatePath } from 'next/cache'
import { canSeeUnit, requireManagement } from '@/lib/auth/actor'
import { getAppointment } from '@/lib/booking'
import {
  addPayment,
  closeComanda,
  removePayment,
  setDiscount,
} from '@/lib/comanda'
import { inputToCents } from '@/lib/money'
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/status'

export type ComandaState = { error: string | null; done?: string | null }

/** A comanda é a marcação: só mexe nela quem pode ver caixa. */
async function reach(appointmentId: string) {
  const actor = await requireManagement()
  const appointment = await getAppointment(appointmentId)
  if (
    !appointment ||
    appointment.org_id !== actor.orgId ||
    !canSeeUnit(actor, appointment.unit_id)
  ) {
    return null
  }
  return { actor, appointment }
}

const NOT_FOUND: ComandaState = { error: 'Essa comanda não existe.' }
const CLOSED: ComandaState = { error: 'A comanda já está fechada.' }

function touch(unitSlug: string, appointmentId: string) {
  revalidatePath(`/agenda/${unitSlug}/comanda/${appointmentId}`)
  revalidatePath(`/agenda/${unitSlug}`)
}

export async function setDiscountAction(
  _previous: ComandaState,
  form: FormData,
): Promise<ComandaState> {
  const appointmentId = String(form.get('appointment') ?? '')
  const found = await reach(appointmentId)
  if (!found) return NOT_FOUND

  const raw = String(form.get('amount') ?? '').trim()
  const cents = raw === '' ? 0 : inputToCents(raw)
  if (cents === null) return { error: 'Valor inválido.' }

  const reason = String(form.get('reason') ?? '')
  if (cents > 0 && !reason.trim()) {
    return { error: 'Um desconto leva sempre motivo.' }
  }

  const result = await setDiscount({
    appointmentId,
    cents,
    reason,
    byStaffId: found.actor.id,
  })

  if (!result.ok) {
    if (result.reason === 'closed') return CLOSED
    if (result.reason === 'invalid') {
      return { error: 'O desconto não pode ser maior do que a conta.' }
    }
    return NOT_FOUND
  }

  touch(found.appointment.unit_slug, appointmentId)
  return { error: null, done: 'Desconto guardado.' }
}

export async function addPaymentAction(
  _previous: ComandaState,
  form: FormData,
): Promise<ComandaState> {
  const appointmentId = String(form.get('appointment') ?? '')
  const found = await reach(appointmentId)
  if (!found) return NOT_FOUND

  const method = String(form.get('method') ?? '') as PaymentMethod
  if (!(method in PAYMENT_METHOD_LABEL)) return { error: 'Método inválido.' }

  const cents = inputToCents(String(form.get('amount') ?? ''))
  if (cents === null || cents <= 0) return { error: 'Valor inválido.' }

  const result = await addPayment({
    appointmentId,
    method,
    cents,
    note: String(form.get('note') ?? '').trim() || null,
    byStaffId: found.actor.id,
  })

  if (!result.ok) {
    if (result.reason === 'closed') return CLOSED
    return NOT_FOUND
  }

  touch(found.appointment.unit_slug, appointmentId)
  return { error: null, done: 'Pagamento registado.' }
}

export async function removePaymentAction(
  _previous: ComandaState,
  form: FormData,
): Promise<ComandaState> {
  const appointmentId = String(form.get('appointment') ?? '')
  const paymentId = String(form.get('payment') ?? '')
  const found = await reach(appointmentId)
  if (!found) return NOT_FOUND

  const result = await removePayment({ paymentId, appointmentId })
  if (!result.ok) {
    if (result.reason === 'closed') return CLOSED
    return NOT_FOUND
  }

  touch(found.appointment.unit_slug, appointmentId)
  return { error: null, done: 'Pagamento apagado.' }
}

/**
 * Fechar dá a conta por arrumada: depois disto não entram mais
 * pagamentos nem descontos.
 */
export async function closeComandaAction(
  _previous: ComandaState,
  form: FormData,
): Promise<ComandaState> {
  const appointmentId = String(form.get('appointment') ?? '')
  const found = await reach(appointmentId)
  if (!found) return NOT_FOUND

  const result = await closeComanda({
    appointmentId,
    byStaffId: found.actor.id,
  })

  if (!result.ok) {
    switch (result.reason) {
      case 'closed':
        return CLOSED
      case 'unpaid':
        return { error: 'Ainda falta receber. Registe os pagamentos primeiro.' }
      case 'cancelled':
        return { error: 'Uma marcação cancelada não se fecha.' }
      default:
        return NOT_FOUND
    }
  }

  touch(found.appointment.unit_slug, appointmentId)
  revalidatePath('/')
  return { error: null, done: 'Comanda fechada.' }
}
