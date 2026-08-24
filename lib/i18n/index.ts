import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  isLanguage,
  type Language,
} from './config'
import { pt, type Dictionary } from './dictionaries/pt'
import { en } from './dictionaries/en'
import { es } from './dictionaries/es'

const DICTIONARIES: Record<Language, Dictionary> = { pt, en, es }

/**
 * A CASA FALA PORTUGUÊS. SÓ A VISITA A FAZ MUDAR DE LÍNGUA.
 *
 * A língua sai do cookie, e o cookie só existe depois de alguém ter
 * carregado no selector. Sem cookie, sai português — e não o que o
 * telemóvel da visita traz configurado.
 *
 * O Accept-Language esteve aqui e saiu. Adivinhar pelo cabeçalho dava
 * isto: uma cliente em Valongo, com o telemóvel comprado em Espanha ou
 * com o Android em inglês, abria a montra da casa em espanhol sem ter
 * pedido nada — e a dona, a mostrar o sítio a alguém ao balcão, via a
 * sua própria montra numa língua que não escolheu. A casa é portuguesa
 * e abre em português; o inglês e o espanhol estão ali ao lado, a dois
 * caracteres de distância, para quem os quiser.
 */
export const getLanguage = cache(async (): Promise<Language> => {
  const jar = await cookies()
  const fromCookie = jar.get(LANGUAGE_COOKIE)?.value
  if (isLanguage(fromCookie)) return fromCookie
  return DEFAULT_LANGUAGE
})

export const getDictionary = cache(async (): Promise<Dictionary> => {
  return DICTIONARIES[await getLanguage()]
})

export function dictionaryFor(language: Language): Dictionary {
  return DICTIONARIES[language]
}

/** Substitui {marcadores} no texto traduzido. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}

export type { Dictionary }
export * from './config'
