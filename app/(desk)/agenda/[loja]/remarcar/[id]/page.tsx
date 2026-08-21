import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
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
  formatDayLong,
  formatMinutes,
  formatTime,
  isoDay,
  minutesOfDay,
  parseMinutes,
  today,
  type IsoDay,
} from '@/lib/time'
import { Badge, Card, Input, Notice } from '@/components/ui'
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href={`/agenda/${unit.slug}?d=${originalDay}&m=${appointment.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à agenda
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Remarcar</p>
          <h1 className="display text-2xl text-[var(--ink)]">
            {appointment.client_name}
          </h1>
          <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
            Estava em {capitalise(formatDayLong(originalDay, tz))} às{' '}
            {formatTime(appointment.starts_at, tz)} · {unit.name}
          </p>
        </div>
        <Badge tone={STATUS_TONE[appointment.status]}>
          {STATUS_LABEL[appointment.status]}
        </Badge>
      </header>

      {locked ? (
        <Notice tone="warn">
          Esta marcação já está fechada — uma comanda fechada não se remarca.
        </Notice>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
          <div className="space-y-8">
            {/* --- serviços e quem faz --------------------------- */}
            <section>
              <h2 className="eyebrow mb-3">Serviços</h2>
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

            {/* --- confirmar ------------------------------------- */}
            {chosenAt ? (
              <section>
                <h2 className="eyebrow mb-3">A nova hora</h2>
                {plan ? (
                  <Card className="px-4 py-4">
                    <ul className="mb-4 space-y-1.5">
                      {plan.items.map((planItem) => (
                        <li
                          key={`${planItem.serviceId}-${planItem.startsAt.toISOString()}`}
                          className="flex items-baseline gap-2 text-[0.8125rem]"
                        >
                          <span className="tabular w-11 shrink-0 text-[var(--ink-muted)]">
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

          {/* --- dia e hora ------------------------------------- */}
          <aside className="lg:sticky lg:top-20">
            <Card className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="eyebrow">Quando</h2>
                <div className="flex items-center gap-1">
                  <DayArrow
                    href={link({
                      day: addDays(day, -1),
                      time: null,
                      hand: null,
                    })}
                    label="Dia anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </DayArrow>
                  <DayArrow
                    href={link({ day: addDays(day, 1), time: null, hand: null })}
                    label="Dia seguinte"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </DayArrow>
                </div>
              </div>

              <p className="mb-3 text-[0.8125rem] text-[var(--ink-muted)]">
                {capitalise(formatDayLong(day, tz))}
              </p>

              {problem === 'closed' ? (
                <Notice tone="warn">A loja não abre neste dia.</Notice>
              ) : null}

              {slots.length > 0 ? (
                <ul className="grid grid-cols-3 gap-1.5">
                  {slots.map((slot) => {
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
              ) : problem === null ? (
                <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                  Nenhuma hora certa está livre neste dia. Ainda pode escrever
                  uma à mão.
                </p>
              ) : null}

              <form method="get" action={here} className="mt-4 flex gap-2">
                <input type="hidden" name={DAY_PARAM} value={day} />
                <input
                  type="hidden"
                  name={CART_PARAM}
                  value={cartToParam(cart)}
                />
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
                  className="h-10 shrink-0 border border-[var(--line)] px-3 text-[0.8125rem] text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Usar
                </button>
              </form>
            </Card>
          </aside>
        </div>
      )}
    </div>
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
          ? 'border-[var(--accent)] text-[var(--accent)]'
          : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {label}
    </Link>
  )
}

function DayArrow({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center border border-[var(--line)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {children}
    </Link>
  )
}

const maxDay = (a: IsoDay, b: IsoDay): IsoDay => (a > b ? a : b)

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
