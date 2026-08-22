import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  isLanguage,
  type Language,
} from './config'

/**
 * O TEXTO DAS DUAS TELAS MÁS, FORA DOS DICIONÁRIOS.
 *
 * Vive à parte por uma razão prática: o `error.tsx` tem de ser um
 * componente do cliente — é essa a regra dos limites de erro — e tudo o
 * que ele importa vai parar ao browser. Puxar os três dicionários
 * inteiros para o pacote de todas as páginas, por causa de nove frases
 * que só se leem quando alguma coisa rebenta, não se paga.
 *
 * O tipo é `Record<Language, ProblemStrings>` de propósito: assim as
 * três línguas têm exactamente a mesma forma e nenhuma pode ganhar ou
 * perder uma chave sem o compilador dar por isso.
 */

export type ProblemStrings = {
  notFoundEyebrow: string
  notFoundTitle: string
  notFoundBody: string
  errorEyebrow: string
  errorTitle: string
  errorBody: string
  retry: string
  home: string
  book: string
}

export const PROBLEM: Record<Language, ProblemStrings> = {
  pt: {
    notFoundEyebrow: 'Página',
    notFoundTitle: 'Esta página não existe',
    notFoundBody:
      'O endereço pode ter mudado, ou o link veio partido pelo caminho. A marcação continua a um toque daqui.',
    errorEyebrow: 'Contratempo',
    errorTitle: 'Alguma coisa correu mal',
    errorBody:
      'Não foi por sua causa. Tente outra vez — e se voltar a acontecer, ligue-nos que marcamos por si.',
    retry: 'Tentar outra vez',
    home: 'Voltar ao início',
    book: 'Marcar',
  },
  en: {
    notFoundEyebrow: 'Page',
    notFoundTitle: 'This page does not exist',
    notFoundBody:
      'The address may have changed, or the link arrived broken. Booking is still one tap away.',
    errorEyebrow: 'Hiccup',
    errorTitle: 'Something went wrong',
    errorBody:
      'It was not your doing. Try again — and if it happens again, call us and we will book it for you.',
    retry: 'Try again',
    home: 'Back to the start',
    book: 'Book',
  },
  es: {
    notFoundEyebrow: 'Página',
    notFoundTitle: 'Esta página no existe',
    notFoundBody:
      'La dirección puede haber cambiado, o el enlace llegó roto. Reservar sigue a un toque de aquí.',
    errorEyebrow: 'Contratiempo',
    errorTitle: 'Algo ha salido mal',
    errorBody:
      'No ha sido culpa tuya. Inténtalo otra vez — y si vuelve a pasar, llámanos y reservamos por ti.',
    retry: 'Intentar otra vez',
    home: 'Volver al inicio',
    book: 'Reservar',
  },
}

/**
 * A língua lida no browser.
 *
 * O servidor lê o cookie e, na falta dele, adivinha pelo Accept-Language
 * — aqui esse cabeçalho não existe, por isso sobra o cookie e, depois
 * dele, a língua que o navegador diz falar. A tela de erro é a única
 * peça do sítio que tem de se desenrascar sozinha: quando ela aparece, o
 * servidor já não está a responder por esta página.
 */
export function languageFromBrowser(): Language {
  if (typeof document === 'undefined') return DEFAULT_LANGUAGE

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LANGUAGE_COOKIE}=`))
    ?.slice(LANGUAGE_COOKIE.length + 1)
  if (isLanguage(cookie)) return cookie

  const base = navigator.language?.split('-')[0]
  return isLanguage(base) ? base : DEFAULT_LANGUAGE
}
