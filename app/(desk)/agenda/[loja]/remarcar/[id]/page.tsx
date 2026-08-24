import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ArrowLeft, MoveRight } from 'lucide-react'
import { requireManagement, resolveUnit } from '@/lib/auth/actor'
import {
  buildPlan,
  loadDayContext,
  slotsFrom,
  type CartLine,
  type Plan,
} from '@/lib/availability'
import { getAppointment } from '@/lib/booking'
import {
  CART_PARAM,
  DAY_PARAM,
  TIME_PARAM,
  cartToParam,
  first,
  parseCart,
  setStaffAt,
} from '@/lib/cart'
import { sql } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/status'
import {
  addDays,
  atMinutes,
  daysBetween,
  formatDayLong,
  formatDayShort,
  formatMinutes,
  formatTime,
  formatWeekdayShort,
  isoDay,
  isoRange,
  minutesOfDay,
  parseMinutes,
  today,
  type IsoDay,
} from '@/lib/time'
import { Badge, Card, Input, Notice, buttonClass } from '@/components/ui'
import { DeskDayStrip } from '@/components/desk-day-strip'
import { RemarcarForm } from '@/components/remarcar-form'

export const metadata: Metadata = { title: 'Remarcar' }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const HAND_PARAM = 'hm'

type SkillRow = { service_id: string; staff_id: string; staff_name: string }

