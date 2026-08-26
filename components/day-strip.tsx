import Link from 'next/link'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n'
import {
  addDays,
  daysBetween,
  formatWeekdayShort,
  isoRange,
  type IsoDay,
} from '@/lib/time'

/**
 * A TIRA DOS DIAS.
 *
 * Uma semana de cada vez, com setas para a anterior e a seguinte. Vive
 * em dois passos do funil — no que escolhe o dia e no que escolhe a
 * hora — e é a mesma tira nos dois de propósito: quem já a usou uma vez
 * reconhece-a, e quem volta atrás encontra o dia onde o deixou.
 *
 * O `href` é uma função, não uma lista: cada página sabe para onde
 * mandar cada dia, e esta só sabe desenhar.
 */
export function DayStrip({
  day,
  firstDay,
  lastDay,
  timezone,
  language,
  dict,
  href,
  label,
}: {
  day: IsoDay
  firstDay: IsoDay
  lastDay: IsoDay
  timezone: string
  language: string
  dict: Dictionary
  href: (day: IsoDay) => string
  /** Nome da tira para quem a ouve em vez de a ver. */
  label: string
}) {
  const strip = isoRange(day, 7).filter((d) => d <= lastDay)
  const previous = day > firstDay ? maxDay(addDays(day, -7), firstDay) : null
  const next = addDays(day, 7) <= lastDay ? addDays(day, 7) : null

  return (
    <nav className="flex items-stretch gap-2" aria-label={label}>
      <StripArrow href={previous ? href(previous) : null} label={dict.funnel.previousDay}>
        <ChevronLeft size={16} />
      </StripArrow>

      <ul className="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-7">
        {strip.map((value, index) => {
          const offset = daysBetween(firstDay, value)
          const name =
            offset === 0
              ? dict.funnel.today
              : offset === 1
                ? dict.funnel.tomorrow
                : null
          return (
            <li key={value} className={index > 3 ? 'hidden sm:block' : undefined}>
              <Link
                href={href(value)}
                aria-current={value === day ? 'date' : undefined}
                className={clsx(
                  'flex h-[4.75rem] flex-col items-center justify-center gap-1 border transition-all duration-200',
                  value === day
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-[var(--shadow-soft)]'
                    : 'border-[var(--line-soft)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:-translate-y-0.5 hover:border-[var(--accent)] hover:text-[var(--accent)]',
                )}
              >
                <span className="text-[0.5625rem] tracking-[0.14em] uppercase">
                  {name ?? formatWeekdayShort(value, timezone, language)}
                </span>
                <span className="tabular display text-xl leading-none">
                  {value.slice(8, 10)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <StripArrow href={next ? href(next) : null} label={dict.funnel.nextDay}>
        <ChevronRight size={16} />
      </StripArrow>
    </nav>
  )
}

function StripArrow({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: React.ReactNode
}) {
  const shape =
    'flex w-10 shrink-0 items-center justify-center border transition-colors'
  if (!href) {
    return (
      <span
        aria-hidden
        className={clsx(shape, 'border-[var(--line-soft)] text-[var(--line)]')}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={clsx(
        shape,
        'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {children}
    </Link>
  )
}

const maxDay = (a: IsoDay, b: IsoDay): IsoDay => (a > b ? a : b)
