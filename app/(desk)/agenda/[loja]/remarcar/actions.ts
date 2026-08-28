'use server'

import { redirect } from 'next/navigation'
import { canSeeUnit, ownStaffId, requireBooking } from '@/lib/auth/actor'
import { getAppointment, rescheduleAppointment } from '@/lib/booking'
import { parseCart } from '@/lib/cart'
import { getUnitBySlug } from '@/lib/org'
import { isValidInstant, isoDay } from '@/lib/time'

export type RemarcarState = { error: string | null }

/**
 * Remarcar cria uma marcação NOVA a apontar para a antiga. A antiga sai
 * da agenda com os seus blocos — não se edita o passado.
 *
 * Os serviços são os mesmos; o que muda é a hora e, se for preciso, quem
 * faz. Trocar de serviço é outra marcação, não uma remarcação.
 */
export async function remarcarAction(
  _previous: RemarcarState,
  form: FormData,
): Promise<RemarcarState> {
  const actor = await requireBooking()

  const slug = String(form.get('unit') ?? '')
  const appointmentId = String(form.get('appointment') ?? '')

  const [unit, appointment] = await Promise.all([
    getUnitBySlug(slug),
    getAppointment(appointmentId),
  ])

  // Marcação de outra loja, de outra rede ou inexistente: a mesma resposta.
  if (
    !unit ||
    unit.org_id !== actor.orgId ||
    !canSeeUnit(actor, unit.id) ||
    !appointment ||
    appointment.org_id !== actor.orgId ||
    appointment.unit_id !== unit.id
  ) {
    return { error: 'Essa marcação não existe.' }
  }

  /*
    A profissional remarca o que é dela. Uma marcação de uma colega
    responde o mesmo que uma marcação que não existe: não se confirma a
    existência do que a pessoa não pode mexer.
  */
  const ownStaff = ownStaffId(actor)
  if (ownStaff && !appointment.items.some((item) => item.staff_id === ownStaff)) {
    return { error: 'Essa marcação não existe.' }
  }

  const cart = parseCart(String(form.get('cart') ?? ''))

  /*
    E REMARCA PARA ELA. A página só lhe mostra o nome dela, mas o
    carrinho vem do formulário e um formulário forja-se — a mesma trava
    do encaixe vale aqui: com o nome de uma colega, a remarcação não se
    faz; sem dono, a linha fica com ela.
  */
  if (ownStaff) {
    if (cart.some((line) => line.staffId && line.staffId !== ownStaff)) {
      return { error: 'Só pode remarcar para si.' }
    }
    for (const line of cart) line.staffId = ownStaff
  }

  const original = appointment.items.map((item) => item.service_id)
  const sameServices =
    cart.length === original.length &&
    cart.every((line, index) => line.serviceId === original[index])
  if (!sameServices) {
    return { error: 'Os serviços da remarcação têm de ser os mesmos.' }
  }

  const startsAt = new Date(String(form.get('time') ?? ''))
  if (!isValidInstant(startsAt)) return { error: 'Escolha a hora.' }

  const result = await rescheduleAppointment({
    appointmentId: appointment.id,
    unit,
    day: isoDay(startsAt, unit.timezone),
    cart,
    startsAt,
    channel: 'counter',
    source: 'counter',
    byStaffId: actor.id,
    reason: String(form.get('reason') ?? '').trim() || null,
  })

  if (!result.ok) {
    switch (result.reason) {
      case 'slot_taken':
        return { error: 'Essa hora acabou de ser ocupada. Escolha outra.' }
      case 'not_allowed':
        return {
          error:
            'Esta marcação já não se remarca: está fechada, cancelada ou dada como falta.',
        }
      case 'not_found':
        return { error: 'Essa marcação não existe.' }
      default:
        return {
          error: 'Nessa hora não dá: alguém ou algum recurso não está livre.',
        }
    }
  }

  redirect(
    `/agenda/${unit.slug}?d=${isoDay(startsAt, unit.timezone)}&m=${result.appointmentId}`,
  )
}
