/**
 * A superfície da cliente — montra, funil, área da conta — existe em
 * português, inglês e espanhol, escolhidos num seletor que grava um
 * cookie. A ÁREA DA EQUIPA NÃO SE TRADUZ.
 *
 * O conteúdo da base de dados (nomes de serviços, notas) fica na língua
 * da casa. A língua em que a cliente marcou fica guardada na ficha dela,
 * e é a língua em que as mensagens lhe saem depois.
 */

export const LANGUAGES = ['pt', 'en', 'es'] as const
export type Language = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'pt'
export const LANGUAGE_COOKIE = 'salao_lang'

export const LANGUAGE_LABEL: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
}

export const LANGUAGE_SHORT: Record<Language, string> = {
  pt: 'PT',
  en: 'EN',
  es: 'ES',
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

/** Melhor palpite a partir do cabeçalho Accept-Language. */
export function languageFromHeader(header: string | null): Language | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase() ?? ''
    const base = tag.split('-')[0]
    if (isLanguage(base)) return base
  }
  return null
}
