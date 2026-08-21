'use server'

import { redirect } from 'next/navigation'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { normalisePhone } from '@/lib/env'
import { parseCart } from '@/lib/cart'
import { createAppointment, findOrCreateClient } from '@/lib/booking'
import { isoDay } from '@/lib/time'

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

  const phone = normalisePhone(phoneRaw)
  if (phone.replace(/\D/g, '').length < 9) {
    return { error: dict.errors.phoneInvalid }
  }

  const startsAt = new Date(time)
  if (Number.isNaN(startsAt.getTime()) || cart.length === 0) {
    return { error: dict.errors.slotInvalid }
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
