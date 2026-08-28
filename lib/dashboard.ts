import 'server-only'
import { sql } from '@/lib/db'
import type { Cents } from '@/lib/money'
import {
  addDays,
  dayEnd,
  dayStart,
  isValidDay,
  isoRange,
  today,
  type IsoDay,
} from '@/lib/time'

/**
 * AS CONTAS DO PAINEL DA DONA.
 *
 * Só leitura, só agregação. Tudo o que aqui se soma já foi decidido
 * noutro sítio — o pagamento no balcão, a comissão no fecho da comanda.
 * As datas vivem em UTC na base; a fronteira de "dia" e de "mês" é
 * sempre traçada no fuso da loja, nunca no do servidor.
 */

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
      select p.unit_id,
             to_char(p.received_at at time zone ${timezone}, 'YYYY-MM-DD') as day,
             sum(p.amount_cents)::int as total_cents
        from payment p
        join unit u on u.id = p.unit_id
       where u.org_id = ${orgId}
         and p.received_at >= ${from} and p.received_at < ${to}
       group by p.unit_id, day
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

  const [payRows, apptRows] = await Promise.all([
    sql<{ day: string; total_cents: number }[]>`
      select to_char(p.received_at at time zone ${timezone}, 'YYYY-MM-DD') as day,
             sum(p.amount_cents)::int as total_cents
        from payment p
        join unit u on u.id = p.unit_id
       where u.org_id = ${orgId}
         and p.received_at >= ${from} and p.received_at < ${to}
       group by day
    `,
    sql<{ day: string; completed: number; no_shows: number }[]>`
      select to_char(a.starts_at at time zone ${timezone}, 'YYYY-MM-DD') as day,
             count(*) filter (where a.status = 'completed')::int as completed,
             count(*) filter (where a.status = 'no_show')::int as no_shows
        from appointment a
       where a.org_id = ${orgId}
         and a.starts_at >= ${from} and a.starts_at < ${to}
       group by day
    `,
  ])

  const index = new Map(days.map((day, i) => [day, i]))
  const revenue: Cents[] = days.map(() => 0)
  const completed: number[] = days.map(() => 0)
  const noShows: number[] = days.map(() => 0)

  for (const row of payRows) {
    const i = index.get(row.day)
    if (i !== undefined) revenue[i] = row.total_cents
  }
  for (const row of apptRows) {
    const i = index.get(row.day)
    if (i === undefined) continue
    completed[i] = row.completed
    noShows[i] = row.no_shows
  }

  return { days, revenue, completed, no_shows: noShows }
}

// ---------------------------------------------------------------------
// KPIs do mês — corrente contra anterior
// ---------------------------------------------------------------------

export type PeriodKpis = {
  revenue_cents: Cents
  completed: number
  /** Faturação ÷ marcações concluídas; null sem concluídas. */
  avg_ticket_cents: Cents | null
  /** no-shows ÷ (concluídas + no-shows); null sem base. */
  no_show_rate: number | null
  no_shows: number
}

export type MonthKpis = {
  /** Primeiro dia do mês corrente (calendário da loja). */
  current_start: IsoDay
  /** Primeiro dia do mês anterior. */
  previous_start: IsoDay
  current: PeriodKpis
  /**
   * O mês anterior cortado à MESMA altura: 21 dias corridos comparam-se
   * com os primeiros 21 dias de julho, não com julho inteiro — senão
   * todo o mês a meio parecia estar a cair.
   */
  previous: PeriodKpis
}

function periodOf(input: {
  revenue: number
  completed: number
  noShows: number
}): PeriodKpis {
  const base = input.completed + input.noShows
  return {
    revenue_cents: input.revenue,
    completed: input.completed,
    avg_ticket_cents:
      input.completed > 0 ? Math.round(input.revenue / input.completed) : null,
    no_show_rate: base > 0 ? input.noShows / base : null,
    no_shows: input.noShows,
  }
}

