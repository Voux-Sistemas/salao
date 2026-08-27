import 'server-only'
import { cache } from 'react'
import { sql } from '@/lib/db'
import type { Language } from '@/lib/i18n/config'
import { formatDayLong, formatTime, isoDay } from '@/lib/time'
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  waLink,
  type Routine,
} from '@/lib/whatsapp'

/**
 * O texto que a pessoa vai mandar. A casa pode reescrever os modelos em
 * `message_template`; o que aqui está é o que existe até lá.
 *
 * A língua é a da CLIENTE — a que ela usou para marcar, guardada na
 * ficha. O conteúdo da casa (nomes de serviços) fica na língua da casa.
 */

export type Templates = Map<string, string>

const key = (routine: Routine, language: Language) => `${routine}:${language}`

export const loadTemplates = cache(async (orgId: string): Promise<Templates> => {
  const rows = await sql<
    { routine: Routine; language: Language; body: string }[]
  >`
    select routine, language, body
      from message_template
     where org_id = ${orgId}
  `
  return new Map(rows.map((r) => [key(r.routine, r.language), r.body]))
})

export type MessageTarget = {
  clientName: string
  clientPhone: string
  language: Language
  unitName: string
  startsAt: Date
  timezone: string
  /** "Corte + Coloração" */
  services: string
}

export type ComposedMessage = { text: string; href: string }

export function composeMessage(
  routine: Routine,
  target: MessageTarget,
  templates: Templates = new Map(),
): ComposedMessage {
  const language = target.language
  const body =
    templates.get(key(routine, language)) ??
    DEFAULT_TEMPLATES[routine][language]

  const text = arrumar(
    renderTemplate(body, {
      cliente: firstName(target.clientName),
      loja: target.unitName,
      dia: formatDayLong(
        isoDay(target.startsAt, target.timezone),
        target.timezone,
        language,
      ),
      hora: formatTime(target.startsAt, target.timezone, language),
      servicos: target.services,
    }),
  )

  return { text, href: waLink(target.clientPhone, text) }
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/*
 * Uma ficha pode não ter nome — nasce no balcão com o telefone e mais
 * nada — e então o `{cliente}` rende vazio e a mensagem começava por
 * «Olá , a sua marcação». Em vez de remendar este modelo, arruma-se o
 * resultado: cola-se a pontuação à palavra anterior e comem-se os
 * espaços a dobrar. Assim também aguenta um modelo que a casa venha a
 * escrever à mão com um marcador que fica por preencher.
 *
 * Colar não chega quando a pontuação era só para separar o nome do
 * resto: «Olá, {cliente}!» sem nome dava «Olá,!» — a vírgula ficou a
 * segurar o vazio. Uma pontuação encostada a outra é sinal de que o que
 * estava no meio desapareceu, e sai.
 */
function arrumar(text: string): string {
  return text
    .replace(/[ \t]+([,.!?;:])/g, '$1')
    .replace(/([,;:])(?=[.!?,;:])/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
}
