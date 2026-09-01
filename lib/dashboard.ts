import 'server-only'
import { sql } from '@/lib/db'
import type { Cents } from '@/lib/money'
import type { Source } from '@/lib/booking'
import type { Janela } from '@/lib/periodo'
import {
  addDays,
  dayEnd,
  dayStart,
  isoRange,
  today,
  type IsoDay,
} from '@/lib/time'

/**
 * AS CONTAS DO PAINEL DA DONA.
 *
 * Só leitura, só agregação. As datas vivem em UTC na base; a fronteira
 * de "dia" e de "mês" é sempre traçada no fuso da loja, nunca no do
 * servidor.
 */

/**
 * O DINHEIRO DE UMA MARCAÇÃO — E PORQUE MUDOU DE SÍTIO.
 *
 * Isto somava-se pelos PAGAMENTOS: alguém abria a comanda da cliente e
 * lançava lá o que ela pagou. O número que saía dizia a verdade sobre o
 * que tinha sido registado, e nenhuma sobre o salão — em agosto o
 * painel mostrava onze marcações concluídas e vinte euros, um ticket
 * médio de 1,82 €. Ninguém tinha tempo para o passo do lançamento, e um
 * painel que depende de um passo que ninguém dá não é um painel, é uma
 * pergunta sem resposta.
 *
 * Passa a somar-se pelo que a marcação VALE, e só quando ela foi dada
 * por CONCLUÍDA. Concluir é o botão que elas já carregam, porque serve
 * para outra coisa de que precisam — saber o que já passou. O dinheiro
 * vem de boleia num gesto que já existe, em vez de pedir um segundo.
 *
 * O preço é o congelado de cada item, que é o da altura da marcação e
 * não o da tabela de hoje. O desconto abate-se por marcação (e nunca
 * abaixo de zero); hoje não há por onde o pôr, mas o que ficou escrito
 * de trás continua a contar.
 *
 * O QUE ISTO NÃO É: não é caixa. Não diz o que entrou na gaveta nem
 * quando, e uma cliente que ficou a dever conta na mesma. Diz quanto
 * trabalho o salão fez — que é a pergunta a que o painel responde.
 *
 * A tabela `payment` fica na base com o que lá está. Já não é lida.
 *
 * `a` é a marcação: quem usar isto tem de ter `appointment a` no `from`.
 */
export function receitaDaMarcacao() {
  return sql`
    greatest(
      0,
      coalesce((
        select sum(i.price_cents) from appointment_item i
         where i.appointment_id = a.id
      ), 0)::int - a.discount_cents
    )
  `
}

// ---------------------------------------------------------------------
// Faturação por dia — as últimas seis semanas, casa a casa
// ---------------------------------------------------------------------

export type UnitSeries = {
  unit_id: string
  name: string
  slug: string
  /** Cêntimos por dia, alinhados com `days`. Dias sem receita: 0. */
  values: Cents[]
  total_cents: Cents
}

export type RevenueHistory = {
  /** Os 42 dias, do mais antigo até hoje. */
  days: IsoDay[]
  units: UnitSeries[]
  total_cents: Cents
}

export async function revenueByDay(
  orgId: string,
  timezone: string,
): Promise<RevenueHistory> {
  const last = today(timezone)
  const days = isoRange(addDays(last, -41), 42)
  const from = dayStart(days[0]!, timezone)
  const to = dayEnd(last, timezone)

  const [units, rows] = await Promise.all([
    sql<{ id: string; name: string; slug: string }[]>`
      select id, name, slug from unit
       where org_id = ${orgId} and is_active
       order by sort_order, name
    `,
    sql<{ unit_id: string; day: string; total_cents: number }[]>`
      select a.unit_id,
             to_char(a.starts_at at time zone ${timezone}, 'YYYY-MM-DD') as day,
             sum(${receitaDaMarcacao()})::int as total_cents
        from appointment a
        join unit u on u.id = a.unit_id
       where u.org_id = ${orgId}
         and a.status = 'completed'
         and a.starts_at >= ${from} and a.starts_at < ${to}
       group by a.unit_id, day
    `,
  ])

  const index = new Map(days.map((day, i) => [day, i]))
  const series: UnitSeries[] = units.map((unit) => ({
    unit_id: unit.id,
    name: unit.name,
    slug: unit.slug,
    values: days.map(() => 0),
    total_cents: 0,
  }))
  const bySlot = new Map(series.map((s) => [s.unit_id, s]))

  for (const row of rows) {
    const slot = bySlot.get(row.unit_id)
    const i = index.get(row.day)
    if (!slot || i === undefined) continue
    slot.values[i] = row.total_cents
    slot.total_cents += row.total_cents
  }

  return {
    days,
    units: series,
    total_cents: series.reduce((sum, s) => sum + s.total_cents, 0),
  }
}

