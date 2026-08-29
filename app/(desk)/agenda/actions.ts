'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { can, requireActor, canSeeUnit, type Actor } from '@/lib/auth/actor'
import {
  canTransition,
  getAppointment,
  transitionAppointment,
  type Status,
} from '@/lib/booking'
import { ROUTINES, type Routine } from '@/lib/whatsapp'
import { agendaIsPrivateOn } from '@/lib/sunday'
import { isoDay } from '@/lib/time'

export type DeskState = { error: string | null; done?: string | null }

/**
 * Esta pessoa pode mexer nesta marcação?
 *
 * Acima da profissional ninguém é peneirado. A profissional mexe no que
 * é dela — excepto ao domingo, em que o trabalho é da casa: entra em
 * nome de quem o motor escolheu, mas quem o pega decide-se lá, entre
 * elas. De nada servia mostrar-lhes o domingo inteiro na grelha e
 * depois responder «essa marcação não existe» a quem lhe tocasse.
 *
 * O dia é o da marcação, lido no fuso da loja — e não o de hoje.
 */
function canTouch(
  actor: Actor,
  appointment: {
    starts_at: Date
    unit_timezone: string
    items: { staff_id: string }[]
  },
): boolean {
  if (actor.role !== 'professional') return true
  if (!agendaIsPrivateOn(isoDay(appointment.starts_at, appointment.unit_timezone))) {
    return true
  }
  return appointment.items.some((i) => i.staff_id === actor.id)
}

const STATUSES: Status[] = [
  'booked',
  'confirmed',
  'checked_in',
  'in_service',
  'completed',
  'cancelled_by_client',
  'cancelled_by_salon',
  'no_show',
]

/**
 * Os botões do estado seguinte. Cada mudança fica registada com quem a
 * fez, quando e porquê — e cancelar apaga os blocos.
 */
export async function transitionAction(
  _previous: DeskState,
  form: FormData,
): Promise<DeskState> {
  const actor = await requireActor()
  const appointmentId = String(form.get('appointment') ?? '')
  const to = String(form.get('to') ?? '') as Status
  const reason = String(form.get('reason') ?? '').trim() || null

  if (!STATUSES.includes(to)) return { error: 'Estado desconhecido.' }

  const appointment = await getAppointment(appointmentId)
  // Marcação que esta pessoa não pode ver não existe.
  if (!appointment || appointment.org_id !== actor.orgId) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canSeeUnit(actor, appointment.unit_id)) {
    return { error: 'Essa marcação não existe.' }
  }
  // A profissional só mexe no que é dela — ao domingo, no que é da casa.
  if (!canTouch(actor, appointment)) {
    return { error: 'Essa marcação não existe.' }
  }

  if (!canTransition(appointment.status, to)) {
    return { error: 'Já não é possível mudar para esse estado.' }
  }

  const result = await transitionAppointment({
    appointmentId,
    to,
    byStaffId: actor.id,
    reason,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'closed'
          ? 'A comanda já está fechada.'
          : result.reason === 'not_allowed'
            ? 'Já não é possível mudar para esse estado.'
            : 'Essa marcação não existe.',
    }
  }

  revalidatePath(`/agenda/${appointment.unit_slug}`)
  revalidatePath(`/avisos/${appointment.unit_slug}`)
  revalidatePath('/')

  /*
    CONCLUIR E COBRAR SÃO O MESMO GESTO — quase sempre.

    Ao balcão, a marcação acaba e a cliente está à frente com o cartão
    na mão: dar por concluída e abrir a comanda eram dois toques em dois
    sítios, sempre pela mesma ordem. Quem carrega no botão grande leva
    as duas coisas.

    O DESTINO NÃO VEM DO FORMULÁRIO, vem daqui: o que chega de fora é um
    sim ou não, e a morada monta-se com a loja desta marcação. Um
    endereço enviado pelo navegador seria uma porta aberta para mandar
    alguém para onde se quisesse.
  */
  if (form.get('charge') === '1' && can.seeCash(actor)) {
    redirect(`/agenda/${appointment.unit_slug}/comanda/${appointmentId}`)
  }

  return { error: null, done: 'Feito.' }
}

/**
 * ENVIAR É GRAVAR; GRAVAR É SAIR DA FILA. É este registo, e só ele, que
 * impede o aviso duplicado.
 *
 * E não confundir: mandar a confirmação NÃO é a cliente confirmar. São
 * dois factos distintos — este é a mensagem que saiu.
 */
export async function logNotificationAction(
  _previous: DeskState,
  form: FormData,
): Promise<DeskState> {
  const actor = await requireActor()
  const appointmentId = String(form.get('appointment') ?? '')
  const routine = String(form.get('routine') ?? '') as Routine
  const message = String(form.get('message') ?? '') || null

  if (!ROUTINES.includes(routine)) return { error: 'Rotina desconhecida.' }

  const appointment = await getAppointment(appointmentId)
  if (!appointment || appointment.org_id !== actor.orgId) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canSeeUnit(actor, appointment.unit_id)) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canTouch(actor, appointment)) {
    return { error: 'Essa marcação não existe.' }
  }

  await sql`
    insert into notification_log
      (org_id, unit_id, appointment_id, client_id, routine,
       message_snapshot, sent_by_staff_id)
    values
      (${appointment.org_id}, ${appointment.unit_id}, ${appointment.id},
       ${appointment.client_id}, ${routine}, ${message}, ${actor.id})
    on conflict (appointment_id, routine) do nothing
  `

  revalidatePath(`/agenda/${appointment.unit_slug}`)
  revalidatePath(`/avisos/${appointment.unit_slug}`)
  return { error: null, done: 'Registado.' }
}
