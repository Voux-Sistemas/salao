import Link from 'next/link'
import type { Metadata } from 'next'
import { can, requireManagement, type Actor } from '@/lib/auth/actor'
import { sql } from '@/lib/db'
import {
  commissionStandings,
  kpiTrends,
  monthKpis,
  revenueByDay,
  staffProduction,
  todayByUnit,
  topServices,
} from '@/lib/dashboard'
import { formatCents } from '@/lib/money'
import { requireOrg } from '@/lib/org'
import {
  dayStart,
  formatDayLong,
  formatDayShort,
  formatTime,
  today,
} from '@/lib/time'
import {
  ChartLegend,
  Delta,
  RevenueChart,
  ServiceBars,
  Sparkline,
  WeekBars,
  type SeriesTone,
  type SparkTone,
  type Week,
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

  const [history, trends, kpis, services, team, standings, unitsToday, total] =
    await Promise.all([
      revenueByDay(actor.orgId, tz),
      kpiTrends(actor.orgId, tz),
      monthKpis(actor.orgId, tz),
      topServices(actor.orgId, tz, 8),
      staffProduction(actor.orgId, tz),
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

  // A base da taxa de faltas: quem apareceu mais quem faltou. É a mesma
  // conta que o número grande faz, mas dia a dia.
  const attempts = trends.completed.map(
    (done, i) => done + (trends.no_shows[i] ?? 0),
  )

  // As seis semanas partidas em seis barras — o gráfico do telemóvel.
  const weeks: Week[] = Array.from(
    { length: Math.floor(history.days.length / 7) },
    (_, w) => {
      const from = w * 7
      const first = history.days[from]
      const last = history.days[from + 6]
      return {
        label:
          first && last
            ? `${formatDayShort(first, tz)} – ${formatDayShort(last, tz)}`
            : `Semana ${w + 1}`,
        parts: history.units.map((unit, i) => ({
          name: unit.name,
          tone: TONES[i % TONES.length]!,
          value_cents: unit.values
            .slice(from, from + 7)
            .reduce((sum, v) => sum + v, 0),
        })),
      }
    },
  )

  // Oito serviços em duas colunas: a lista fica com quatro linhas de
  // altura em vez de oito, e vê-se toda de uma vez.
  const half = Math.ceil(services.length / 2)

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
            spark={rolling(trends.revenue)}
            sparkLabel="Faturação nas últimas seis semanas"
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
            spark={rolling(trends.completed)}
            sparkLabel="Marcações concluídas nas últimas seis semanas"
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
            spark={rollingRatio(trends.revenue, trends.completed)}
            sparkLabel="Ticket médio nas últimas seis semanas"
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
            spark={rollingRatio(trends.no_shows, attempts)}
            sparkTone="quiet"
            sparkLabel="Taxa de faltas nas últimas seis semanas"
          />
        </div>
        <p className="mt-2 text-[0.75rem] text-[var(--ink-faint)]">
          Cada linha é a média de sete dias, ao longo de seis semanas.
        </p>
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
          {/* O mesmo período, dois desenhos: a linha diária a partir do
              tablet, as seis semanas em barras no telemóvel. Trocar por
              CSS e não por JavaScript deixa os dois desenhados no
              servidor — a página não pisca ao abrir. */}
          <div className="hidden sm:block">
            <RevenueChart
              days={history.days}
              series={chartSeries}
              timezone={tz}
            />
          </div>
          <div className="sm:hidden">
            <WeekBars weeks={weeks} />
          </div>
        </Card>
      </section>

      {/* --- a equipa: o que trouxe · o que se lhe deve ------------- */}
      <section aria-label="Equipa" className="grid gap-3 lg:grid-cols-2">
        <Card className="min-w-0 px-5 py-5 sm:px-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="eyebrow">Produção por profissional</h2>
            <p className="text-[0.75rem] text-[var(--ink-faint)]">
              seis semanas · concluídas
            </p>
          </div>
          {team.length === 0 ? (
            <Empty
              title="Ainda sem histórico"
              hint="Assim que houver comandas fechadas, vê-se aqui quanto cada uma trouxe."
            />
          ) : (
            <ServiceBars
              items={team.map((person) => ({
                name: person.name,
                value_cents: person.revenue_cents,
                detail: `${person.clients} client${person.clients === 1 ? 'e' : 'es'} · ${person.times} serviço${person.times === 1 ? '' : 's'}`,
              }))}
            />
          )}
        </Card>

        <Card className="flex min-w-0 flex-col px-5 py-5 sm:px-6">
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

      {/* --- os serviços que rendem --------------------------------- */}
      <section aria-label="Serviços que mais rendem">
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
            <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {/* `min-w-0`: por omissão uma célula de grelha não encolhe
                  abaixo do conteúdo, e «Balayage / Babylights / Ombré ·
                  cabelo comprido» empurrava a lista para fora do cartão —
                  com a página inteira a ganhar rolagem lateral. */}
              <div className="min-w-0">
                <ServiceBars
                  items={services.slice(0, half).map((s) => ({
                    name: s.service_name,
                    value_cents: s.revenue_cents,
                    detail: `× ${s.times}`,
                  }))}
                />
              </div>
              {services.length > half ? (
                <div className="min-w-0">
                  <ServiceBars
                    items={services.slice(half).map((s) => ({
                      name: s.service_name,
                      value_cents: s.revenue_cents,
                      detail: `× ${s.times}`,
                    }))}
                  />
                </div>
              ) : null}
            </div>
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
                  <div className="mb-2.5 flex items-baseline justify-between gap-4">
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
                  {/* Quanto do dia já passou, sem ser pelas horas: o que
                      está feito, o que está a acontecer, e o resto. */}
                  <div
                    aria-hidden
                    className="mb-4 flex h-[5px] w-full gap-px rounded-full bg-[var(--surface-sunken)]"
                  >
                    <span
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: `${(unit.completed / unit.total) * 100}%`,
                      }}
                    />
                    <span
                      className="h-full rounded-full bg-[var(--gold)]"
                      style={{ width: `${(unit.active / unit.total) * 100}%` }}
                    />
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
      <section aria-label="Gerir">
        <h2 className="eyebrow mb-2">Gerir</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            href="/admin/unidades"
            title="Unidades"
            value={`${total.units} loja${total.units === 1 ? '' : 's'}`}
            hint="Horário, feriados e regras de marcação."
          />
          <Tile
            href="/admin/servicos"
            title="Serviços"
            value={`${total.services} no catálogo`}
            hint="Preço, duração e nomes nas outras línguas."
          />
          <Tile
            href="/admin/equipe"
            title="Equipa"
            value={`${total.staff} pessoa${total.staff === 1 ? '' : 's'}`}
            hint="Papéis, lojas, habilidades e ausências."
          />
          <Tile
            href="/admin/comissoes"
            title="Comissões"
            value={
              total.pending_cents > 0
                ? formatCents(total.pending_cents)
                : 'Tudo em dia'
            }
            hint="Fechar o que está à espera de pagamento."
          />
        </div>
      </section>
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

/**
 * Média móvel de sete dias. A linha crua de um salão é um serrote —
 * segunda fechada, sábado a abarrotar — e nesse desenho não se vê
 * tendência nenhuma, vê-se o calendário. A janela de uma semana tira o
 * dia-da-semana da conta e deixa ficar o que interessa.
 */
function rolling(values: number[], window = 7): number[] {
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i] ?? 0
    if (i >= window) sum -= values[i - window] ?? 0
    out.push(sum / Math.min(i + 1, window))
  }
  return out
}

