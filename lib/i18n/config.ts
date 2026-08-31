/**
 * A superfície da cliente — montra, funil, área da conta — existe em
 * português, inglês e espanhol, escolhidos num seletor que grava um
 * cookie. A ÁREA DA EQUIPA NÃO SE TRADUZ.
 *
 * O CATÁLOGO TEM DOIS NOMES PARA A MESMA COISA, e é de propósito.
 *
 * O nome da casa — `service.name`, sempre português — é o que manda: vai
 * para a agenda e para os relatórios, e é
 * ele que fica congelado em `appointment_item.service_name` no momento
 * da marcação. Não se traduz nunca; traduzir a marcação de uma cliente
 * espanhola era pôr o balcão a ler uma língua que não fala.
 *
 * O nome para fora vive em `name_en` / `name_es` (e as descrições ao
 * lado), resolve-se ao desenhar o ecrã pela função `name_in()` do lado
 * da base, e não se guarda em lado nenhum. Sem tradução escrita, sai o
 * português — nunca fica um espaço em branco. As traduções de origem
 * estão em `scripts/catalogo-linguas.mjs`.
 *
 * A língua em que a cliente marcou fica guardada na ficha dela, e é a
 * língua em que as mensagens de WhatsApp lhe saem depois — texto e nomes
 * de serviço incluídos.
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

/**
 * A etiqueta que se escreve no `lang` do HTML.
 *
 * `pt` sozinho não chega: é o `pt-PT` que diz ao leitor de ecrã que
 * pronuncie «marcação» com o ó fechado de cá, e não com o de São Paulo.
 * O mesmo para as outras duas — é o inglês e o espanhol da Europa que
 * esta casa fala.
 */
export const LANGUAGE_TAG: Record<Language, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
  es: 'es-ES',
}