// ---------------------------------------------------------------------
// A forma das seis semanas — uma linha por indicador
// ---------------------------------------------------------------------

export type KpiTrends = {
  /** Os mesmos 42 dias de `revenueByDay`, do mais antigo até hoje. */
  days: IsoDay[]
  revenue: Cents[]
  completed: number[]
  no_shows: number[]
}

/**
 * O mesmo período do gráfico grande, mas somado à rede inteira e sem
 * separar por casa: é isto que dá a linha fininha por baixo de cada
 * indicador do mês. Um número sozinho não diz se está a subir ou a
 * cair — a seta diz para onde, a linha diz por que caminho lá chegou.
 */
export async function kpiTrends(
  orgId: string,
  timezone: string,
): Promise<KpiTrends> {
  const last = today(timezone)
  const days = isoRange(addDays(last, -41), 42)
  const from = dayStart(days[0]!, timezone)
  const to = dayEnd(last, timezone)

  /*
    UMA CONSULTA, E NÃO DUAS. Eram duas porque as contas vinham de
    tabelas diferentes: o dinheiro dos pagamentos, as contagens das
    marcações. Agora as três linhas saem da mesma pergunta, e o dia é
    sempre o mesmo dia — o da marcação. Antes não era: o dinheiro caía
    no dia em que foi recebido, e podia ser outro.
  */
  const rows = await sql<
    { day: string; total_cents: number; completed: number; no_shows: number }[]
  >`
    select to_char(a.starts_at at time zone ${timezone}, 'YYYY-MM-DD') as day,
           coalesce(sum(${receitaDaMarcacao()}) filter (
             where a.status = 'completed'
           ), 0)::int as total_cents,
           count(*) filter (where a.status = 'completed')::int as completed,
           count(*) filter (where a.status = 'no_show')::int as no_shows
      from appointment a
     where a.org_id = ${orgId}
       and a.starts_at >= ${from} and a.starts_at < ${to}
     group by day
  `

  const index = new Map(days.map((day, i) => [day, i]))
  const revenue: Cents[] = days.map(() => 0)
  const completed: number[] = days.map(() => 0)
  const noShows: number[] = days.map(() => 0)

  for (const row of rows) {
    const i = index.get(row.day)
    if (i === undefined) continue
    revenue[i] = row.total_cents
    completed[i] = row.completed
    noShows[i] = row.no_shows
  }

  return { days, revenue, completed, no_shows: noShows }
}

// ---------------------------------------------------------------------
// Os indicadores da janela — corrente contra anterior
// ---------------------------------------------------------------------

export type PeriodKpis = {
  revenue_cents: Cents
  completed: number
  /** Faturação ÷ marcações concluídas; null sem concluídas. */
  avg_ticket_cents: Cents | null
  /** no-shows ÷ (concluídas + no-shows); null sem base. */
  no_show_rate: number | null
  no_shows: number
  /**
   * O QUE AS FALTAS CUSTARAM.
   *
   * Estavam contadas — «1 falta» — e uma contagem não decide nada. Uma
   * falta é uma hora que a casa tinha vendido e não cobrou, e o que
   * decide é quanto: uma falta de 8 € numa franja e uma falta de 60 €
   * numa coloração são o mesmo número e problemas diferentes.
   *
   * Vale-se pelo mesmo preço congelado das concluídas. Não é dinheiro
   * perdido para sempre — a hora podia não ter sido vendida a mais
   * ninguém — mas é a melhor medida do tamanho do buraco.
   */
  no_show_cents: Cents
}

export type KpisDoPeriodo = {
  atual: PeriodKpis
  anterior: PeriodKpis
}

function periodOf(input: {
  revenue: number
  completed: number
  noShows: number
  noShowCents: number
}): PeriodKpis {
  const base = input.completed + input.noShows
  return {
    revenue_cents: input.revenue,
    completed: input.completed,
    avg_ticket_cents:
      input.completed > 0 ? Math.round(input.revenue / input.completed) : null,
    no_show_rate: base > 0 ? input.noShows / base : null,
    no_shows: input.noShows,
    no_show_cents: input.noShowCents,
  }
}

/**
 * OS QUATRO NÚMEROS, NA JANELA QUE FOR.
 *
 * Era `monthKpis` e só sabia fazer meses. A conta é a mesma para
 * qualquer par de datas — quem decide qual é o par é o `lib/periodo`,
 * onde vive a regra de o anterior nunca invadir o corrente.
 *
 * UMA CONSULTA PARA OS DOIS PERÍODOS. São dois `filter` sobre a mesma
 * varredura; em duas consultas era o dobro das idas à base para
 * responder a metade da pergunta cada uma.
 */
