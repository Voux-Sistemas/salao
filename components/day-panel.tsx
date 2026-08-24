import Link from 'next/link'
import { sql } from '@/lib/db'
import type { Org, Unit } from '@/lib/org'
import type { Actor } from '@/lib/auth/actor'
import { can } from '@/lib/auth/actor'
import { formatCents } from '@/lib/money'
import {
  addDays,
  dayEnd,
  dayStart,
  formatTime,
  today,
  type IsoDay,
} from '@/lib/time'
import type { Status } from '@/lib/booking'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/status'
import { Badge, Card, Empty } from '@/components/ui'
import { shortName } from '@/lib/text'

/**
 * O PAINEL DO DIA. A raiz `/` é duas coisas: a montra para quem não tem
 * sessão, e isto para quem tem.
 *
 * Três blocos: hoje, o mês, a equipa. O recorte é o das lojas a que
 * esta pessoa tem acesso — e há uma linha por loja.
 *
 * As fronteiras de dia e de mês contam-se no fuso da rede; cada loja
 * mostra as suas horas no fuso dela.
 */

type TodayRow = {
  unit_id: string
  appointments: number
  no_shows: number
  revenue_cents: number
}

type NowRow = {
  id: string
  unit_slug: string
  unit_name: string
  unit_timezone: string
  status: Status
  starts_at: Date
  client_name: string
  services: string | null
  staff_names: string | null
}

type MonthRow = { current_cents: number; previous_cents: number }
type DailyRow = { day: string; cents: number }
type PendingRow = { cents: number; entries: number }
type TeamRow = {
  staff_id: string
  staff_name: string
  unit_name: string
  items: number
  cents: number
}
type ServiceRow = { name: string; times: number; cents: number }