/**
 * O mesmo, para os indicadores que são uma divisão — ticket médio, taxa
 * de faltas. Somam-se os dois lados dentro da janela e divide-se no
 * fim: fazer a média das razões diárias dava o mesmo peso a um dia de
 * duas marcações e a um sábado de trinta.
 */
function rollingRatio(top: number[], bottom: number[], window = 7): number[] {
  const out: number[] = []
  let a = 0
  let b = 0
  for (let i = 0; i < top.length; i++) {
    a += top[i] ?? 0
    b += bottom[i] ?? 0
    if (i >= window) {
      a -= top[i - window] ?? 0
      b -= bottom[i - window] ?? 0
    }
    out.push(b > 0 ? a / b : 0)
  }
  return out
}

function Kpi({
  label,
  value,
  delta,
  versus,
  spark,
  sparkTone = 'accent',
  sparkLabel,
}: {
  label: string
  value: string
  delta: React.ReactNode
  versus: string
  spark: number[]
  sparkTone?: SparkTone
  sparkLabel: string
}) {
  return (
    // O número encosta ao fundo do cartão em vez de seguir o rótulo. Lado
    // a lado, «Marcações concluídas» ocupa duas linhas e «Faturação» uma —
    // e os dois números apareciam a alturas diferentes, como se um deles
    // tivesse escorregado. Encostados em baixo, ficam na mesma linha.
    <Card className="flex h-full flex-col px-4 pt-4">
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
      {/* A linha sangra até aos bordos e assenta no fio de baixo: é o
          chão do número, não mais uma coisa a competir com ele. */}
      <div className="-mx-4 mt-3.5">
        <Sparkline values={spark} tone={sparkTone} label={sparkLabel} />
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
