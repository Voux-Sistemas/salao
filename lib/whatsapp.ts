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

/**
 * Modelos de origem, por rotina e por língua. A casa pode reescrevê-los
 * em message_template; estes são o que existe até lá.
 */
export const DEFAULT_TEMPLATES: Record<Routine, Record<Language, string>> = {
  confirm: {
    pt: 'Olá {cliente}! A sua marcação no {loja} está registada para {dia} às {hora} ({servicos}). Até já!',
    en: 'Hello {cliente}! Your appointment at {loja} is booked for {dia} at {hora} ({servicos}). See you soon!',
    es: '¡Hola {cliente}! Su cita en {loja} está reservada para {dia} a las {hora} ({servicos}). ¡Hasta pronto!',
  },
  reminder_eve: {
    pt: 'Olá {cliente}! Só para lembrar: amanhã, {dia}, às {hora}, no {loja}. Se precisar de mudar, diga-nos.',
    en: 'Hello {cliente}! A reminder: tomorrow, {dia}, at {hora}, at {loja}. Let us know if you need to change it.',
    es: '¡Hola {cliente}! Un recordatorio: mañana, {dia}, a las {hora}, en {loja}. Si necesita cambiarla, díganos.',
  },
  reminder_today: {
    pt: 'Olá {cliente}! É hoje às {hora}, no {loja}. Estamos à sua espera.',
    en: 'Hello {cliente}! Today at {hora}, at {loja}. We are waiting for you.',
    es: '¡Hola {cliente}! Hoy a las {hora}, en {loja}. La esperamos.',
  },
  review: {
    pt: 'Olá {cliente}! Foi um gosto recebê-la ontem. Se tiver um minuto, diga-nos como correu — ajuda-nos muito.',
    en: 'Hello {cliente}! It was a pleasure to see you yesterday. If you have a minute, tell us how it went.',
    es: '¡Hola {cliente}! Fue un gusto recibirla ayer. Si tiene un minuto, cuéntenos qué tal fue.',
  },
  winback: {
    pt: 'Olá {cliente}! Ficámos sem a ver. Quer que lhe guardemos uma hora esta semana no {loja}?',
    en: 'Hello {cliente}! We missed you. Shall we keep a time for you this week at {loja}?',
    es: '¡Hola {cliente}! La echamos de menos. ¿Le guardamos una hora esta semana en {loja}?',
  },
}

/** O código de acesso à área de conta, mandado à mão como tudo o resto. */
export const ACCESS_CODE_TEMPLATE: Record<Language, string> = {
  pt: 'Olá {cliente}! O seu código de acesso é {codigo}. É válido por 10 minutos.',
  en: 'Hello {cliente}! Your access code is {codigo}. It is valid for 10 minutes.',
  es: '¡Hola {cliente}! Su código de acceso es {codigo}. Es válido durante 10 minutos.',
}