export async function DayPanel({
  actor,
  org,
  units,
}: {
  actor: Actor
  org: Org
  units: Unit[]
}) {
  if (units.length === 0) {
    return (
      <div className="mx-auto max-w-[110rem] px-4 py-16 sm:px-6">
        <Empty
          title="Ainda não há lojas"
          hint="Crie a primeira loja em Gestão · Unidades para começar a marcar."
        />
      </div>
    )
  }

  const tz = org.timezone
  const now = new Date()
  const day = today(tz, now)

  const dayFrom = dayStart(day, tz)
  const dayTo = dayEnd(day, tz)

  const monthStart: IsoDay = `${day.slice(0, 7)}-01`
  const dayOfMonth = Number(day.slice(8, 10))
  const previousMonthStart = previousMonth(monthStart)
  // Compara-se período com período: do dia 1 até ao mesmo dia do mês.
  const previousSameDay = addDays(previousMonthStart, dayOfMonth - 1)

  const ids = units.map((u) => u.id)

  const [todayRows, nowRows, monthRows, dailyRows, pendingRows, team, services] =
    await Promise.all([
      sql<TodayRow[]>`
        select
          u.id as unit_id,
          (
            select count(*)::int from appointment a
             where a.unit_id = u.id
               and a.starts_at >= ${dayFrom} and a.starts_at < ${dayTo}
               and a.status not in ('cancelled_by_client','cancelled_by_salon')
          ) as appointments,
          (
            select count(*)::int from appointment a
             where a.unit_id = u.id
               and a.starts_at >= ${dayFrom} and a.starts_at < ${dayTo}
               and a.status = 'no_show'
          ) as no_shows,
          (
            select coalesce(sum(p.amount_cents), 0)::int from payment p
             where p.unit_id = u.id
               and p.received_at >= ${dayFrom} and p.received_at < ${dayTo}
          ) as revenue_cents
        from unit u
        where u.id = any(${ids}::uuid[])
      `,

      sql<NowRow[]>`
        select
          a.id, a.status, a.starts_at,
          u.slug as unit_slug, u.name as unit_name, u.timezone as unit_timezone,
          c.name as client_name,
          (
            select string_agg(ai.service_name, ' + ' order by ai.sort_order)
              from appointment_item ai where ai.appointment_id = a.id
          ) as services,
          (
            select string_agg(distinct s.name, ', ')
              from appointment_item ai
              join staff s on s.id = ai.staff_id
             where ai.appointment_id = a.id
          ) as staff_names
        from appointment a
        join unit u on u.id = a.unit_id
        join client c on c.id = a.client_id
        where a.unit_id = any(${ids}::uuid[])
          and a.starts_at >= ${dayFrom} and a.starts_at < ${dayTo}
          and a.status in ('booked','confirmed','checked_in','in_service')
        order by
          case a.status when 'in_service' then 0 when 'checked_in' then 1 else 2 end,
          a.starts_at
        limit 10
      `,

      sql<MonthRow[]>`
        select
          coalesce(sum(amount_cents) filter (
            where received_at >= ${dayStart(monthStart, tz)}
              and received_at < ${dayTo}
          ), 0)::int as current_cents,
          coalesce(sum(amount_cents) filter (
            where received_at >= ${dayStart(previousMonthStart, tz)}
              and received_at < ${dayEnd(previousSameDay, tz)}
          ), 0)::int as previous_cents
        from payment
        where unit_id = any(${ids}::uuid[])
      `,

      sql<DailyRow[]>`
        select
          to_char((p.received_at at time zone ${tz})::date, 'YYYY-MM-DD') as day,
          sum(p.amount_cents)::int as cents
        from payment p
        where p.unit_id = any(${ids}::uuid[])
          and p.received_at >= ${dayStart(monthStart, tz)}
          and p.received_at < ${dayTo}
        group by 1
        order by 1
      `,

      sql<PendingRow[]>`
        select
          coalesce(sum(amount_cents), 0)::int as cents,
          count(*)::int as entries
        from commission_entry
        where unit_id = any(${ids}::uuid[]) and status = 'pending'
      `,

      sql<TeamRow[]>`
        select
          s.id as staff_id, s.name as staff_name, u.name as unit_name,
          count(*)::int as items,
          coalesce(sum(ai.price_cents), 0)::int as cents
        from appointment_item ai
        join appointment a on a.id = ai.appointment_id
        join staff s on s.id = ai.staff_id
        join unit u on u.id = a.unit_id
        where a.unit_id = any(${ids}::uuid[])
          and a.status = 'completed'
          and a.starts_at >= ${dayStart(monthStart, tz)}
          and a.starts_at < ${dayTo}
        group by s.id, s.name, u.name
        order by cents desc
        limit 24
      `,

      sql<ServiceRow[]>`
        select
          ai.service_name as name,
          count(*)::int as times,
          coalesce(sum(ai.price_cents), 0)::int as cents
        from appointment_item ai
        join appointment a on a.id = ai.appointment_id
        where a.unit_id = any(${ids}::uuid[])
          and a.status = 'completed'
          and a.starts_at >= ${dayStart(monthStart, tz)}
          and a.starts_at < ${dayTo}
        group by 1
        order by cents desc
        limit 8
      `,
    ])

  const byUnit = new Map(todayRows.map((r) => [r.unit_id, r]))
  const totals = todayRows.reduce(
    (acc, r) => ({
      appointments: acc.appointments + r.appointments,
      noShows: acc.noShows + r.no_shows,
      revenue: acc.revenue + r.revenue_cents,
    }),
    { appointments: 0, noShows: 0, revenue: 0 },
  )

  // A escala das barras do «Por loja»: a casa mais cheia enche a barra.
  const maiorDia = Math.max(1, ...todayRows.map((r) => r.appointments))

  const month = monthRows[0] ?? { current_cents: 0, previous_cents: 0 }
  const pending = pendingRows[0] ?? { cents: 0, entries: 0 }
  const currency = org.currency

  const daily = fillMonth(monthStart, dayOfMonth, dailyRows)

  return (
    <div className="mx-auto max-w-[110rem] space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="display text-[1.75rem] leading-none text-[var(--ink)]">
          Hoje
        </h1>
        {/* A data ja esta na barra de cima; repeti-la aqui era mobilia.
            A linha diz antes o recorte: de que casas e este dia. */}
        <p className="mt-2 text-[0.875rem] text-[var(--ink-muted)]">
          {units.map((u) => u.name).join(' · ')}
        </p>
      </header>

      {/* ---------------------------------------------------- HOJE --- */}
      <section aria-label="O dia">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Marcações" value={String(totals.appointments)} />
          <Stat label="Faturação" value={formatCents(totals.revenue, currency)} />
          <Stat
            label="Faltas"
            value={String(totals.noShows)}
            tone={totals.noShows > 0 ? 'bad' : 'neutral'}
          />
        </div>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[1.4fr_1fr]">
          <Card className="overflow-hidden">
            <SectionTitle>A acontecer</SectionTitle>
            {nowRows.length === 0 ? (
              <p className="px-4 pb-5 text-sm text-[var(--ink-muted)]">
                Nada marcado para hoje.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line-soft)]">
                {nowRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/agenda/${row.unit_slug}?m=${row.id}`}
                      className="flex items-baseline gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-sunken)]"
                    >
                      <span className="tabular w-12 shrink-0 text-sm text-[var(--ink)]">
                        {formatTime(row.starts_at, row.unit_timezone)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-[var(--ink)]">
                          {row.client_name}
                        </span>
                        <span className="block truncate text-[0.75rem] text-[var(--ink-muted)]">
                          {row.services ?? '—'}
                          {row.staff_names ? ` · ${row.staff_names}` : ''}
                          {units.length > 1 ? ` · ${row.unit_name}` : ''}
                        </span>
                      </span>
                      <Badge tone={STATUS_TONE[row.status]}>
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* AS CASAS LADO A LADO, NÃO SÓ UMA A SEGUIR À OUTRA. Duas
              linhas de números não se comparam a olho: a barra faz a
              divisão que o cérebro ia ter de fazer. A escala é a casa
              com mais marcações — é uma comparação entre elas, não com
              um objetivo que ninguém definiu. */}
          <Card className="overflow-hidden">
            <SectionTitle>Por loja</SectionTitle>
            <ul className="divide-y divide-[var(--line-soft)]">
              {units.map((unit) => {
                const row = byUnit.get(unit.id)
                const marcacoes = row?.appointments ?? 0
                return (
                  <li key={unit.id} className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/agenda/${unit.slug}`}
                        className="truncate text-sm font-medium text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                      >
                        {unit.name}
                      </Link>
                      <span className="tabular shrink-0 text-[0.8125rem] font-semibold text-[var(--ink)]">
                        {formatCents(row?.revenue_cents ?? 0, currency)}
                      </span>
                    </div>
                    <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{
                          width: `${Math.round((marcacoes / maiorDia) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="tabular mt-1.5 text-[0.75rem] text-[var(--ink-faint)]">
                      {marcacoes} {marcacoes === 1 ? 'marcação' : 'marcações'}
                    </p>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </section>

      {/* ----------------------------------------------------- MÊS --- */}
      <section aria-label="O mês">
        <Header title="O mês" note={`Do dia 1 a ${dayOfMonth}`} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Faturação" value={formatCents(month.current_cents, currency)} />
          {/* A cor vai na variação, não no valor: pintar de verde o mês
              passado dizia que o mês passado é que estava bom. */}
          <Stat
            label="Mês anterior, mesmo período"
            value={formatCents(month.previous_cents, currency)}
            note={variation(month.current_cents, month.previous_cents)}
            noteTone={
              month.previous_cents === 0
                ? undefined
                : month.current_cents >= month.previous_cents
                  ? 'ok'
                  : 'bad'
            }
          />
          <Stat
            label="Comissões por pagar"
            value={formatCents(pending.cents, currency)}
            note={`${pending.entries} ${pending.entries === 1 ? 'linha' : 'linhas'}`}
            href={can.manageCommissions(actor) ? '/admin/comissoes' : undefined}
          />
        </div>

        <Card className="mt-3 px-4 py-4 sm:px-5">
          <SectionTitle bare>Dia a dia</SectionTitle>
          <MonthChart daily={daily} currency={currency} timezone={tz} />
        </Card>
      </section>

      {/* -------------------------------------------------- EQUIPA --- */}
      <section aria-label="A equipa">
        <Header title="A equipa" note="Produção do mês, por serviço concluído" />

        <div className="grid items-start gap-3 lg:grid-cols-[1.4fr_1fr]">
          <Card className="overflow-hidden">
            <SectionTitle>Por profissional</SectionTitle>
            {team.length === 0 ? (
              <p className="px-4 pb-5 text-sm text-[var(--ink-muted)]">
                Ainda não há serviços concluídos este mês.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line-soft)]">
                {team.map((row) => (
                  <li
                    key={`${row.staff_id}:${row.unit_name}`}
                    className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm text-[var(--ink)]">
                      {shortName(row.staff_name)}
                      {units.length > 1 ? (
                        <span className="text-[var(--ink-faint)]">
                          {' '}
                          · {row.unit_name}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink-muted)]">
                      {row.items} · {formatCents(row.cents, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionTitle>Serviços mais faturados</SectionTitle>
            {services.length === 0 ? (
              <p className="px-4 pb-5 text-sm text-[var(--ink-muted)]">
                Sem dados este mês.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line-soft)]">
                {services.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm text-[var(--ink)]">
                      {row.name}
                    </span>
                    <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink-muted)]">
                      {row.times}× · {formatCents(row.cents, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------

function Header({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-4">
      <h2 className="panel-title">{title}</h2>
      <p className="text-[0.8125rem] text-[var(--ink-muted)]">{note}</p>
    </div>
  )
}

function SectionTitle({
  children,
  bare = false,
}: {
  children: React.ReactNode
  bare?: boolean
}) {
  return (
    <p
      className={
        bare
          ? 'panel-title mb-3'
          : 'panel-title border-b border-[var(--line-soft)] px-4 py-3.5'
      }
    >
      {children}
    </p>
  )
}

/**
 * O NÚMERO PRIMEIRO, O RÓTULO DEPOIS — mas a ler-se de cima para baixo.
 * O rótulo era um versalete espaçado que competia com o valor; agora é
 * uma linha discreta e o número fica com a mancha toda para ele.
 *
 * Com `href`, a ficha passa a porta: ganha o realce da borda ao passar
 * o rato, em vez de ir embrulhada num `<Link>` que não se via ser uma.
 */
function Stat({
  label,
  value,
  note,
  tone = 'neutral',
  noteTone,
  href,
}: {
  label: string
  value: string
  note?: string
  tone?: 'neutral' | 'ok' | 'warn' | 'bad'
  noteTone?: 'ok' | 'warn' | 'bad'
  href?: string
}) {
  const TONS = {
    neutral: 'var(--ink)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
  }
  const colour = TONS[tone]

  const corpo = (
    <>
      <p className="text-[0.8125rem] font-medium text-[var(--ink-muted)]">
        {label}
      </p>
      <p
        className="metric mt-2 text-[1.5rem] sm:text-[1.75rem]"
        style={{ color: colour }}
      >
        {value}
      </p>
      {note ? (
        noteTone ? (
          <p
            className="mt-2 inline-flex rounded-full px-1.5 py-[0.1875rem] text-[0.75rem] font-semibold leading-none"
            style={{
              color: TONS[noteTone],
              background: `color-mix(in srgb, ${TONS[noteTone]} 12%, transparent)`,
            }}
          >
            {note}
          </p>
        ) : (
          <p className="mt-1.5 text-[0.75rem] text-[var(--ink-faint)]">{note}</p>
        )
      ) : null}
    </>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className="h-full px-4 py-4 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]">
          {corpo}
        </Card>
      </Link>
    )
  }

  return <Card className="h-full px-4 py-4">{corpo}</Card>
}

/**
 * Um gráfico de barras sem biblioteca nenhuma: são divs com altura em
 * percentagem. Serve o propósito — ver a forma do mês.
 *
 * O dia de hoje vai na segunda cor: é o único que ainda não fechou, e
 * ficar mais baixo do que os outros não quer dizer mau dia — quer dizer
 * meio-dia. Sem isso, a última barra mentia todas as manhãs.
 */
function MonthChart({
  daily,
  currency,
  timezone,
}: {
  daily: DailyRow[]
  currency: string
  timezone: string
}) {
  const peak = Math.max(1, ...daily.map((d) => d.cents))
  const ultimo = daily.length - 1

  return (
    <div className="flex h-32 items-end gap-[3px] border-b border-[var(--line-soft)] pb-px">
      {daily.map((d, i) => (
        <div
          key={d.day}
          className="group relative flex-1"
          title={`${d.day.slice(8)} · ${formatCents(d.cents, currency)}`}
        >
          <div
            className="w-full rounded-t-[3px] transition-opacity group-hover:opacity-70"
            style={{
              height: `${Math.round((d.cents / peak) * 116)}px`,
              minHeight: d.cents > 0 ? '3px' : '2px',
              background: i === ultimo ? 'var(--gold)' : 'var(--accent)',
              opacity: d.cents > 0 ? 1 : 0.14,
            }}
          />
        </div>
      ))}
      <span className="sr-only">
        Faturação diária do mês, no fuso {timezone}.
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------
// Contas de calendário e de texto
// ---------------------------------------------------------------------

function previousMonth(monthStart: IsoDay): IsoDay {
  const year = Number(monthStart.slice(0, 4))
  const month = Number(monthStart.slice(5, 7))
  return month === 1
    ? `${year - 1}-12-01`
    : `${year}-${String(month - 1).padStart(2, '0')}-01`
}

/** Os dias do mês até hoje, com zeros nos dias sem dinheiro. */
function fillMonth(
  monthStart: IsoDay,
  days: number,
  rows: DailyRow[],
): DailyRow[] {
  const found = new Map(rows.map((r) => [r.day, r.cents]))
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(monthStart, i)
    return { day, cents: found.get(day) ?? 0 }
  })
}

/**
 * A variação em três caracteres. A frase inteira («face ao mês
 * anterior») estava a repetir o rótulo da ficha, que já diz que aquele
 * número é o do mês passado no mesmo período.
 */
function variation(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'sem comparação' : '—'
  const percent = Math.round(((current - previous) / previous) * 100)
  const sign = percent > 0 ? '+' : ''
  return `${sign}${percent}%`
}

