import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { requireActor, resolveUnit, unitsFor, can } from '@/lib/auth/actor'
import { loadAgendaDay } from '@/lib/agenda'
import { getAppointment } from '@/lib/booking'
import { sql } from '@/lib/db'
import {
  addDays,
  dayStart,
  formatDayLong,
  today,
  type IsoDay,
} from '@/lib/time'
import { AgendaGrid } from '@/components/agenda-grid'
import { AppointmentPanel } from '@/components/appointment-panel'
import { UnitSwitcher } from '@/components/unit-switcher'
import { ButtonLink } from '@/components/ui'

export const metadata: Metadata = { title: 'Agenda' }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A GRELHA DO DIA. A loja vive na barra de endereços; o dia e a
 * marcação aberta também — assim o retrocesso funciona e a ligação
 * pode ser partilhada.
 */
export default async function AgendaDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ loja: string }>
  searchParams: Promise<{ d?: string; m?: string }>
}) {
  const actor = await requireActor()
  const { loja } = await params
  const { d, m } = await searchParams

  // Loja inexistente e loja sem acesso dão a MESMA resposta.
  const unit = await resolveUnit(actor, loja)

  const now = new Date()
  const day: IsoDay = d && DAY_RE.test(d) ? d : today(unit.timezone, now)

  // A profissional vê só a agenda dela.
  const onlyStaffId = actor.role === 'professional' ? actor.id : null

  const [agenda, units] = await Promise.all([
    loadAgendaDay(unit, day, { onlyStaffId }),
    unitsFor(actor),
  ])

  const selectedId = m && UUID_RE.test(m) ? m : null
  const selected = selectedId ? await getAppointment(selectedId) : null

  // Marcação de outra loja (ou de outra rede) não se abre aqui.
  if (selected && selected.unit_id !== unit.id) notFound()
  if (
    selected &&
    onlyStaffId &&
    !selected.items.some((i) => i.staff_id === onlyStaffId)
  ) {
    notFound()
  }

  const confirmSent = selected ? await hasConfirm(selected.id) : false

  const here = `/agenda/${unit.slug}`
  const withDay = (target: IsoDay) => `${here}?d=${target}`
  const hrefFor = (appointmentId: string | null) =>
    appointmentId ? `${withDay(day)}&m=${appointmentId}` : withDay(day)

  const isToday = day === today(unit.timezone, now)
  const nowMin = isToday
    ? Math.round((now.getTime() - dayStart(day, unit.timezone).getTime()) / 60_000)
    : null

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <NavLink href={withDay(addDays(day, -1))} label="Dia anterior">
            <ChevronLeft className="h-4 w-4" />
          </NavLink>
          <NavLink href={withDay(addDays(day, 1))} label="Dia seguinte">
            <ChevronRight className="h-4 w-4" />
          </NavLink>
        </div>

        <h1 className="display text-lg text-[var(--ink)]">
          {capitalise(formatDayLong(day, unit.timezone))}
        </h1>

        {!isToday ? (
          <Link
            href={here}
            className="text-[0.75rem] text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
          >
            hoje
          </Link>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          <UnitSwitcher
            units={units}
            current={unit.slug}
            base="/agenda"
            showAll={false}
          />
          {can.overrideLeadRules(actor) ? (
            <ButtonLink href={`${here}/encaixe?d=${day}`} size="sm">
              Encaixe
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          <AgendaGrid
            agenda={agenda}
            selectedId={selectedId}
            hrefFor={hrefFor}
            nowMin={nowMin}
          />
        </div>

        {selected ? (
          <div className="w-[22rem] shrink-0 overflow-hidden">
            <AppointmentPanel
              actor={actor}
              appointment={selected}
              closeHref={withDay(day)}
              confirmSent={confirmSent}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

async function hasConfirm(appointmentId: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1 from notification_log
       where appointment_id = ${appointmentId} and routine = 'confirm'
    ) as exists
  `
  return rows[0]?.exists ?? false
}

function NavLink({
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
      className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-[var(--line)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {children}
    </Link>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
