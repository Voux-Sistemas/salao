import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowUpRight, Scissors, Store, Users } from 'lucide-react'
import { can, requireManagement, type Actor } from '@/lib/auth/actor'
import { sql } from '@/lib/db'
import {
  kpiTrends,
  kpisDoPeriodo,
  revenueByDay,
  staffProduction,
  todayByUnit,
  topServices,
} from '@/lib/dashboard'
import { formatCents } from '@/lib/money'
import { requireOrg } from '@/lib/org'
import { janelaDe } from '@/lib/periodo'
import {
  addDays,
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
              ))) as staff
  `
  return rows[0] ?? { units: 0, services: 0, staff: 0 }
}

export default async function AdminPage() {
  const actor = await requireManagement()

  // A gerente não vê as contas da rede — vê as portas por onde pode ir.
  if (!can.seeNetworkNumbers(actor)) {
    return <ManagerTiles actor={actor} />
  }

  const org = await requireOrg()
  const tz = org.timezone

  const hoje = today(tz)
  const mes = janelaDe('mes', hoje)
  // As mesmas seis semanas de sempre, agora escritas onde se vêem.
  const seisSemanas = { de: addDays(hoje, -41), ate: hoje }

  const [history, trends, kpis, services, team, unitsToday, total] =
    await Promise.all([
      revenueByDay(actor.orgId, tz),
      kpiTrends(actor.orgId, tz),
      kpisDoPeriodo(actor.orgId, tz, mes),
      topServices(actor.orgId, tz, seisSemanas.de, seisSemanas.ate, 8),
      staffProduction(actor.orgId, tz, seisSemanas.de, seisSemanas.ate),
      todayByUnit(actor.orgId, tz),
      counts(actor),
    ])

  const monthName = (day: string) =>
    new Intl.DateTimeFormat('pt-PT', { month: 'long', timeZone: tz }).format(
      dayStart(day, tz),
    )
  const prevName = monthName(mes.deAnterior)

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

  return (
    <div className="space-y-7">
      <p className="max-w-2xl text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
        A rede em números — e as portas por onde se muda o que eles dizem.
      </p>

      {/* --- o mês, em quatro números ------------------------------- */}
      <section aria-label="Indicadores do mês">
        <PanelHead
          title={`${capitalise(monthName(mes.de))} até hoje`}
          aside={`comparado com igual período de ${prevName}`}
        />
        {/* Dois a dois já no telemóvel: em coluna única, os quatro números
            do mês ocupavam um ecrã e meio e nunca se viam ao mesmo tempo —
            que é a única coisa que se quer fazer com eles. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            label="Faturação"
            value={formatCents(kpis.atual.revenue_cents)}
            delta={
              <Delta
                current={kpis.atual.revenue_cents}
                previous={kpis.anterior.revenue_cents || null}
              />
            }
            versus={prevName}
            spark={rolling(trends.revenue)}
            sparkLabel="Faturação nas últimas seis semanas"
          />
          <Kpi
            label="Marcações concluídas"
            value={String(kpis.atual.completed)}
            delta={
              <Delta
                current={kpis.atual.completed}
                previous={kpis.anterior.completed || null}
              />
            }
            versus={prevName}
            spark={rolling(trends.completed)}
            sparkLabel="Marcações concluídas nas últimas seis semanas"
          />
          <Kpi
            label="Ticket médio"
            value={
              kpis.atual.avg_ticket_cents !== null
                ? formatCents(kpis.atual.avg_ticket_cents)
                : '—'
            }
            delta={
              <Delta
                current={kpis.atual.avg_ticket_cents ?? 0}
                previous={kpis.anterior.avg_ticket_cents}
              />
            }
            versus={prevName}
            spark={rollingRatio(trends.revenue, trends.completed)}
            sparkLabel="Ticket médio nas últimas seis semanas"
          />
          <Kpi
            label="Taxa de no-show"
            value={formatRate(kpis.atual.no_show_rate)}
            delta={
              <Delta
                current={kpis.atual.no_show_rate ?? 0}
                previous={kpis.anterior.no_show_rate}
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
          A linha debaixo de cada número é a média de sete dias, ao longo
          de seis semanas.
        </p>
      </section>

      {/*
        A FATURAÇÃO E O DIA, LADO A LADO.

        São as duas leituras que se fazem ao abrir isto: como vai o mês, e
        o que está a acontecer agora. Empilhadas, a segunda ficava abaixo
        da dobra e só se via a rolar. Em ecrã largo o gráfico leva dois
        terços — precisa de largura para os 42 dias — e o dia fica na
        coluna estreita, que é onde uma lista curta se lê melhor.
      */}
      <section aria-label="Faturação e dia">
        <PanelHead title="O mês e o dia" />
        <div className="grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0 px-5 py-5 sm:px-6 xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <p className="text-[0.8125rem] font-medium text-[var(--ink-muted)]">
                Faturação · últimas seis semanas
              </p>
              <p className="metric mt-1.5 text-2xl text-[var(--ink)]">
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

        <Card className="flex min-w-0 flex-col px-5 py-5 sm:px-6">
          <PanelHead
            title="Hoje nas casas"
            aside={formatDayLong(today(tz), tz)}
            inCard
          />
          <ul className="flex-1 divide-y divide-[var(--line-soft)]">
            {unitsToday.map((unit) => (
              <li key={unit.unit_id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/agenda/${unit.slug}`}
                    className="min-w-0 truncate text-sm font-semibold text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                  >
                    {unit.name}
                  </Link>
                  <span className="tabular shrink-0 text-sm font-medium text-[var(--ink)]">
                    {formatCents(unit.revenue_cents)}
                  </span>
                </div>

                {unit.total === 0 ? (
                  <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
                    Dia sem marcações.
                  </p>
                ) : (
                  <>
                    <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
                      {unit.total} marcaç{unit.total === 1 ? 'ão' : 'ões'}
                      {unit.next_at
                        ? ` · próxima às ${formatTime(unit.next_at, tz)}`
                        : unit.upcoming > 0
                          ? ` · ${unit.upcoming} por chegar`
                          : ' · sem mais nenhuma por vir'}
                    </p>
                    {/* Quanto do dia já passou, sem ser pelas horas: o que
                        está feito, o que está a acontecer, e o resto. As
                        pastilhas por baixo levam o mesmo ponto de cor —
                        é o que faz a barra ter legenda sem ter legenda. */}
                    <div
                      aria-hidden
                      className="mt-2.5 flex h-[6px] w-full gap-px overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                    >
                      <span
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{
                          width: `${(unit.completed / unit.total) * 100}%`,
                        }}
                      />
                      <span
                        className="h-full rounded-full bg-[var(--gold)]"
                        style={{
                          width: `${(unit.active / unit.total) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Tally
                        label="concluídas"
                        value={unit.completed}
                        dot="var(--accent)"
                      />
                      <Tally
                        label="em curso"
                        value={unit.active}
                        dot="var(--gold)"
                      />
                      <Tally label="por vir" value={unit.upcoming} />
                      {unit.no_shows > 0 ? (
                        <Tally
                          label="faltas"
                          value={unit.no_shows}
                          dot="var(--bad)"
                          tone="bad"
                        />
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
        </div>
      </section>

      {/* --- de onde vem o dinheiro: quem o traz e o que se vende ---- */}
      <section aria-label="De onde vem o dinheiro">
        <PanelHead title="De onde vem o dinheiro" />
        {/* Eram dois cartões lado a lado, e as comissões eram o segundo.
            Sozinho numa grelha de duas colunas, este ficava a meio ecrã
            com o resto em branco — um buraco com a forma exacta do que
            saiu. Ocupa a largura toda, como o dos serviços aqui abaixo. */}
        <Card className="min-w-0 px-5 py-5 sm:px-6">
          <PanelHead
            title="Produção por colaborador"
            aside="seis semanas · concluídas"
            inCard
          />
          {team.length === 0 ? (
            <Empty
              title="Ainda sem histórico"
              hint="Assim que houver marcações concluídas, vê-se aqui quanto cada uma trouxe."
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

        {/* Fica DENTRO desta secção de propósito: sozinho lá em baixo,
            aparecia debaixo do título de cima e lia-se como se os
            serviços fossem gente. É a mesma pergunta — de onde vem o
            dinheiro — respondida pelo outro lado. */}
        <Card className="mt-4 px-5 py-5 sm:px-6">
          {/* `flex-wrap`: no telemóvel o título e o período não cabem lado
              a lado — partiam-se os dois ao meio e ficavam quatro tiras
              entrelaçadas. Assim o período desce inteiro. */}
          <PanelHead
            title="Top serviços por receita"
            aside="seis semanas · concluídas"
            inCard
          />
          {services.length === 0 ? (
            <Empty
              title="Ainda sem histórico"
              hint="Assim que houver marcações concluídas, os serviços que mais rendem aparecem aqui."
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

      {/* --- as portas da gestão ------------------------------------ */}
      <section aria-label="Gerir">
        <PanelHead title="Gerir" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            href="/admin/unidades"
            icon={Store}
            title="Unidades"
            value={`${total.units} loja${total.units === 1 ? '' : 's'}`}
            hint="Horário, feriados e regras de marcação."
          />
          <Tile
            href="/admin/servicos"
            icon={Scissors}
            title="Serviços"
            value={`${total.services} no catálogo`}
            hint="Preço, duração e nomes nas outras línguas."
          />
          <Tile
            href="/admin/equipe"
            icon={Users}
            title="Equipa"
            value={`${total.staff} pessoa${total.staff === 1 ? '' : 's'}`}
            hint="Papéis, lojas, habilidades e ausências."
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

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
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

/**
 * O cabeçalho de um painel: o nome à esquerda, o período ou a data à
 * direita. Escrito uma vez para que os seis cartões desta página tenham
 * todos a mesma altura de título — a diferença de um pixel entre eles
 * é o que faz uma grelha parecer mal montada sem se perceber porquê.
 */
function PanelHead({
  title,
  aside,
  inCard = false,
}: {
  title: string
  aside?: string
  /** Dentro de um cartão a folga é menor: o fio do cartão já separa. */
  inCard?: boolean
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${inCard ? 'mb-4' : 'mb-3'}`}
    >
      {/*
        DOIS ANDARES DE TÍTULO, E NÃO UM.

        Dentro de um cartão, o título é o nome do conteúdo e escreve-se
        como se fala. Fora dele é outra coisa: é o nome de uma SECÇÃO,
        que agrupa cartões que já têm títulos próprios. Escritos os dois
        do mesmo tamanho e da mesma cor, a página ficava com onze
        títulos iguais e nenhuma ordem entre eles.

        O de fora passa a versalete espaçado, pequeno, no castanho da
        casa. É o único sítio da gestão onde a tinta do logótipo toca
        em texto corrido — e é de propósito: separa a arrumação da
        página (dela) dos dados (dos números, que continuam a azul).
      */}
      {inCard ? (
        <h2 className="panel-title">{title}</h2>
      ) : (
        <h2 className="titulo-seccao">{title}</h2>
      )}
      {aside ? (
        <p className="text-[0.75rem] text-[var(--ink-faint)]">{aside}</p>
      ) : null}
    </div>
  )
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
    //
    // `overflow-hidden`: a linha sangra até aos bordos, e com o canto
    // aberto do balcão sairia por fora do cartão nos dois cantos de baixo.
    <Card className="flex h-full min-w-0 flex-col overflow-hidden px-5 pt-5">
      {/* O rótulo em versalete pequeno, o número grande: assim o cartão
          tem dois pesos, e não três textos do mesmo tamanho a disputar
          o olho. */}
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.11em] text-[var(--ink-faint)]">
        {label}
      </p>
      <div className="mt-auto pt-5">
        <p className="metric text-[2rem] text-[var(--ink)]">{value}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.75rem] text-[var(--ink-faint)]">
          {delta}
          <span>vs {versus}</span>
        </p>
      </div>
      {/* A linha assenta no fio de baixo: é o chão do número, não mais
          uma coisa a competir com ele. */}
      {/* A LINHA NÃO ENCOSTA AO CANTO.
          Correndo de bordo a bordo e a acabar na aresta de baixo, o
          último troço era cortado pelo arredondamento do cartão e lia-se
          como uma ponta dobrada — parecia defeito de desenho, e num dia
          em que só o último ponto tem valor era o que mais saltava à
          vista. Continua de bordo a bordo, mas com chão por baixo. */}
      <div className="-mx-5 mt-5 border-t border-[var(--line-soft)] pb-4 pt-3">
        <Sparkline values={spark} tone={sparkTone} label={sparkLabel} />
      </div>
    </Card>
  )
}

