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
import { Empty, Notice } from '@/components/ui'
import { FunnelShell, VisitSummary } from '@/components/funnel-shell'
import { Reveal } from '@/components/reveal'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: 'Horários',
  // O dia escolhido está no endereço: cada visita tem o seu, e nenhum
  // deles é uma página que valha a pena guardar num índice.
  robots: { index: false, follow: false },
}

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
    {
      label: dict.funnel.morning,
      slots: slots.filter((s) => s.minutesOfDay < 12 * 60),
    },
    {
      label: dict.funnel.afternoon,
      slots: slots.filter((s) => s.minutesOfDay >= 12 * 60 && s.minutesOfDay < 18 * 60),
    },
    {
      label: dict.funnel.evening,
      slots: slots.filter((s) => s.minutesOfDay >= 18 * 60),
    },
  ].filter((group) => group.slots.length > 0)

  const sample = slots[0]?.plan

  return (
    <FunnelShell
      step={3}
      dict={dict}
      hrefs={['/agendar', funnelHref(here, { cart }), null, null]}
      eyebrow={unit.name}
      title={dict.funnel.timeTitle}
      subtitle={dict.funnel.timeSubtitle}
      aside={
        sample ? (
          <VisitSummary
            title={dict.funnel.yourVisit}
            lines={sample.items.map((item) => ({
              label: item.serviceName,
              meta: `${item.staffName} · ${formatDuration(item.durationMinutes, language)}`,
              value: formatCents(item.priceCents, org.currency, language),
            }))}
            total={{
              label: dict.common.total,
              value: formatCents(sample.totalCents, org.currency, language),
            }}
            footer={
              <div className="flex items-baseline justify-between text-[0.75rem]">
                <span className="text-[var(--ink-muted)]">{dict.common.duration}</span>
                <span className="tabular text-[var(--ink)]">
                  {formatDuration(
                    Math.round(
                      (sample.endsAt.getTime() - sample.startsAt.getTime()) / 60_000,
                    ),
                    language,
                  )}
                </span>
              </div>
            }
          />
        ) : null
      }
    >
      {/* -------------------------------------------------- os dias --- */}
      <nav className="flex items-stretch gap-2" aria-label={dict.funnel.steps.time}>
        <StripArrow
          href={
            previous ? funnelHref(here + '/horarios', { cart, day: previous }) : null
          }
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
                    'flex h-[4.75rem] flex-col items-center justify-center gap-1 border transition-all duration-200',
                    value === day
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] shadow-[var(--shadow-soft)]'
                      : 'border-[var(--line-soft)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:-translate-y-0.5 hover:border-[var(--accent)] hover:text-[var(--accent)]',
                  )}
                >
                  <span className="text-[0.5625rem] uppercase tracking-[0.14em]">
                    {label ?? formatWeekdayShort(value, unit.timezone, language)}
                  </span>
                  <span className="tabular display text-xl leading-none">
                    {dayNumber(value)}
                  </span>
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

      {/* A data por extenso, em serifa: é o cabeçalho do que vem abaixo. */}
      <div className="mt-8 flex items-baseline gap-4">
        <h2 className="display text-xl text-[var(--ink)] first-letter:uppercase">
          {formatDayLong(day, unit.timezone, language)}
        </h2>
        <span className="h-px flex-1 bg-[var(--line-soft)]" />
        {slots.length > 0 ? (
          <span className="tabular shrink-0 text-[0.6875rem] text-[var(--ink-faint)]">
            {slots.length} {dict.funnel.slotsAvailable}
          </span>
        ) : null}
      </div>

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
        <div className="mt-7 space-y-9">
          {groups.map((group, groupIndex) => (
            <Reveal key={group.label} delay={groupIndex * 70}>
              <section>
                <div className="flex items-center gap-3">
                  <h3 className="eyebrow text-[var(--ink-faint)]">{group.label}</h3>
                  <span className="h-px flex-1 bg-[var(--line-soft)]" />
                </div>
                <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {group.slots.map((slot) => (
                    <li key={slot.startsAt.toISOString()}>
                      <Link
                        href={funnelHref(here + '/confirmar', {
                          cart,
                          day,
                          time: slot.startsAt.toISOString(),
                        })}
                        className="tabular flex h-12 items-center justify-center border border-[var(--line-soft)] bg-[var(--surface-raised)] text-sm text-[var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] hover:shadow-[var(--shadow-soft)]"
                      >
                        {formatMinutes(slot.minutesOfDay)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ))}
        </div>
      )}

    </FunnelShell>
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