export async function kpisDoPeriodo(
  orgId: string,
  timezone: string,
  janela: Janela,
): Promise<KpisDoPeriodo> {
  const curFrom = dayStart(janela.de, timezone)
  const curTo = dayEnd(janela.ate, timezone)
  const prevFrom = dayStart(janela.deAnterior, timezone)
  const prevTo = dayEnd(janela.ateAnterior, timezone)

  const rows = await sql<
    {
      cur_revenue: number
      prev_revenue: number
      cur_completed: number
      prev_completed: number
      cur_no_show: number
      prev_no_show: number
      cur_no_show_cents: number
      prev_no_show_cents: number
    }[]
  >`
    select
      coalesce(sum(${receitaDaMarcacao()}) filter (
        where a.status = 'completed' and a.starts_at >= ${curFrom}
      ), 0)::int as cur_revenue,
      coalesce(sum(${receitaDaMarcacao()}) filter (
        where a.status = 'completed' and a.starts_at < ${prevTo}
      ), 0)::int as prev_revenue,
      count(*) filter (where a.status = 'completed' and a.starts_at >= ${curFrom})::int as cur_completed,
      count(*) filter (where a.status = 'completed' and a.starts_at < ${prevTo})::int as prev_completed,
      count(*) filter (where a.status = 'no_show' and a.starts_at >= ${curFrom})::int as cur_no_show,
      count(*) filter (where a.status = 'no_show' and a.starts_at < ${prevTo})::int as prev_no_show,
      coalesce(sum(${receitaDaMarcacao()}) filter (
        where a.status = 'no_show' and a.starts_at >= ${curFrom}
      ), 0)::int as cur_no_show_cents,
      coalesce(sum(${receitaDaMarcacao()}) filter (
        where a.status = 'no_show' and a.starts_at < ${prevTo}
      ), 0)::int as prev_no_show_cents
      from appointment a
     where a.org_id = ${orgId}
       and ((a.starts_at >= ${prevFrom} and a.starts_at < ${prevTo})
         or (a.starts_at >= ${curFrom} and a.starts_at < ${curTo}))
  `

  const row = rows[0] ?? {
    cur_revenue: 0,
    prev_revenue: 0,
    cur_completed: 0,
    prev_completed: 0,
    cur_no_show: 0,
    prev_no_show: 0,
    cur_no_show_cents: 0,
    prev_no_show_cents: 0,
  }

  return {
    atual: periodOf({
      revenue: row.cur_revenue,
      completed: row.cur_completed,
      noShows: row.cur_no_show,
      noShowCents: row.cur_no_show_cents,
    }),
    anterior: periodOf({
      revenue: row.prev_revenue,
      completed: row.prev_completed,
      noShows: row.prev_no_show,
      noShowCents: row.prev_no_show_cents,
    }),
  }
}

// ---------------------------------------------------------------------
// O que dá dinheiro — os serviços que mais rendem
// ---------------------------------------------------------------------

export type TopService = {
  service_name: string
  revenue_cents: Cents
  times: number
}

/**
 * A casa sabia QUEM trazia quanto e não sabia O QUÊ.
 *
 * O número de vezes vai ao lado do valor de propósito: quatro
 * colorações que rendem 180 € e sete brushings que rendem 110 € são o
 * mesmo trabalho de mãos e metade do dinheiro. É isso — e não o total
 * — que diz onde subir um preço, o que promover, e o que talvez não
 * valha a pena continuar a fazer.
 */
export async function topServices(
  orgId: string,
  timezone: string,
  de: IsoDay,
  ate: IsoDay,
  limit = 6,
): Promise<TopService[]> {
  const from = dayStart(de, timezone)
  const to = dayEnd(ate, timezone)

  return sql<TopService[]>`
    select i.service_name,
           sum(i.price_cents)::int as revenue_cents,
           count(*)::int as times
      from appointment_item i
      join appointment a on a.id = i.appointment_id
     where a.org_id = ${orgId}
       and a.status = 'completed'
       and a.starts_at >= ${from} and a.starts_at < ${to}
     group by i.service_name
     order by revenue_cents desc, times desc
     limit ${limit}
  `
}

// ---------------------------------------------------------------------
// Produção da equipa — quem fez quanto
// ---------------------------------------------------------------------

export type StaffProduction = {
  staff_id: string
  name: string
  revenue_cents: Cents
  /** Serviços feitos — conta as linhas, não as marcações. */
  times: number
  clients: number
}