export async function monthKpis(
  orgId: string,
  timezone: string,
): Promise<MonthKpis> {
  const now = today(timezone)
  const currentStart: IsoDay = `${now.slice(0, 7)}-01`
  const previousStart: IsoDay = `${addDays(currentStart, -1).slice(0, 7)}-01`

  const prevFrom = dayStart(previousStart, timezone)
  const curFrom = dayStart(currentStart, timezone)
  const curTo = dayEnd(now, timezone)

  // O mesmo dia do mês anterior (fim exclusivo). Se o dia não existir
  // lá (31 num mês de 30, 29 a 31 em fevereiro), o período homólogo é
  // o mês anterior INTEIRO. E tem de se perguntar ANTES de construir a
  // data: o calendário desta casa recusa dias inexistentes com um erro
  // — não os transborda — e era esse erro que deitava o painel abaixo
  // a 31 de março.
  const prevSameDay = `${previousStart.slice(0, 7)}-${now.slice(8, 10)}`
  const prevCutRaw = isValidDay(prevSameDay)
    ? dayEnd(prevSameDay, timezone)
    : curFrom
  const prevTo = prevCutRaw < curFrom ? prevCutRaw : curFrom

  const [payRows, apptRows] = await Promise.all([
    sql<{ cur_revenue: number; prev_revenue: number }[]>`
      select
        coalesce(sum(p.amount_cents) filter (where p.received_at >= ${curFrom}), 0)::int as cur_revenue,
        coalesce(sum(p.amount_cents) filter (where p.received_at < ${prevTo}), 0)::int as prev_revenue
        from payment p
        join unit u on u.id = p.unit_id
       where u.org_id = ${orgId}
         and ((p.received_at >= ${prevFrom} and p.received_at < ${prevTo})
           or (p.received_at >= ${curFrom} and p.received_at < ${curTo}))
    `,
    sql<
      {
        cur_completed: number
        prev_completed: number
        cur_no_show: number
        prev_no_show: number
      }[]
    >`
      select
        count(*) filter (where status = 'completed' and starts_at >= ${curFrom})::int as cur_completed,
        count(*) filter (where status = 'completed' and starts_at < ${prevTo})::int as prev_completed,
        count(*) filter (where status = 'no_show' and starts_at >= ${curFrom})::int as cur_no_show,
        count(*) filter (where status = 'no_show' and starts_at < ${prevTo})::int as prev_no_show
        from appointment
       where org_id = ${orgId}
         and ((starts_at >= ${prevFrom} and starts_at < ${prevTo})
           or (starts_at >= ${curFrom} and starts_at < ${curTo}))
    `,
  ])

  const pay = payRows[0] ?? { cur_revenue: 0, prev_revenue: 0 }
  const appt = apptRows[0] ?? {
    cur_completed: 0,
    prev_completed: 0,
    cur_no_show: 0,
    prev_no_show: 0,
  }

  return {
    current_start: currentStart,
    previous_start: previousStart,
    current: periodOf({
      revenue: pay.cur_revenue,
      completed: appt.cur_completed,
      noShows: appt.cur_no_show,
    }),
    previous: periodOf({
      revenue: pay.prev_revenue,
      completed: appt.prev_completed,
      noShows: appt.prev_no_show,
    }),
  }
}

// ---------------------------------------------------------------------
// Top serviços por receita — janela das mesmas seis semanas
// ---------------------------------------------------------------------

export type TopService = {
  service_name: string
  revenue_cents: Cents
  times: number
}

