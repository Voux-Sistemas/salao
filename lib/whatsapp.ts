import { normalisePhone } from '@/lib/env'
import type { Language } from '@/lib/i18n/config'

/**
 * O contacto com a cliente é por WhatsApp, e o sistema NÃO envia
 * sozinho: prepara a mensagem e abre a conversa. Uma pessoa carrega no
 * botão.
 *
 * Não há integração, não há trabalhador de fundo, não há estado para
 * dessincronizar — há uma ligação wa.me e um registo de envio.
 */

export type Routine =
  | 'confirm'
  | 'reminder_eve'
  | 'reminder_today'
  | 'review'
  | 'winback'

export const ROUTINES: Routine[] = [
  'confirm',
  'reminder_eve',
  'reminder_today',
  'review',
  'winback',
]

export const ROUTINE_LABEL: Record<Routine, string> = {
  confirm: 'Confirmar marcação',
  reminder_eve: 'Lembrete da véspera',
  reminder_today: 'Lembrete de hoje',
  review: 'Pedir avaliação',
  winback: 'Recuperar cliente',
}

export const ROUTINE_HINT: Record<Routine, string> = {
  confirm: 'Ainda não recebeu nada por escrito.',
  reminder_eve: 'É atendida amanhã. É o aviso que mais evita faltas.',
  reminder_today: 'É atendida hoje, mais logo.',
  review: 'Foi atendida ontem.',
  winback: 'Faltou ou cancelou nos últimos dias.',
}

/** Abre a conversa com a mensagem já escrita. */
export function waLink(phone: string, text: string): string {
  const digits = normalisePhone(phone).replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/**
 * Substitui {marcadores}. O que não for reconhecido fica como está —
 * um modelo mal escrito não deve apagar texto.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? (values[key] ?? whole) : whole,
  )
}

/*
 * OS MODELOS SÃO ESCRITOS PARA O WHATSAPP, NÃO PARA UM PAPEL.
 *
 * Duas coisas mudaram depois de os ler dentro da aplicação. A primeira
 * foi a mudança de linha: estava tudo num parágrafo só, e quem recebe
 * no telemóvel tem de ler a frase toda para encontrar a hora. Agora o
 * dia e a hora ficam sozinhos numa linha, com asteriscos à volta — que
 * é como o WhatsApp faz negrito, e é a única marca de formatação que
 * usamos.
 *
 * A segunda foi o que NÃO se põe aqui: nada de emojis nem de símbolos
 * bonitos. Os acentos, o «ç» e o «¡» viajam bem — foram medidos, ida e
 * volta, nos três idiomas. Um emoji depende da letra que o telemóvel de
 * quem recebe tiver instalada, e num telefone antigo sai um quadrado.
 * Para uma mensagem que a casa manda a uma cliente, não vale o risco.
 *
 * As linhas escrevem-se em lista porque assim vê-se o desenho da
 * mensagem ao ler o código — uma linha vazia é uma linha vazia.
 */
const linhas = (...partes: string[]) => partes.join('\n')

export const DEFAULT_TEMPLATES: Record<Routine, Record<Language, string>> = {
  confirm: {
    pt: linhas(
      'Olá {cliente}, a sua marcação no {loja} ficou registada.',
      '',
      '*{dia}, às {hora}*',
      '{servicos}',
      '',
      'Até já!',
    ),
    en: linhas(
      'Hello {cliente}, your appointment at {loja} is booked.',
      '',
      '*{dia}, at {hora}*',
      '{servicos}',
      '',
      'See you soon!',
    ),
    es: linhas(
      '¡Hola {cliente}! Su cita en {loja} ha quedado reservada.',
      '',
      '*{dia}, a las {hora}*',
      '{servicos}',
      '',
      '¡Hasta pronto!',
    ),
  },
  reminder_eve: {
    pt: linhas(
      'Olá {cliente}, é já amanhã.',
      '',
      '*{dia}, às {hora}*',
      '{loja}',
      '',
      'Se precisar de mudar, é só dizer.',
    ),
    en: linhas(
      'Hello {cliente}, it is tomorrow.',
      '',
      '*{dia}, at {hora}*',
      '{loja}',
      '',
      'Just tell us if you need to change it.',
    ),
    es: linhas(
      '¡Hola {cliente}! Es mañana.',
      '',
      '*{dia}, a las {hora}*',
      '{loja}',
      '',
      'Si necesita cambiarla, díganos.',
    ),
  },
  reminder_today: {
    pt: linhas(
      'Olá {cliente}, é hoje.',
      '',
      '*Às {hora}*, no {loja}',
      '',
      'Estamos à sua espera.',
    ),
    en: linhas(
      'Hello {cliente}, it is today.',
      '',
      '*At {hora}*, at {loja}',
      '',
      'We are waiting for you.',
    ),
    es: linhas(
      '¡Hola {cliente}! Es hoy.',
      '',
      '*A las {hora}*, en {loja}',
      '',
      'La esperamos.',
    ),
  },
  review: {
    pt: linhas(
      'Olá {cliente}, foi um gosto recebê-la ontem.',
      '',
      'Se tiver um minuto, diga-nos como correu. Ajuda-nos muito.',
    ),
    en: linhas(
      'Hello {cliente}, it was a pleasure to see you yesterday.',
      '',
      'If you have a minute, tell us how it went. It helps us a lot.',
    ),
    es: linhas(
      '¡Hola {cliente}! Fue un gusto recibirla ayer.',
      '',
      'Si tiene un minuto, cuéntenos qué tal fue. Nos ayuda mucho.',
    ),
  },
  winback: {
    pt: linhas(
      'Olá {cliente}, ficámos sem a ver.',
      '',
      'Quer que lhe guardemos uma hora esta semana no {loja}?',
    ),
    en: linhas(
      'Hello {cliente}, we have missed you.',
      '',
      'Shall we keep a time for you this week at {loja}?',
    ),
    es: linhas(
      '¡Hola {cliente}! La echamos de menos.',
      '',
      '¿Le guardamos una hora esta semana en {loja}?',
    ),
  },
}

/** O código de acesso à área de conta, mandado à mão como tudo o resto. */
export const ACCESS_CODE_TEMPLATE: Record<Language, string> = {
  pt: linhas(
    'Olá {cliente}, o seu código de acesso é *{codigo}*.',
    '',
    'É válido por 10 minutos.',
  ),
  en: linhas(
    'Hello {cliente}, your access code is *{codigo}*.',
    '',
    'It is valid for 10 minutes.',
  ),
  es: linhas(
    '¡Hola {cliente}! Su código de acceso es *{codigo}*.',
    '',
    'Es válido durante 10 minutos.',
  ),
}