/**
 * O que cada uma trouxe. Conta-se pelo preço congelado de cada serviço,
 * atribuído a quem o fez — uma marcação com duas colaboradoras conta
 * para as duas, cada uma pela sua parte.
 */
export async function staffProduction(
  orgId: string,
  timezone: string,
  de: IsoDay,
  ate: IsoDay,
  limit = 8,
): Promise<StaffProduction[]> {
  const from = dayStart(de, timezone)
  const to = dayEnd(ate, timezone)

  return sql<StaffProduction[]>`
    select i.staff_id, s.name,
           sum(i.price_cents)::int as revenue_cents,
           count(*)::int as times,
           count(distinct a.client_id)::int as clients
      from appointment_item i
      join appointment a on a.id = i.appointment_id
      join staff s on s.id = i.staff_id
     where a.org_id = ${orgId}
       and a.status = 'completed'
       and a.starts_at >= ${from} and a.starts_at < ${to}
     group by i.staff_id, s.name
     order by revenue_cents desc, s.name
     limit ${limit}
  `
}

// ---------------------------------------------------------------------
// De onde vêm as marcações
// ---------------------------------------------------------------------

export type Origem = {
  source: Source
  marcacoes: number
}

/**
 * DE ONDE VÊM — A PERGUNTA QUE O SITE OBRIGA A FAZER.
 *
 * O site é novo e custou dinheiro. Saber se as clientes o usam, ou se
 * continuam todas a telefonar, é a resposta a se valeu a pena — e a
 * marcação já guarda a origem desde o primeiro dia, numa coluna que
 * nunca ninguém leu.
 *
 * CONTAM-SE TODAS AS MARCAÇÕES DO PERÍODO, e não só as concluídas.
 * Aqui a pergunta é por onde a cliente entrou, não o que aconteceu
 * depois: uma marcação feita pelo site que acabou em falta continua a
 * ser uma prova de que o site funciona.
 *
 * As canceladas ficam de fora — quem cancelou não entrou por lado
 * nenhum.
 */
export async function origemDasMarcacoes(
  orgId: string,
  timezone: string,
  de: IsoDay,
  ate: IsoDay,
): Promise<Origem[]> {
  const from = dayStart(de, timezone)
  const to = dayEnd(ate, timezone)

  return sql<Origem[]>`
    select a.source, count(*)::int as marcacoes
      from appointment a
     where a.org_id = ${orgId}
       and a.starts_at >= ${from} and a.starts_at < ${to}
       and a.status not in ('cancelled_by_client','cancelled_by_salon')
     group by a.source
     order by marcacoes desc, a.source
  `
}

// ---------------------------------------------------------------------
// O que vem aí — os próximos sete dias
// ---------------------------------------------------------------------

export type OQueVemAi = {
  marcacoes: number
}

/**
 * A ÚNICA COISA DESTA PÁGINA QUE AINDA SE PODE MUDAR.
 *
 * Tudo o resto olha para trás: a faturação do mês passou, a ocupação
 * de ontem passou, as faltas passaram. O livro dos próximos sete dias
 * é a única conta em que uma decisão de hoje ainda mexe — e por isso
 * está em cima, antes dos painéis todos.
 *
 * CONTA PESSOAS, E NÃO EUROS. Chegou a somar quanto valia o que estava
 * no livro, e saiu: metade daquilo ainda desmarca, remarca ou falta.
 * Um euro que se cobrou e um euro que talvez se cobre são o mesmo
 * algarismo a dizer coisas diferentes, e numa página onde tudo o resto
 * é dinheiro contado esse destoava.
 *
 * DE AGORA EM DIANTE, e não de amanhã: a tarde de hoje ainda conta
 * para o que há para fazer.
 *
 * Conta o que está MARCADO — `booked` e `confirmed`. O que já entrou
 * em atendimento hoje pertence ao dia, não ao que vem; o que foi
 * cancelado não vem de todo.
 */
export async function oQueVemAi(
  orgId: string,
  timezone: string,
  hoje: IsoDay,
  agora = new Date(),
): Promise<OQueVemAi> {
  const ate = dayEnd(addDays(hoje, 6), timezone)

  const rows = await sql<OQueVemAi[]>`
    select count(*)::int as marcacoes
      from appointment a
     where a.org_id = ${orgId}
       and a.status in ('booked','confirmed')
       and a.starts_at >= ${agora} and a.starts_at < ${ate}
  `

  return rows[0] ?? { marcacoes: 0 }
}

// ---------------------------------------------------------------------
// As clientes — quem chegou, quem voltou, quem sumiu
// ---------------------------------------------------------------------

