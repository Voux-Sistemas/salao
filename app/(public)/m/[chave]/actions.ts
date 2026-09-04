'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cancelBooking } from '@/lib/account'
import {
  clientMayReschedule,
  marcacaoPelaChave,
  rescheduleAppointment,
} from '@/lib/booking'
import { getDictionary } from '@/lib/i18n'
import { getUnitBySlug } from '@/lib/org'
import { isValidInstant, isoDay } from '@/lib/time'

/**
 * O QUE A CHAVE DEIXA FAZER.
 *
 * Duas coisas, e mais nenhuma: mudar a hora e desmarcar. Não muda os
 * serviços, não mostra a conta, não mexe noutra marcação.
 *
 * A CHAVE É A PROVA. Não há sessão, não há código: quem tem o link é
 * tratado como a dona da marcação, tal e qual um link de confirmação de
 * um hotel. Por isso a chave nunca vem de um campo escondido nem de um
 * formulário — vem sempre do endereço, e o que ela abre é uma marcação
 * só. É a diferença entre uma chave de porta e uma chave-mestra.
 */

export type ManageState = { error: string | null; done: string | null }

export const EMPTY: ManageState = { error: null, done: null }

// ---------------------------------------------------------------------
// Desmarcar
// ---------------------------------------------------------------------

export async function desmarcarPelaChaveAction(
  _previous: ManageState,
  form: FormData,
): Promise<ManageState> {
  const dict = await getDictionary()
  const chave = String(form.get('chave') ?? '')

  const appointment = await marcacaoPelaChave(chave)
  if (!appointment) return { error: dict.manage.gone, done: null }

  /*
    Passa pelo mesmo `cancelBooking` da área de conta, com o dono
    verdadeiro da marcação. A janela da casa, a transição de estado e o
    que fica escrito no histórico são exactamente os mesmos: esta porta
    é outra entrada para a mesma sala, e não uma sala paralela com
    regras próprias que um dia divergissem sem ninguém dar por isso.
  */
  const result = await cancelBooking(appointment.client_id, appointment.id)
  if (!result.ok) {
    return {
      error:
        result.reason === 'too_late'
          ? dict.account.cancelTooLate
          : dict.errors.generic,
      done: null,
    }
  }

  revalidatePath(`/m/${chave}`)
  return { error: null, done: dict.account.cancelled }
}

// ---------------------------------------------------------------------
// Mudar de hora
// ---------------------------------------------------------------------

export type RemarcarChaveState = { error: string | null }

export async function remarcarPelaChaveAction(
  _previous: RemarcarChaveState,
  form: FormData,
): Promise<RemarcarChaveState> {
  const dict = await getDictionary()
  const chave = String(form.get('chave') ?? '')

  const appointment = await marcacaoPelaChave(chave)
  if (!appointment) return { error: dict.manage.gone }

  const unit = await getUnitBySlug(appointment.unit_slug)
  if (!unit) return { error: dict.errors.generic }

  if (!clientMayReschedule(appointment, unit)) {
    return { error: dict.manage.rescheduleTooLate }
  }

  const startsAt = new Date(String(form.get('time') ?? ''))
  if (!isValidInstant(startsAt)) return { error: dict.errors.generic }

  /*
    OS SERVIÇOS SÃO OS DA MARCAÇÃO, e vêm de dentro — não do formulário.
    Ao balcão o carrinho viaja no pedido porque quem o preenche está do
    lado de cá do balcão; aqui do lado de fora, deixar a cliente mandar
    a lista era deixá-la trocar um corte por uma coloração ao mudar de
    hora. Mudar de serviço é outra marcação.

    A profissional cai de propósito: fica `null` e o motor reparte a
    visita por quem estiver livre à hora nova. Insistir em quem fazia
    antes fechava metade dos horários — e quem vem mudar de hora vem
    porque a hora não dá, não porque a pessoa não serve.
  */
  const cart = appointment.items.map((item) => ({
    serviceId: item.service_id,
    staffId: null,
  }))

  const result = await rescheduleAppointment({
    appointmentId: appointment.id,
    unit,
    day: isoDay(startsAt, unit.timezone),
    cart,
    startsAt,
    channel: 'online',
    source: 'site',
    byClient: true,
  })

  if (!result.ok) {
    switch (result.reason) {
      case 'slot_taken':
        return { error: dict.errors.slotTaken }
      case 'not_allowed':
        return { error: dict.manage.rescheduleTooLate }
      case 'not_found':
        return { error: dict.manage.gone }
      default:
        return { error: dict.errors.slotInvalid }
    }
  }

  /*
    A chave já seguiu para a marcação nova — o próprio
    `rescheduleAppointment` a passa, na mesma transação em que fecha a
    antiga. Fica lá dentro e não aqui porque a dona também remarca, ao
    balcão e ao telefone: se a passagem vivesse nesta acção, o link que
    a cliente guardou passava a abrir uma marcação cancelada sempre que
    fosse o salão a mudar-lhe a hora.
  */
  revalidatePath(`/m/${chave}`)
  redirect(`/m/${chave}?feito=1`)
}
