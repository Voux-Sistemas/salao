import Link from 'next/link'
import type { Metadata } from 'next'
import { can, requireManagement, type Actor } from '@/lib/auth/actor'
import { sql } from '@/lib/db'
import {
  commissionStandings,
  monthKpis,
  revenueByDay,
  todayByUnit,
  topServices,
} from '@/lib/dashboard'
import { formatCents } from '@/lib/money'
import { requireOrg } from '@/lib/org'
import { dayStart, formatDayLong, formatTime, today } from '@/lib/time'
import {
  ChartLegend,
  Delta,
  RevenueChart,
  ServiceBars,
  type SeriesTone,
} from '@/components/charts'
import { Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Gestão' }

const TONES: SeriesTone[] = ['accent', 'gold']

type Counts = {
  units: number
  services: number
  staff: number
  pending_cents: number
}

/** O que há em cada separador, em número — para se saber por onde ir. */
async function counts(actor: Actor): Promise<Counts> {
  const rows = await sql<Counts[]>`
    select
      (select count(*)::int from unit where org_id = ${actor.orgId} and is_active) as units,
      (select count(*)::int from service where org_id = ${actor.orgId} and is_active) as services,
      (select count(*)::int from staff s
        where s.org_id = ${actor.orgId} and s.is_active
          and (${actor.orgScope}::boolean or exists (
                select 1 from staff_unit su
                 where su.staff_id = s.id
                   and su.unit_id = any(${actor.unitIds}::uuid[])
              ))) as staff,
      (select coalesce(sum(amount_cents), 0)::int from commission_entry
        where org_id = ${actor.orgId} and status = 'pending') as pending_cents
  `
  return rows[0] ?? { units: 0, services: 0, staff: 0, pending_cents: 0 }
}

export default async function AdminPage() {
  const actor = await requireManagement()

  // A gerente não vê as contas da rede — vê as portas por onde pode ir.
  if (!can.manageCommissions(actor)) {
    return <ManagerTiles actor={actor} />
  }

  const org = await requireOrg()
  const tz = org.timezone

  const [history, kpis, services, standings, unitsToday, total] =
    await Promise.all([
      revenueByDay(actor.orgId, tz),
      monthKpis(actor.orgId, tz),
      topServices(actor.orgId, tz),
      commissionStandings(actor.orgId),
      todayByUnit(actor.orgId, tz),
      counts(actor),
    ])

  const monthName = (day: string) =>
    new Intl.DateTimeFormat('pt-PT', { month: 'long', timeZone: tz }).format(
      dayStart(day, tz),
    )
  const prevName = monthName(kpis.previous_start)

  const chartSeries = history.units.map((unit, i) => ({
    name: unit.name,
    values: unit.values,
    tone: TONES[i % TONES.length]!,
  }))

  const pendingStaff = standings.filter((s) => s.pending_cents > 0)
  const pendingTotal = pendingStaff.reduce((sum, s) => sum + s.pending_cents, 0)
  const paidTotal = standings.reduce((sum, s) => sum + s.paid_cents, 0)

  return (
    <div className="space-y-8">
      {/* --- o mês, em quatro números ------------------------------- */}
      <section aria-label="Indicadores do mês">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">
            {monthName(kpis.current_start)} até hoje
          </h2>
          <p className="text-[0.75rem] text-[var(--ink-faint)]">
            comparado com igual período de {prevName}
          </p>
        </div>
        {/* Dois a dois já no telemóvel: em coluna única, os quatro números
            do mês ocupavam um ecrã e meio e nunca se viam ao mesmo tempo —
            que é a única coisa que se quer fazer com eles. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Faturação"
            value={formatCents(kpis.current.revenue_cents)}
            delta={
              <Delta
                current={kpis.current.revenue_cents}
                previous={kpis.previous.revenue_cents || null}
              />
            }
            versus={prevName}
          />
          <Kpi
            label="Marcações concluídas"
            value={String(kpis.current.completed)}
            delta={
              <Delta
                current={kpis.current.completed}
                previous={kpis.previous.completed || null}
              />
            }
            versus={prevName}
          />
          <Kpi
            label="Ticket médio"
            value={
              kpis.current.avg_ticket_cents !== null
                ? formatCents(kpis.current.avg_ticket_cents)
                : '—'
            }
            delta={
              <Delta
                current={kpis.current.avg_ticket_cents ?? 0}
                previous={kpis.previous.avg_ticket_cents}
              />
            }
            versus={prevName}
          />
          <Kpi
            label="Taxa de no-show"
            value={formatRate(kpis.current.no_show_rate)}
            delta={
              <Delta
                current={kpis.current.no_show_rate ?? 0}
                previous={kpis.previous.no_show_rate}
                goodWhenUp={false}
                points
              />
            }
            versus={prevName}
          />
        </div>
      </section>

      {/* --- a faturação, dia a dia --------------------------------- */}
      <section aria-label="Faturação diária">
        <Card className="px-5 py-5 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <p className="eyebrow mb-1">Faturação · últimas seis semanas</p>
              <p className="display tabular text-2xl leading-none text-[var(--ink)]">
                {formatCents(history.total_cents)}
              </p>
            </div>
            <ChartLegend
              items={history.units.map((unit, i) => ({
                name: unit.name,
                tone: TONES[i % TONES.length]!,
                total_cents: unit.total_cents,
              }))}
            />
          </div>
          <RevenueChart
            days={history.days}
            series={chartSeries}
            timezone={tz}
          />
        </Card>
      </section>

      {/* --- serviços que rendem · comissões que esperam ------------ */}
      <section
        aria-label="Serviços e comissões"
        className="grid gap-3 lg:grid-cols-2"
      >
        <Card className="px-5 py-5 sm:px-6">
          {/* `flex-wrap`: no telemóvel o título em versaletes e o período
              não cabem lado a lado — partiam-se os dois ao meio e ficavam
              quatro tiras entrelaçadas. Assim o período desce inteiro. */}
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="eyebrow">Top serviços por receita</h2>
            <p className="text-[0.75rem] text-[var(--ink-faint)]">
              seis semanas · concluídas
            </p>
          </div>
          {services.length === 0 ? (
            <Empty
              title="Ainda sem histórico"
              hint="Assim que houver comandas fechadas, os serviços que mais rendem aparecem aqui."
            />
          ) : (
            <ServiceBars
              items={services.map((s) => ({
                name: s.service_name,
                value_cents: s.revenue_cents,
                detail: `× ${s.times}`,
              }))}
            />
          )}
        </Card>

        <Card className="flex flex-col px-5 py-5 sm:px-6">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="eyebrow">Comissões por pagar</h2>
            <Link
              href="/admin/comissoes"
              className="text-[0.8125rem] text-[var(--accent)] underline-offset-4 transition-colors hover:underline"
            >
              Tratar
            </Link>
          </div>
          {pendingStaff.length === 0 ? (
            <Empty
              title="Tudo em dia"
              hint="Nenhuma comissão à espera de pagamento."
            />
          ) : (
            <>
              <ul className="flex-1 divide-y divide-[var(--line-soft)]">
                {pendingStaff.map((row) => (
                  <li
                    key={row.staff_id}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm text-[var(--ink)]">
                      {row.name}
                      <span className="ml-2 text-[0.75rem] text-[var(--ink-faint)]">
                        {row.pending_entries} linha
                        {row.pending_entries === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm text-[var(--ink)]">
                      {formatCents(row.pending_cents)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-[var(--line)] pt-3">
                <span className="text-[0.8125rem] text-[var(--ink-muted)]">
                  Total por pagar
                  {paidTotal > 0 ? (
                    <span className="ml-2 text-[0.75rem] text-[var(--ink-faint)]">
                      · já pagas {formatCents(paidTotal)}
                    </span>
                  ) : null}
                </span>
                <span className="tabular text-sm font-medium text-[var(--ink)]">
                  {formatCents(pendingTotal)}
                </span>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* --- o dia, casa a casa ------------------------------------- */}
      <section aria-label="Resumo de hoje">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">Hoje nas casas</h2>
          <p className="text-[0.75rem] text-[var(--ink-faint)]">
            {formatDayLong(today(tz), tz)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {unitsToday.map((unit) => (
            <Card key={unit.unit_id} className="px-5 py-5 sm:px-6">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h3 className="display text-xl text-[var(--ink)]">
                  {unit.name}
                </h3>
                <Link
                  href={`/agenda/${unit.slug}`}
                  className="text-[0.8125rem] text-[var(--accent)] underline-offset-4 transition-colors hover:underline"
                >
                  Agenda
                </Link>
              </div>

              {unit.total === 0 ? (
                <p className="py-2 text-sm text-[var(--ink-muted)]">
                  Dia sem marcações.
                </p>
              ) : (
                <>
                  <div className="mb-4 flex items-baseline justify-between gap-4">
                    <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                      {unit.total} marcaç{unit.total === 1 ? 'ão' : 'ões'}
                      {unit.next_at
                        ? ` · próxima às ${formatTime(unit.next_at, tz)}`
                        : unit.upcoming > 0
                          ? ` · ${unit.upcoming} por chegar`
                          : ' · sem mais nenhuma por vir'}
                    </p>
                    <p className="tabular shrink-0 text-sm text-[var(--ink)]">
                      {formatCents(unit.revenue_cents)}
                    </p>
                  </div>
                  {/* Quatro numa linha só a partir do tablet: a 390 as
                      etiquetas ("CONCLUÍDAS") encostam-se umas às outras. */}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--line-soft)] pt-3 sm:grid-cols-4 sm:gap-2">
                    <MiniStat label="Concluídas" value={unit.completed} />
                    <MiniStat label="Em curso" value={unit.active} />
                    <MiniStat label="Por vir" value={unit.upcoming} />
                    <MiniStat
                      label="Faltas"
                      value={unit.no_shows}
                      tone={unit.no_shows > 0 ? 'bad' : undefined}
                    />
                  </dl>
                </>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* --- as portas da gestão ------------------------------------ */}
      <nav
        aria-label="Atalhos de gestão"
        className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-[var(--line-soft)] pt-4 text-[0.8125rem]"
      >
        <Shortcut
          href="/admin/unidades"
          label="Unidades"
          value={`${total.units} loja${total.units === 1 ? '' : 's'}`}
        />
        <Shortcut
          href="/admin/servicos"
          label="Serviços"
          value={`${total.services} no catálogo`}
        />
        <Shortcut
          href="/admin/equipe"
          label="Equipa"
          value={`${total.staff} pessoa${total.staff === 1 ? '' : 's'}`}
        />
      </nav>
    </div>
  )
}

// ---------------------------------------------------------------------
// Peças do painel
// ---------------------------------------------------------------------

function formatRate(rate: number | null): string {
  if (rate === null) return '—'
  return new Intl.NumberFormat('pt-PT', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(rate)
}

function Kpi({
  label,
  value,
  delta,
  versus,
}: {
  label: string
  value: string
  delta: React.ReactNode
  versus: string
}) {
  return (
    // O número encosta ao fundo do cartão em vez de seguir o rótulo. Lado
    // a lado, «Marcações concluídas» ocupa duas linhas e «Faturação» uma —
    // e os dois números apareciam a alturas diferentes, como se um deles
    // tivesse escorregado. Encostados em baixo, ficam na mesma linha.
    <Card className="flex h-full flex-col px-4 py-4">
      <p className="eyebrow mb-2.5">{label}</p>
      <div className="mt-auto">
        <p className="display tabular text-[1.6875rem] leading-none text-[var(--ink)]">
          {value}
        </p>
        <p className="mt-2.5 flex items-baseline gap-1.5 text-[0.75rem] text-[var(--ink-faint)]">
          {delta}
          <span>vs {versus}</span>
        </p>
      </div>
    </Card>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'bad'
}) {
  return (
    <div>
      <dd
        className="tabular text-base leading-tight"
        style={{
          color:
            tone === 'bad' && value > 0 ? 'var(--bad)' : 'var(--ink)',
        }}
      >
        {value}
      </dd>
      <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        {label}
      </dt>
    </div>
  )
}

function Shortcut({
  href,
  label,
  value,
}: {
  href: string
  label: string
  value: string
}) {
  return (
    <Link
      href={href}
      className="group text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
    >
      <span className="transition-colors group-hover:text-[var(--accent)]">
        {label}
      </span>
      <span className="ml-1.5 text-[var(--ink-faint)]">{value}</span>
    </Link>
  )
}

// ---------------------------------------------------------------------
// A vista da gerente: sem contas da rede, só as portas dela
// ---------------------------------------------------------------------

async function ManagerTiles({ actor }: { actor: Actor }) {
  const total = await counts(actor)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {can.manageUnits(actor) ? (
        <Tile
          href="/admin/unidades"
          title="Unidades"
          value={`${total.units} loja${total.units === 1 ? '' : 's'}`}
          hint="Horário, feriados, regras de marcação e recursos físicos."
        />
      ) : null}

      {can.manageCatalog(actor) ? (
        <Tile
          href="/admin/servicos"
          title="Serviços"
          value={`${total.services} no catálogo`}
          hint="Preço, duração, folgas e exceções por loja ou profissional."
        />
      ) : null}

      {can.manageTeam(actor) ? (
        <Tile
          href="/admin/equipe"
          title="Equipa"
          value={`${total.staff} pessoa${total.staff === 1 ? '' : 's'}`}
          hint="Papéis, lojas, habilidades, escala e ausências."
        />
      ) : null}
    </div>
  )
}

function Tile({
  href,
  title,
  value,
  hint,
}: {
  href: string
  title: string
  value: string
  hint: string
}) {
  return (
    <Link href={href}>
      <Card className="h-full px-4 py-5 transition-colors hover:border-[var(--accent)]">
        <p className="eyebrow mb-1">{title}</p>
        <p className="display text-lg text-[var(--ink)]">{value}</p>
        <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">{hint}</p>
      </Card>
    </Link>
  )
}
