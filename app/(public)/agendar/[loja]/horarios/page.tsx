import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { availableSlots, type Slot } from '@/lib/availability'
import { formatCents } from '@/lib/money'
import {
  addDays,
  daysBetween,
  formatDayLong,
  formatDuration,
  formatMinutes,
  formatWeekdayShort,
  isoRange,
  today,
  type IsoDay,
} from '@/lib/time'
import { CART_PARAM, DAY_PARAM, first, funnelHref, parseCart } from '@/lib/cart'
import { Empty, Eyebrow, Notice } from '@/components/ui'
import { FunnelSteps } from '@/components/funnel-steps'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = { title: 'Horários' }

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Passo 3 — escolher o dia e a hora.
 *
 * Os horários oferecidos são os do CONJUNTO: já contam com a duração de
 * todos os serviços, com as folgas, com o intervalo entre eles e com o
 * recurso físico que cada um consome.
 */
export default async function TimesPage({ params, searchParams }: Params) {
  const { loja } = await params
  const query = await searchParams
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])
  if (!unit) notFound()

  const here = `/agendar/${unit.slug}`
  const cart = parseCart(query[CART_PARAM])

  // Cada passo revalida o anterior. Sem carrinho, volta-se atrás.
  if (cart.length === 0) redirect(here)

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  const firstDay = today(unit.timezone)
  const lastDay = addDays(firstDay, unit.max_lead_days)
  const asked = first(query[DAY_PARAM])
  const day: IsoDay =
    asked && ISO_DAY.test(asked)
      ? asked < firstDay
        ? firstDay
        : asked > lastDay
          ? lastDay
          : asked
      : firstDay

  const { slots, problem } = await availableSlots(unit, day, cart, 'online')

  const strip = isoRange(day, 7).filter((d) => d <= lastDay)
  const previous = day > firstDay ? maxDay(addDays(day, -7), firstDay) : null
  const next = addDays(day, 7) <= lastDay ? addDays(day, 7) : null

  const groups: { label: string; slots: Slot[] }[] = [
    { label: dict.funnel.morning, slots: slots.filter((s) => s.minutesOfDay < 12 * 60) },
    {
      label: dict.funnel.afternoon,
      slots: slots.filter((s) => s.minutesOfDay >= 12 * 60 && s.minutesOfDay < 18 * 60),
    },
    { label: dict.funnel.evening, slots: slots.filter((s) => s.minutesOfDay >= 18 * 60) },
  ].filter((group) => group.slots.length > 0)

  const sample = slots[0]?.plan

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-14 sm:py-20">
      <FunnelSteps
        current={3}
        dict={dict}
        hrefs={['/agendar', funnelHref(here, { cart }), null, null]}
      />

      <header className="mt-8">
        <Eyebrow>{unit.name}</Eyebrow>
        <h1 className="display mt-3 text-3xl sm:text-4xl">{dict.funnel.timeTitle}</h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--ink-muted)]">
          {dict.funnel.timeSubtitle}
        </p>
      </header>

      {/* -------------------------------------------------- os dias --- */}
      <nav className="mt-10 flex items-stretch gap-2" aria-label={dict.funnel.steps.time}>
        <StripArrow
          href={previous ? funnelHref(here + '/horarios', { cart, day: previous }) : null}
          label={dict.funnel.previousDay}
        >
          <ChevronLeft size={16} />
        </StripArrow>

        <ul className="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-7">
          {strip.map((value, index) => {
            const offset = daysBetween(firstDay, value)
            const label =
              offset === 0
                ? dict.funnel.today
                : offset === 1
                  ? dict.funnel.tomorrow
                  : null
            return (
              <li key={value} className={index > 3 ? 'hidden sm:block' : undefined}>
                <Link
                  href={funnelHref(here + '/horarios', { cart, day: value })}
                  aria-current={value === day ? 'date' : undefined}
                  className={clsx(
                    'flex h-16 flex-col items-center justify-center gap-0.5 border transition-colors',
                    value === day
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                      : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                  )}
                >
                  <span className="text-[0.625rem] uppercase tracking-[0.1em]">
                    {label ?? formatWeekdayShort(value, unit.timezone, language)}
                  </span>
                  <span className="tabular text-sm">{dayNumber(value)}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <StripArrow
          href={next ? funnelHref(here + '/horarios', { cart, day: next }) : null}
          label={dict.funnel.nextDay}
        >
          <ChevronRight size={16} />
        </StripArrow>
      </nav>

      <p className="mt-5 text-[0.8125rem] text-[var(--ink-muted)]">
        {formatDayLong(day, unit.timezone, language)}
      </p>

      {/* ------------------------------------------------- as horas --- */}
      {problem === 'too_far' ? (
        <div className="mt-8">
          <Notice tone="warn">{dict.errors.tooFar}</Notice>
        </div>
      ) : null}

      {slots.length === 0 ? (
        <Empty
          title={problem === 'closed' ? dict.unit.closedToday : dict.funnel.noSlots}
          hint={dict.funnel.noSlotsHint}
        />
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="eyebrow text-[var(--ink-faint)]">{group.label}</h2>
              <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {group.slots.map((slot) => (
                  <li key={slot.startsAt.toISOString()}>
                    <Link
                      href={funnelHref(here + '/confirmar', {
                        cart,
                        day,
                        time: slot.startsAt.toISOString(),
                      })}
                      className="tabular flex h-11 items-center justify-center border border-[var(--line-soft)] text-sm text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      {formatMinutes(slot.minutesOfDay)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {sample ? (
        <p className="tabular mt-10 border-t border-[var(--line-soft)] pt-5 text-[0.8125rem] text-[var(--ink-faint)]">
          {formatDuration(
            Math.round((sample.endsAt.getTime() - sample.startsAt.getTime()) / 60_000),
            language,
          )}{' '}
          · {formatCents(sample.totalCents, org.currency, language)}
        </p>
      ) : null}
    </div>
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

const dayNumber = (day: IsoDay): string => day.slice(8, 10)