export type Clientela = {
  /** Vieram no período pela primeira vez de sempre. */
  novas: number
  /** Vieram no período, e já cá tinham vindo antes. */
  voltaram: number
  /** Já vieram alguma vez, e a última foi há mais de 90 dias. */
  sumiram: number
}

/**
 * UM SALÃO VIVE DE QUEM VOLTA.
 *
 * A faturação de um período não diz se a casa está a crescer ou a
 * gastar as clientes que já tinha. Vinte marcações de vinte pessoas
 * diferentes e vinte marcações de dez que voltaram valem o mesmo em
 * euros e são negócios opostos.
 *
 * TRÊS CONTAS, E A TERCEIRA É A QUE DÁ TRABALHO. Novas e voltaram são
 * para ver. As que sumiram são para agir: têm nome, têm telefone, e uma
 * mensagem traz metade delas de volta.
 *
 * AS QUE SUMIRAM NÃO OBEDECEM AO PERÍODO — de propósito. As outras
 * duas contam o que aconteceu na janela; esta conta um estado de HOJE,
 * e «quem está sumida» não muda por se estar a olhar para o ano em vez
 * do mês. Contá-la dentro da janela dava um número que crescia com o
 * zoom e não com o problema.
 *
 * NOVENTA DIAS é o corte, e é um palpite honesto: uma cliente de
 * coloração some ao fim de dois meses, uma de corte ao fim de quatro.
 * Se a casa disser que é outro número, muda-se aqui.
 *
 * Conta-se pelas CONCLUÍDAS, como tudo o resto neste ficheiro: uma
 * marcação que ninguém deu por feita não é uma visita.
 */
export async function clientela(
  orgId: string,
  timezone: string,
  de: IsoDay,
  ate: IsoDay,
  hoje: IsoDay = today(timezone),
): Promise<Clientela> {
  const from = dayStart(de, timezone)
  const to = dayEnd(ate, timezone)
  const sumiuAntesDe = dayStart(addDays(hoje, -90), timezone)

  const rows = await sql<Clientela[]>`
    with visitas as (
      select a.client_id,
             min(a.starts_at) as primeira,
             max(a.starts_at) as ultima,
             count(*) filter (
               where a.starts_at >= ${from} and a.starts_at < ${to}
             ) as no_periodo
        from appointment a
       where a.org_id = ${orgId} and a.status = 'completed'
       group by a.client_id
    )
    select
      count(*) filter (
        where primeira >= ${from} and primeira < ${to}
      )::int as novas,
      count(*) filter (
        where no_periodo > 0 and primeira < ${from}
      )::int as voltaram,
      count(*) filter (where ultima < ${sumiuAntesDe})::int as sumiram
      from visitas
  `

  return rows[0] ?? { novas: 0, voltaram: 0, sumiram: 0 }
}

// ---------------------------------------------------------------------
// Hoje, casa a casa
// ---------------------------------------------------------------------

export type UnitToday = {
  unit_id: string
  name: string
  slug: string
  total: number
  completed: number
  upcoming: number
  active: number
  no_shows: number
  next_at: Date | null
  revenue_cents: Cents
}

export async function todayByUnit(
  orgId: string,
  timezone: string,
  now = new Date(),
): Promise<UnitToday[]> {
  const day = today(timezone, now)
  const from = dayStart(day, timezone)
  const to = dayEnd(day, timezone)

  /*
    O dinheiro entrou nesta consulta em vez de vir de uma segunda: a
    marcação já cá está, e a receita é uma coluna dela. O `left join`
    tem de se manter — uma loja parada continua a aparecer, com zero.
  */
  return sql<UnitToday[]>`
    select u.id as unit_id, u.name, u.slug,
           count(a.id)::int as total,
           count(a.id) filter (where a.status = 'completed')::int as completed,
           count(a.id) filter (where a.status in ('booked','confirmed'))::int as upcoming,
           count(a.id) filter (where a.status in ('checked_in','in_service'))::int as active,
           count(a.id) filter (where a.status = 'no_show')::int as no_shows,
           min(a.starts_at) filter (
             where a.status in ('booked','confirmed') and a.starts_at >= ${now}
           ) as next_at,
           coalesce(sum(${receitaDaMarcacao()}) filter (
             where a.status = 'completed'
           ), 0)::int as revenue_cents
      from unit u
      left join appointment a
        on a.unit_id = u.id
       and a.starts_at >= ${from} and a.starts_at < ${to}
       and a.status not in ('cancelled_by_client','cancelled_by_salon')
     where u.org_id = ${orgId} and u.is_active
     group by u.id
     order by u.sort_order, u.name
  `
}