export async function topServices(
  orgId: string,
  timezone: string,
  limit = 6,
): Promise<TopService[]> {
  const last = today(timezone)
  const from = dayStart(addDays(last, -41), timezone)
  const to = dayEnd(last, timezone)

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
// Produção da equipa — quem fez quanto, nas mesmas seis semanas
// ---------------------------------------------------------------------

export type StaffProduction = {
  staff_id: string
  name: string
  revenue_cents: Cents
  /** Serviços feitos — linhas de comanda, não marcações. */
  times: number
  clients: number
}

/**
 * A outra cara das comissões: ali vê-se o que se deve a cada uma, aqui
 * o que cada uma trouxe. Conta-se pelo preço congelado de cada serviço,
 * atribuído a quem o fez — uma marcação com duas profissionais conta
 * para as duas, cada uma pela sua parte, que é como a comissão também
 * se calcula.
 */
export async function staffProduction(
  orgId: string,
  timezone: string,
  limit = 8,
): Promise<StaffProduction[]> {
  const last = today(timezone)
  const from = dayStart(addDays(last, -41), timezone)
  const to = dayEnd(last, timezone)

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
// Comissões — o que espera e o que já foi
// ---------------------------------------------------------------------

export type CommissionStanding = {
  staff_id: string
  name: string
  pending_cents: Cents
  pending_entries: number
  paid_cents: Cents
}

/** Por profissional: o que está por pagar e o que já se pagou. */
export async function commissionStandings(
  orgId: string,
): Promise<CommissionStanding[]> {
  return sql<CommissionStanding[]>`
    select e.staff_id, s.name,
           coalesce(sum(e.amount_cents) filter (where e.status = 'pending'), 0)::int as pending_cents,
           count(*) filter (where e.status = 'pending')::int as pending_entries,
           coalesce(sum(e.amount_cents) filter (where e.status = 'paid'), 0)::int as paid_cents
      from commission_entry e
      join staff s on s.id = e.staff_id
     where e.org_id = ${orgId}
     group by e.staff_id, s.name
     order by pending_cents desc, s.name
  `
}

export type PendingCommissionRow = {
  staff_id: string
  name: string
  entries: number
  base_cents: Cents
  total_cents: Cents
  /** Percentagens congeladas nas entradas: iguais ou um intervalo. */
  percent_min: string
  percent_max: string
  oldest_at: Date
}

/** A tabela do ecrã de comissões: base, percentagem congelada e valor. */
export async function pendingCommissionTable(
  orgId: string,
): Promise<PendingCommissionRow[]> {
  return sql<PendingCommissionRow[]>`
    select e.staff_id, s.name,
           count(*)::int as entries,
           sum(e.base_cents)::int as base_cents,
           sum(e.amount_cents)::int as total_cents,
           min(e.percent)::text as percent_min,
           max(e.percent)::text as percent_max,
           min(e.generated_at) as oldest_at
      from commission_entry e
      join staff s on s.id = e.staff_id
     where e.org_id = ${orgId} and e.status = 'pending'
     group by e.staff_id, s.name
     order by total_cents desc, s.name
  `
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

  const [rows, payRows] = await Promise.all([
    sql<
      {
        unit_id: string
        name: string
        slug: string
        total: number
        completed: number
        upcoming: number
        active: number
        no_shows: number
        next_at: Date | null
      }[]
    >`
      select u.id as unit_id, u.name, u.slug,
             count(a.id)::int as total,
             count(a.id) filter (where a.status = 'completed')::int as completed,
             count(a.id) filter (where a.status in ('booked','confirmed'))::int as upcoming,
             count(a.id) filter (where a.status in ('checked_in','in_service'))::int as active,
             count(a.id) filter (where a.status = 'no_show')::int as no_shows,
             min(a.starts_at) filter (
               where a.status in ('booked','confirmed') and a.starts_at >= ${now}
             ) as next_at
        from unit u
        left join appointment a
          on a.unit_id = u.id
         and a.starts_at >= ${from} and a.starts_at < ${to}
         and a.status not in ('cancelled_by_client','cancelled_by_salon')
       where u.org_id = ${orgId} and u.is_active
       group by u.id
       order by u.sort_order, u.name
    `,
    sql<{ unit_id: string; revenue_cents: number }[]>`
      select p.unit_id, sum(p.amount_cents)::int as revenue_cents
        from payment p
        join unit u on u.id = p.unit_id
       where u.org_id = ${orgId}
         and p.received_at >= ${from} and p.received_at < ${to}
       group by p.unit_id
    `,
  ])

  const revenue = new Map(payRows.map((r) => [r.unit_id, r.revenue_cents]))
  return rows.map((row) => ({
    ...row,
    revenue_cents: revenue.get(row.unit_id) ?? 0,
  }))
}
