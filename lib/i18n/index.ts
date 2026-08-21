import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  isLanguage,
  languageFromHeader,
  type Language,
} from './config'
import { pt, type Dictionary } from './dictionaries/pt'
import { en } from './dictionaries/en'
import { es } from './dictionaries/es'

const DICTIONARIES: Record<Language, Dictionary> = { pt, en, es }

/**
 * A língua sai do cookie. Se não houver cookie, adivinha-se pelo
 * Accept-Language; se nem isso, fica a língua da casa.
 */
export const getLanguage = cache(async (): Promise<Language> => {
  const jar = await cookies()
  const fromCookie = jar.get(LANGUAGE_COOKIE)?.value
  if (isLanguage(fromCookie)) return fromCookie

  const headerList = await headers()
  return languageFromHeader(headerList.get('accept-language')) ?? DEFAULT_LANGUAGE
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
