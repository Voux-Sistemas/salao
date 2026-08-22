import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
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
import { AgendaGrid, AgendaList } from '@/components/agenda-grid'
import { AppointmentPanel } from '@/components/appointment-panel'
import { UnitSwitcher } from '@/components/unit-switcher'
import { ButtonLink } from '@/components/ui'
import { IconChevronLeft, IconChevronRight } from '@/components/desk-icons'

export const metadata: Metadata = { title: 'Agenda' }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A GRELHA DO DIA. A loja vive na barra de endereços; o dia e a
 * marcação aberta também — assim o retrocesso funciona e a ligação
 * pode ser partilhada.
 *
 * A profissional vê só a agenda dela — e no telemóvel vê o dia em
 * lista, cartão a cartão, em vez da grelha.
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

  const [agenda, units, colorRows] = await Promise.all([
    loadAgendaDay(unit, day, { onlyStaffId }),
    unitsFor(actor),
    sql<{ id: string; display_color: string }[]>`
      select id, display_color from staff where org_id = ${unit.org_id}
    `,
  ])

  const colors = Object.fromEntries(
    colorRows.map((r) => [r.id, r.display_color]),
  )

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

  const appointmentCount = new Set(agenda.blocks.map((b) => b.appointmentId))
    .size
  const staffCount = agenda.columns.length

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-3.5rem)]">
      {/* a fita do dia ------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line-soft)] bg-[var(--surface-raised)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <NavArrow href={withDay(addDays(day, -1))} label="Dia anterior">
            <IconChevronLeft className="h-4 w-4" />
          </NavArrow>
          <NavArrow href={withDay(addDays(day, 1))} label="Dia seguinte">
            <IconChevronRight className="h-4 w-4" />
          </NavArrow>
        </div>

        <div className="min-w-0 leading-tight">
          <h1 className="display truncate text-lg text-[var(--ink)]">
            {capitalise(formatDayLong(day, unit.timezone))}
          </h1>
          <p className="truncate text-[0.6875rem] text-[var(--ink-faint)]">
            {unit.name} ·{' '}
            {appointmentCount === 1
              ? '1 marcação'
              : `${appointmentCount} marcações`}
            {onlyStaffId
              ? ''
              : staffCount === 1
                ? ' · 1 profissional'
                : ` · ${staffCount} profissionais`}
          </p>
        </div>

        {!isToday ? (
          <Link
            href={here}
            className="rounded-[2px] border border-[var(--accent)] px-2 py-1 text-[0.625rem] font-medium uppercase tracking-[0.1em] text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
          >
            Voltar a hoje
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

      {/* a grelha e o painel ----------------------------------------- */}
      <div className="relative flex min-h-0 flex-1">
        {/* Num ecrã estreito as colunas não cabem todas: este esbatido na
            margem direita é o que diz que o dia continua para o lado. Só
            faz sentido onde há mesmo mais do que uma coluna. */}
        {!onlyStaffId && agenda.columns.length > 1 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-[var(--surface)] to-transparent lg:hidden"
          />
        ) : null}
        <div className="min-w-0 flex-1 overflow-auto overscroll-contain">
          {onlyStaffId ? (
            <>
              {/* no telemóvel, o dia da profissional é uma lista */}
              <div className="md:hidden">
                <AgendaList agenda={agenda} hrefFor={hrefFor} nowMin={nowMin} />
              </div>
              <div className="hidden md:block">
                <AgendaGrid
                  agenda={agenda}
                  colors={colors}
                  selectedId={selectedId}
                  hrefFor={hrefFor}
                  nowMin={nowMin}
                />
              </div>
            </>
          ) : (
            <AgendaGrid
              agenda={agenda}
              colors={colors}
              selectedId={selectedId}
              hrefFor={hrefFor}
              nowMin={nowMin}
            />
          )}
        </div>

        {selected ? (
          <>
            {/* no telemóvel o painel cobre o ecrã; a sombra fecha-o */}
            <Link
              href={withDay(day)}
              scroll={false}
              aria-label="Fechar o painel"
              className="animate-fade fixed inset-0 z-40 bg-[rgba(20,15,8,0.4)] lg:hidden"
            />
            <div className="animate-fade fixed inset-y-0 right-0 z-50 w-full max-w-[24rem] overflow-hidden shadow-[var(--shadow-warm)] lg:static lg:z-auto lg:w-[23rem] lg:max-w-none lg:shrink-0 lg:animate-none lg:shadow-none">
              <AppointmentPanel
                actor={actor}
                appointment={selected}
                closeHref={withDay(day)}
                confirmSent={confirmSent}
              />
            </div>
          </>
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

function NavArrow({
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
      className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {children}
    </Link>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
