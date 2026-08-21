import { TZDate } from '@date-fns/tz'

/**
 * Toda a data é guardada em UTC e convertida na borda com o FUSO DA
 * LOJA — nunca o do servidor, nunca o do navegador. Este ficheiro é
 * essa borda.
 *
 * Dois tipos convivem aqui:
 *   · `Instant`  — um momento real (Date, sempre UTC por dentro)
 *   · `IsoDay`   — uma data de calendário 'AAAA-MM-DD', que só ganha
 *                  sentido quando lhe damos um fuso
 *   · minutos    — hora-do-dia recorrente, 0..1440 desde a meia-noite
 */

export type IsoDay = string
export type Minutes = number

const pad = (n: number) => String(n).padStart(2, '0')

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
  es: 'es-ES',
}

const localeOf = (language: string) => LOCALE_BY_LANGUAGE[language] ?? 'pt-PT'

// ---------------------------------------------------------------------
// Calendário <-> instante
// ---------------------------------------------------------------------

function parts(day: IsoDay): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`Data inválida: ${day}`)
  return [y, m, d]
}

/** O instante em que começa esse dia, naquele fuso. */
export function dayStart(day: IsoDay, timezone: string): Date {
  const [y, m, d] = parts(day)
  return new Date(TZDate.tz(timezone, y, m - 1, d, 0, 0, 0, 0).getTime())
}

/** O instante em que começa o dia SEGUINTE (fim exclusivo). */
export function dayEnd(day: IsoDay, timezone: string): Date {
  return dayStart(addDays(day, 1), timezone)
}

/**
 * O instante correspondente a N minutos depois da meia-noite desse dia,
 * naquele fuso. Aceita minutos >= 1440 (transborda para o dia seguinte),
 * que é como se representa um fecho à meia-noite.
 */
export function atMinutes(
  day: IsoDay,
  minutes: Minutes,
  timezone: string,
): Date {
  const [y, m, d] = parts(day)
  return new Date(TZDate.tz(timezone, y, m - 1, d, 0, minutes, 0, 0).getTime())
}

/** A data de calendário em que este instante cai, naquele fuso. */
export function isoDay(instant: Date, timezone: string): IsoDay {
  const z = new TZDate(instant, timezone)
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`
}

/** Quantos minutos depois da meia-noite local é este instante. */
export function minutesOfDay(instant: Date, timezone: string): Minutes {
  const z = new TZDate(instant, timezone)
  return z.getHours() * 60 + z.getMinutes()
}

/** Hoje, naquele fuso. */
export function today(timezone: string, now = new Date()): IsoDay {
  return isoDay(now, timezone)
}

// ---------------------------------------------------------------------
// Aritmética de calendário (independente de fuso)
// ---------------------------------------------------------------------

export function addDays(day: IsoDay, amount: number): IsoDay {
  const [y, m, d] = parts(day)
  const t = new Date(Date.UTC(y, m - 1, d + amount))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function daysBetween(from: IsoDay, to: IsoDay): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.round((b - a) / 86_400_000)
}

/** 0 = domingo … 6 = sábado (igual ao Date#getDay). */
export function weekdayOf(day: IsoDay): number {
  const [y, m, d] = parts(day)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isoRange(from: IsoDay, count: number): IsoDay[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i))
}

// ---------------------------------------------------------------------
// Minutos <-> texto
// ---------------------------------------------------------------------

/** 570 -> "09:30" */
export function formatMinutes(minutes: Minutes): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** "09:30" -> 570; null se não for uma hora válida. */
export function parseMinutes(value: string): Minutes | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null
  return h * 60 + m
}

/** 95 -> "1 h 35" · 60 -> "1 h" · 45 -> "45 min" */
export function formatDuration(minutes: number, language = 'pt'): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const unit = language === 'pt' ? 'min' : 'min'
  if (h === 0) return `${m} ${unit}`
  if (m === 0) return `${h} h`
  return `${h} h ${pad(m)}`
}

// ---------------------------------------------------------------------
// Apresentação (sempre com fuso explícito)
// ---------------------------------------------------------------------

export function formatTime(
  instant: Date,
  timezone: string,
  language = 'pt',
): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(instant)
}

export function formatDayLong(
  day: IsoDay,
  timezone: string,
  language = 'pt',
): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }).format(dayStart(day, timezone))
}

export function formatDayShort(
  day: IsoDay,
  timezone: string,
  language = 'pt',
): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
  }).format(dayStart(day, timezone))
}

export function formatWeekdayShort(
  day: IsoDay,
  timezone: string,
  language = 'pt',
): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    weekday: 'short',
    timeZone: timezone,
  }).format(dayStart(day, timezone))
}

export function formatDateTime(
  instant: Date,
  timezone: string,
  language = 'pt',
): string {
  return new Intl.DateTimeFormat(localeOf(language), {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(instant)
}

export const WEEKDAY_NAMES_PT = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const