type Params = {
  params: Promise<{ loja: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * REMARCAR. Os serviços são os que já estavam; muda-se a hora e, se for
 * caso disso, quem faz. A marcação antiga sai da agenda e a nova fica a
 * apontar para ela.
 *
 * Os blocos da antiga não contam como ocupação — senão a marcação
 * impedia-se a si mesma de mudar de hora.
 */
export default async function RemarcarPage({ params, searchParams }: Params) {
  const actor = await requireManagement()
  const { loja, id } = await params
  const query = await searchParams

  if (!UUID_RE.test(id)) notFound()

  const unit = await resolveUnit(actor, loja)
  const appointment = await getAppointment(id)

  if (
    !appointment ||
    appointment.org_id !== actor.orgId ||
    appointment.unit_id !== unit.id
  ) {
    notFound()
  }

  const tz = unit.timezone
  const now = new Date()
  const originalDay = isoDay(appointment.starts_at, tz)

  const askedDay = first(query[DAY_PARAM])
  const day: IsoDay =
    askedDay && DAY_RE.test(askedDay) ? askedDay : maxDay(originalDay, today(tz, now))

  // Quem pode fazer cada um destes serviços nesta loja. Ao balcão não há
  // filtro de marcação online.
  const skills = await sql<SkillRow[]>`
    select ss.service_id, s.id as staff_id, s.name as staff_name
      from staff_skill ss
      join staff s on s.id = ss.staff_id
      join staff_unit su on su.staff_id = s.id and su.unit_id = ${unit.id}
     where s.org_id = ${actor.orgId}
       and s.is_active
       and ss.service_id = any(${appointment.items.map((i) => i.service_id)}::uuid[])
     order by s.sort_order, s.name
  `

  const staffByService = new Map<string, SkillRow[]>()
  for (const row of skills) {
    const list = staffByService.get(row.service_id) ?? []
    list.push(row)
    staffByService.set(row.service_id, list)
  }

  // O carrinho é o da marcação. Do endereço só se aceita a troca de
  // profissional — mudar de serviço é outra marcação, não uma remarcação.
  const base: CartLine[] = appointment.items.map((item) => ({
    serviceId: item.service_id,
    staffId: item.staff_id,
  }))
  const asked = parseCart(query[CART_PARAM])
  const usable =
    asked.length === base.length &&
    asked.every((line, index) => line.serviceId === base[index]?.serviceId)
  const cart: CartLine[] = (usable ? asked : base).map((line) => {
    if (!line.staffId) return line
    const eligible = staffByService.get(line.serviceId) ?? []
    return eligible.some((s) => s.staff_id === line.staffId)
      ? line
      : { ...line, staffId: null }
  })

  const context = await loadDayContext(unit, day, cart, 'counter', now, {
    excludeAppointmentId: appointment.id,
  })
  const ctx = typeof context === 'string' ? null : context
  const problem = typeof context === 'string' ? context : null
  const slots = ctx ? slotsFrom(ctx) : []

  const hand = first(query[HAND_PARAM])
  const handMinutes = hand ? parseMinutes(hand) : null
  const askedTime = first(query[TIME_PARAM])
  const chosenAt: Date | null =
    handMinutes !== null
      ? atMinutes(day, handMinutes, tz)
      : askedTime && !Number.isNaN(Date.parse(askedTime))
        ? new Date(askedTime)
        : null

  const plan: Plan | null =
    ctx && chosenAt ? buildPlan(ctx, chosenAt.getTime()) : null

  const here = `/agenda/${unit.slug}/remarcar/${appointment.id}`
  const link = (next: {
    cart?: CartLine[]
    day?: IsoDay
    time?: string | null
    hand?: string | null
  }): string => {
    const value = new URLSearchParams()
    value.set(CART_PARAM, cartToParam(next.cart ?? cart))
    value.set(DAY_PARAM, next.day ?? day)
    const time = next.time === undefined ? askedTime : next.time
    if (time) value.set(TIME_PARAM, time)
    const handValue = next.hand === undefined ? hand : next.hand
    if (handValue) value.set(HAND_PARAM, handValue)
    return `${here}?${value.toString()}`
  }

  const withCart = (nextCart: CartLine[]) =>
    link({ cart: nextCart, time: null, hand: null })

  const locked = appointment.closed_at !== null

  // --- a fita de dias: sete de cada vez, ancorada em hoje ------------
  const todayDay = today(tz, now)
  const stripAnchor = addDays(
    todayDay,
    Math.max(0, Math.floor(daysBetween(todayDay, day) / 7)) * 7,
  )
  const stripDays = isoRange(stripAnchor, 7)
  const stripPrev =
    stripAnchor > todayDay ? maxDay(addDays(stripAnchor, -7), todayDay) : null

  // --- as horas, por período de dia ----------------------------------
  const periods = [
    { label: 'Manhã', slots: slots.filter((s) => s.minutesOfDay < 12 * 60) },
    {
      label: 'Tarde',
      slots: slots.filter(
        (s) => s.minutesOfDay >= 12 * 60 && s.minutesOfDay < 18 * 60,
      ),
    },
    { label: 'Noite', slots: slots.filter((s) => s.minutesOfDay >= 18 * 60) },
  ].filter((period) => period.slots.length > 0)

  const totalCents = appointment.items.reduce((s, i) => s + i.price_cents, 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/agenda/${unit.slug}?d=${originalDay}&m=${appointment.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à agenda
      </Link>

      <header className="mb-6">
        <p className="eyebrow mb-1.5">Remarcar · {unit.name}</p>
        <h1 className="display text-3xl text-[var(--ink)]">
          {appointment.client_name}
        </h1>
      </header>

      {/* --- a marcação original, num cartão pequeno ----------------- */}
      <Card className="mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-l-2 border-l-[var(--accent)] px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[0.625rem] font-medium uppercase tracking-[0.05em] text-[var(--ink-faint)]">
            Está marcada para
          </p>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {capitalise(formatDayLong(originalDay, tz))} às{' '}
            <span className="tabular font-medium">
              {formatTime(appointment.starts_at, tz)}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">
            {appointment.items.map((item) => item.service_name).join(' · ')}
            {' · '}
            <span className="tabular">{formatCents(totalCents)}</span>
          </p>
        </div>
        <Badge tone={STATUS_TONE[appointment.status]}>
          {STATUS_LABEL[appointment.status]}
        </Badge>
      </Card>

      {locked ? (
        <Notice tone="warn">
          Esta marcação já está fechada — uma comanda fechada não se remarca.
        </Notice>
      ) : (
        <div className="space-y-10">
          {/* --- serviços e quem faz ------------------------------- */}
          <section>
            <SectionTitle>Serviços e quem faz</SectionTitle>
            <Card className="divide-y divide-[var(--line-soft)]">
              {cart.map((line, index) => {
                const item = appointment.items[index]
                const eligible = staffByService.get(line.serviceId) ?? []
                if (!item) return null
                return (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                        {item.service_name}
                      </span>
                      <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink-muted)]">
                        {item.duration_minutes} min ·{' '}
                        {formatCents(item.price_cents)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StaffChip
                        href={withCart(setStaffAt(cart, index, null))}
                        label="Sem preferência"
                        active={line.staffId === null}
                      />
                      {eligible.map((option) => (
                        <StaffChip
                          key={option.staff_id}
                          href={withCart(
                            setStaffAt(cart, index, option.staff_id),
                          )}
                          label={option.staff_name}
                          active={line.staffId === option.staff_id}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </Card>
            <p className="mt-2 text-[0.75rem] text-[var(--ink-faint)]">
              O preço e a duração ficaram congelados na marcação e assim se
              mantêm.
            </p>
          </section>

          {/* --- o novo dia e a nova hora -------------------------- */}
          <section>
            <SectionTitle>O novo dia</SectionTitle>
            <DeskDayStrip
              days={stripDays}
              active={day}
              today={todayDay}
              timezone={tz}
              hrefFor={(value) => link({ day: value, time: null, hand: null })}
              prevHref={
                stripPrev ? link({ day: stripPrev, time: null, hand: null }) : null
              }
              nextHref={link({
                day: addDays(stripAnchor, 7),
                time: null,
                hand: null,
              })}
            />
            <p className="mt-3 text-[0.8125rem] text-[var(--ink-muted)]">
              {capitalise(formatDayLong(day, tz))}
            </p>

            {problem === 'closed' ? (
              <div className="mt-4">
                <Notice tone="warn">A loja não abre neste dia.</Notice>
              </div>
            ) : null}

            {periods.length > 0 ? (
              <div className="mt-4 space-y-4">
                {periods.map((period) => (
                  <div key={period.label}>
                    <p className="mb-1.5 text-[0.625rem] font-medium uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                      {period.label}
                    </p>
                    <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                      {period.slots.map((slot) => {
                        const iso = slot.startsAt.toISOString()
                        const active =
                          chosenAt !== null &&
                          chosenAt.getTime() === slot.startsAt.getTime()
                        return (
                          <li key={iso}>
                            <Link
                              href={link({ time: iso, hand: null })}
                              className={clsx(
                                'tabular flex h-9 items-center justify-center border text-[0.8125rem] transition-colors',
                                active
                                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                                  : 'border-[var(--line-soft)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                              )}
                            >
                              {formatMinutes(slot.minutesOfDay)}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : problem === null ? (
              <p className="mt-4 text-[0.8125rem] text-[var(--ink-muted)]">
                Nenhuma hora certa está livre neste dia. Ainda pode escrever
                uma à mão.
              </p>
            ) : null}

            {/* A hora à mão: fora da grelha, à moda do balcão. Sem a
                legenda ficava uma caixa "--:--" sem explicação nenhuma
                por baixo da grelha das horas. */}
            <form
              method="get"
              action={here}
              className="mt-5 border-t border-[var(--line-soft)] pt-4"
            >
              <p className="eyebrow mb-2 text-[var(--ink-faint)]">
                Ou uma hora à mão
              </p>
              <input type="hidden" name={DAY_PARAM} value={day} />
              <input
                type="hidden"
                name={CART_PARAM}
                value={cartToParam(cart)}
              />
              <div className="flex gap-2">
                <Input
                  type="time"
                  name={HAND_PARAM}
                  step={300}
                  defaultValue={
                    chosenAt ? formatMinutes(minutesOfDay(chosenAt, tz)) : ''
                  }
                  className="tabular max-w-[8rem]"
                  aria-label="Hora à mão"
                />
                <button
                  type="submit"
                  className={buttonClass('outline', 'md', 'shrink-0')}
                >
                  Usar
                </button>
              </div>
            </form>
          </section>

          {/* --- confirmar ----------------------------------------- */}
          {chosenAt ? (
            <section>
              <SectionTitle>Confirmar</SectionTitle>
              {plan ? (
                <Card className="px-4 py-4">
                  <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dashed border-[var(--line)] pb-3.5 text-[0.8125rem]">
                    <span className="tabular text-[var(--ink-muted)] line-through decoration-[var(--ink-faint)]">
                      {stamp(originalDay, appointment.starts_at, tz)}
                    </span>
                    <MoveRight
                      className="h-3.5 w-3.5 text-[var(--accent)]"
                      aria-hidden
                    />
                    <span className="tabular font-medium text-[var(--ink)]">
                      {stamp(isoDay(plan.startsAt, tz), plan.startsAt, tz)}
                    </span>
                  </div>
                  <ul className="mb-4 space-y-1.5">
                    {plan.items.map((planItem) => (
                      <li
                        key={`${planItem.serviceId}-${planItem.startsAt.toISOString()}`}
                        className="flex items-baseline gap-2 text-[0.8125rem]"
                      >
                        <span className="tabular w-11 shrink-0 text-[var(--accent)]">
                          {formatTime(planItem.startsAt, tz)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[var(--ink)]">
                          {planItem.serviceName}
                        </span>
                        <span className="shrink-0 truncate text-[var(--ink-muted)]">
                          {planItem.staffName}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <RemarcarForm
                    unitSlug={unit.slug}
                    appointmentId={appointment.id}
                    cartParam={cartToParam(cart)}
                    timeIso={plan.startsAt.toISOString()}
                  />
                </Card>
              ) : (
                <Notice tone="warn">
                  Nessa hora não dá: alguém ou algum recurso não está livre,
                  ou a loja está fechada. Escolha outra.
                </Notice>
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-3">
      <span className="eyebrow">{children}</span>
      <span className="h-px flex-1 bg-[var(--line-soft)]" aria-hidden />
    </h2>
  )
}

function StaffChip({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'border px-2 py-0.5 text-[0.6875rem] transition-colors',
        active
          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]'
          : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {label}
    </Link>
  )
}

/** "Qua 26/08 · 10:00" — o carimbo curto de um momento. */
function stamp(day: IsoDay, instant: Date, timezone: string): string {
  const weekday = capitalise(formatWeekdayShort(day, timezone).replace(/\./g, ''))
  return `${weekday} ${formatDayShort(day, timezone)} · ${formatTime(instant, timezone)}`
}

const maxDay = (a: IsoDay, b: IsoDay): IsoDay => (a > b ? a : b)

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