/**
 * Uma contagem com o seu ponto de cor — o mesmo que a barra por cima
 * usa no segmento correspondente. É a legenda da barra, sem ser uma
 * legenda: lê-se «3 concluídas» e vê-se onde estão os 3 na barra.
 */
function Tally({
  label,
  value,
  dot,
  tone,
}: {
  label: string
  value: number
  dot?: string
  tone?: 'bad'
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2 py-1 text-[0.75rem] text-[var(--ink-muted)]">
      {dot ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: dot }}
        />
      ) : null}
      <span
        className="tabular font-semibold"
        style={{ color: tone === 'bad' ? 'var(--bad)' : 'var(--ink)' }}
      >
        {value}
      </span>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------
// A vista da gerente: sem contas da rede, só as portas dela
// ---------------------------------------------------------------------

async function ManagerTiles({ actor }: { actor: Actor }) {
  const total = await counts(actor)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {can.manageUnits(actor) ? (
        <Tile
          href="/admin/unidades"
          icon={Store}
          title="Unidades"
          value={`${total.units} loja${total.units === 1 ? '' : 's'}`}
          hint="Horário, feriados, regras de marcação e recursos físicos."
        />
      ) : null}

      {can.manageCatalog(actor) ? (
        <Tile
          href="/admin/servicos"
          icon={Scissors}
          title="Serviços"
          value={`${total.services} no catálogo`}
          hint="Preço, duração, folgas e exceções por loja ou colaborador."
        />
      ) : null}

      {can.manageTeam(actor) ? (
        <Tile
          href="/admin/equipe"
          icon={Users}
          title="Equipa"
          value={`${total.staff} pessoa${total.staff === 1 ? '' : 's'}`}
          hint="Papéis, lojas, habilidades, escala e ausências."
        />
      ) : null}
    </div>
  )
}

/**
 * A porta para uma secção da gestão. O glifo é o que a torna encontrável
 * de relance numa fila — eram rectângulos de texto iguais, e escolhia-se
 * a ler. A seta acende ao passar por cima: diz que se vai daqui para
 * outro sítio, e não que se abre aqui mesmo.
 */
function Tile({
  href,
  icon: Icon,
  title,
  value,
  hint,
}: {
  href: string
  icon: typeof Store
  title: string
  value: string
  hint: string
}) {
  return (
    <Link href={href} className="group block">
      <Card className="flex h-full gap-3 px-4 py-4 transition-all hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:shadow-[var(--shadow-soft)]">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[0.8125rem] text-[var(--ink-muted)]">
              {title}
            </span>
            <ArrowUpRight
              aria-hidden
              size={15}
              strokeWidth={2}
              className="shrink-0 text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100"
            />
          </span>
          <span className="display mt-0.5 block text-[0.9375rem] text-[var(--ink)]">
            {value}
          </span>
          <span className="mt-1.5 block text-[0.75rem] leading-snug text-[var(--ink-muted)]">
            {hint}
          </span>
        </span>
      </Card>
    </Link>
  )
}
