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
    NA MONTRA O TELEMÓVEL É OBRIGATÓRIO — E QUEM O EXIGE É ESTA LINHA.

    Foi opcional dos dois lados durante uns dias. A dona da casa veio
    dizer onde é que os dois lados diferem: ao BALCÃO está lá alguém —
    a colaboradora vê a cliente, fala com ela, e se for preciso
    chama-a pela porta fora. Aqui não está ninguém. Uma marcação feita
    às onze da noite por um nome sem número é uma cadeira reservada a
    quem a casa não consegue chamar: não se confirma, não se avisa de
    um atraso, e se a profissional adoecer a cliente vem à rua a um
    salão fechado.

    O «required» do campo é uma cortesia do navegador — poupa uma ida
    ao servidor e mostra o aviso onde o dedo está. Não é uma regra:
    desliga-se com uma linha na consola, e uma marcação chega por HTTP
    como qualquer outra coisa. A regra é esta.

    A COLUNA NA BASE CONTINUA A ACEITAR NULO, e continua a ser preciso:
    é por ali que o balcão marca para quem entra à porta sem querer dar
    o número. O que muda é quem pode usar essa porta — ver o comentário
    do campo em components/encaixe-form.tsx.

    E «a meio» não presta: um «912» escrito à pressa é pior do que campo
    nenhum, porque a casa fica a julgar que pode avisar.
  */
  const phone = normalisePhone(phoneRaw.trim())
  if (!phone) return { error: dict.errors.phoneRequired }
  if (phone.replace(/\D/g, '').length < 9) {
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
