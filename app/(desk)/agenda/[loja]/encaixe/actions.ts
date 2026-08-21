'use server'

import { redirect } from 'next/navigation'
import { canSeeUnit, requireManagement } from '@/lib/auth/actor'
import { createAppointment, findOrCreateClient, type Source } from '@/lib/booking'
import { parseCart } from '@/lib/cart'
import { sql } from '@/lib/db'
import { normalisePhone } from '@/lib/env'
import { getUnitBySlug } from '@/lib/org'
import { isoDay } from '@/lib/time'
import type { Language } from '@/lib/i18n/config'

export type EncaixeState = { error: string | null }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SOURCES: Source[] = ['counter', 'phone', 'whatsapp', 'walk_in']

/**
 * O ENCAIXE. É a receção a marcar: entram serviços que não estão
 * abertos ao online, profissionais que não aceitam marcação online, e
 * as regras de antecedência não se aplicam.
 *
 * O que continua a valer é o que a base de dados garante: ninguém fica
 * com dois clientes à mesma hora, nem o mesmo recurso em duas cadeiras.
 */
export async function encaixeAction(
  _previous: EncaixeState,
  form: FormData,
): Promise<EncaixeState> {
  const actor = await requireManagement()

  const slug = String(form.get('unit') ?? '')
  const unit = await getUnitBySlug(slug)
  if (!unit || unit.org_id !== actor.orgId || !canSeeUnit(actor, unit.id)) {
    return { error: 'Essa loja não existe.' }
  }

  const cart = parseCart(String(form.get('cart') ?? ''))
  if (cart.length === 0) return { error: 'Escolha pelo menos um serviço.' }

  const startsAt = new Date(String(form.get('time') ?? ''))
  if (Number.isNaN(startsAt.getTime())) {
    return { error: 'Escolha a hora.' }
  }

  const sourceRaw = String(form.get('source') ?? 'counter') as Source
  const source: Source = SOURCES.includes(sourceRaw) ? sourceRaw : 'counter'

  // --- a cliente ----------------------------------------------------
  const existingId = String(form.get('client') ?? '')
  let clientId: string
  let language: Language = 'pt'

  if (UUID_RE.test(existingId)) {
    const rows = await sql<{ id: string; language: Language }[]>`
      select id, language from client
       where id = ${existingId} and org_id = ${actor.orgId}
    `
    const found = rows[0]
    if (!found) return { error: 'Essa cliente não existe.' }
    clientId = found.id
    language = found.language
  } else {
    const name = String(form.get('name') ?? '').trim()
    const phone = normalisePhone(String(form.get('phone') ?? ''))
    if (!name) return { error: 'Falta o nome da cliente.' }
    if (phone.replace(/\D/g, '').length < 9) {
      return { error: 'Telefone inválido.' }
    }
    // O telefone é a identidade: se já cá anda, é a mesma ficha.
    clientId = await findOrCreateClient(actor.orgId, {
      phone,
      name,
      language,
      preferredUnitId: unit.id,
    })
  }

  const result = await createAppointment({
    unit,
    day: isoDay(startsAt, unit.timezone),
    cart,
    startsAt,
    channel: 'counter',
    source,
    clientId,
    language,
    internalNote: String(form.get('note') ?? '').trim() || null,
    createdByStaffId: actor.id,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'slot_taken'
          ? 'Essa hora acabou de ser ocupada. Escolha outra.'
          : 'Nessa hora não dá: alguém ou algum recurso não está livre.',
    }
  }

  redirect(
    `/agenda/${unit.slug}?d=${isoDay(startsAt, unit.timezone)}&m=${result.appointmentId}`,
  )
}
