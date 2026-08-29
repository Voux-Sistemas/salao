'use server'

import { redirect } from 'next/navigation'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { normalisePhone } from '@/lib/env'
import { parseCart } from '@/lib/cart'
import { createAppointment, findOrCreateClient } from '@/lib/booking'
import { LIMITS, allowed, callerIp } from '@/lib/auth/throttle'
import { isValidInstant, isoDay } from '@/lib/time'

export type BookState = { error: string | null }

/**
 * Gravar. A cliente manda apenas o INSTANTE escolhido — quem faz o quê e
 * em que recurso é decidido aqui, no servidor. Nunca se confia no plano
 * que veio do navegador.
 */
export async function bookAction(
  _previous: BookState,
  form: FormData,
): Promise<BookState> {
  const dict = await getDictionary()
  const language = await getLanguage()

  const slug = String(form.get('unit') ?? '')
  const cart = parseCart(String(form.get('cart') ?? ''))
  const time = String(form.get('time') ?? '')
  const name = String(form.get('name') ?? '').trim()
  const phoneRaw = String(form.get('phone') ?? '')
  const note = String(form.get('note') ?? '').trim()

  if (!name) return { error: dict.errors.nameRequired }

  /*
    O TELEMÓVEL É OPCIONAL — MAS SE VIER, TEM DE PRESTAR.

    Nem toda a gente quer deixar o número para marcar um brushing, e a
    casa prefere a marcação sem número à marcação que não se fez. O que
    não se aceita é um número a meio: um «912» escrito à pressa é pior
    do que campo nenhum, porque a casa fica a julgar que pode avisar.

    Em branco vale NULO até à base: é assim que a ficha fica «sem
    contacto», em vez de ficar com uma identidade vazia que colidia com
    a seguinte.
  */
  const escrito = phoneRaw.trim()
  const phone = escrito ? normalisePhone(escrito) : null
  if (phone !== null && phone.replace(/\D/g, '').length < 9) {
    return { error: dict.errors.phoneInvalid }
  }

  const startsAt = new Date(time)
  // «Inválido» inclui os anos expandidos que o new Date aceita mas o
  // calendário da casa recusa — ver isValidInstant em lib/time.ts.
  if (!isValidInstant(startsAt) || cart.length === 0) {
    return { error: dict.errors.slotInvalid }
  }

  /*
   * Travão. Marcar não pede senha nem código — basta um nome e um
   * telefone escritos à mão. Sem limite, um guião enchia a agenda de
   * amanhã inteira em segundos e a loja abria a portas fechadas.
   *
   * O balde é o do endereço porque o telefone aqui não prova nada:
   * quem faz isto de propósito escreve um número diferente de cada vez.
   * Doze marcações por hora do mesmo sítio chegam bem para uma família.
   */
  const ip = await callerIp()
  if (!(await allowed('marcar-ip', ip, LIMITS.book))) {
    return { error: dict.errors.tooMany }
  }

  const org = await requireOrg()
  const unit = await getUnitBySlug(slug)
  if (!unit) return { error: dict.errors.generic }

  const clientId = await findOrCreateClient(org.id, {
    phone,
    name,
    language,
    preferredUnitId: unit.id,
  })

  const result = await createAppointment({
    unit,
    day: isoDay(startsAt, unit.timezone),
    cart,
    startsAt,
    channel: 'online',
    source: 'site',
    clientId,
    language,
    clientNote: note || null,
    byClient: true,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'slot_taken'
          ? dict.errors.slotTaken
          : dict.errors.slotInvalid,
    }
  }

  redirect(`/agendar/${unit.slug}/pronto/${result.appointmentId}`)
}
