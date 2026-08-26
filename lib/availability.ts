import 'server-only'
import { sql } from '@/lib/db'
import type { Unit } from '@/lib/org'
import { openingWindows } from '@/lib/hours'
import {
  addDays,
  atMinutes,
  dayStart,
  today,
  weekdayOf,
  type IsoDay,
} from '@/lib/time'
import {
  containedInAny,
  interval,
  merge,
  overlapsAny,
  subtract,
  totalMinutes,
  type Interval,
} from '@/lib/intervals'

/**
 * O MOTOR DE DISPONIBILIDADE.
 *
 * Dada uma loja, um carrinho e um dia, devolve os horários possíveis.
 * Um horário só é possível se TUDO isto for verdade ao mesmo tempo:
 *
 *   · a loja está aberta nesse intervalo (feriados sobrepõem-se ao
 *     horário normal, e um dia pode ter mais do que uma faixa);
 *   · a profissional está escalada nessa loja nesse intervalo (a escala
 *     tem vigência: só conta a que vigora nesse dia);
 *   · a profissional não tem ausência marcada;
 *   · a profissional está livre — nenhum bloco se sobrepõe, folgas
 *     (buffers) incluídas;
 *   · existe recurso físico livre de cada tipo que o serviço exige — a
 *     pessoa e o equipamento reservam-se juntos, senão duas colorações
 *     agendam para o mesmo lavatório;
 *   · respeita as regras da loja: granularidade, antecedência mínima e
 *     antecedência máxima.
 *
 * O que este motor devolve é um PLANO, não só uma hora: quem faz o quê,
 * quando e em que recurso. Ao confirmar, o cliente manda apenas o
 * instante escolhido e o servidor replaneia — nunca se confia no plano
 * que veio do navegador.
 */

export type Channel = 'online' | 'counter'

export type CartLine = {
  serviceId: string
  /** null = sem preferência */
  staffId: string | null
}

export type PlannedItem = {
  serviceId: string
  serviceName: string
  staffId: string
  /** Nome verdadeiro. Só para dentro: agenda, comanda, encaixe. */
  staffName: string
  /** O que a cliente pode ver. Igual ao de cima quando não há alcunha. */
  staffPublicName: string
  startsAt: Date
  endsAt: Date
  priceCents: number
  durationMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  resourceIds: string[]
}

export type Plan = {
  startsAt: Date
  endsAt: Date
  items: PlannedItem[]
  totalCents: number
  totalMinutes: number
}

export type Slot = {
  /** Instante de início, em UTC. */
  startsAt: Date
  /** Minutos desde a meia-noite local — para agrupar manhã/tarde. */
  minutesOfDay: number
  plan: Plan
}

// ---------------------------------------------------------------------
// Contexto do dia
// ---------------------------------------------------------------------

type ServiceRow = {
  id: string
  name: string
  duration_minutes: number
  base_price_cents: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  bookable_online: boolean
  is_active: boolean
}

type StaffRow = {
  id: string
  name: string
  /** Nome para a cliente. Nulo quando não há nada a esconder. */
  public_alias: string | null
  sort_order: number
  accepts_online_booking: boolean
}

export type DayContext = {
  unit: Unit
  day: IsoDay
  channel: Channel
  now: Date
  cart: CartLine[]
  /** Faixas de abertura, em minutos desde a meia-noite local. */
  opening: { openMin: number; closeMin: number }[]
  services: Map<string, ServiceRow>
  staff: Map<string, StaffRow>
  /** Profissionais elegíveis por serviço, já ordenadas pela estratégia. */
  candidates: Map<string, string[]>
  /** Escala do dia menos ausências, por profissional. */
  workable: Map<string, Interval[]>
  /** Blocos já ocupados, por profissional. */
  busy: Map<string, Interval[]>
  pricing: Map<string, { priceCents: number; durationMinutes: number }>
  requirements: Map<string, { resourceTypeId: string; quantity: number }[]>
  resourcesByType: Map<string, string[]>
  resourceBusy: Map<string, Interval[]>
}

const pairKey = (serviceId: string, staffId: string) => `${serviceId}:${staffId}`

/** Motivos por que um dia pode não ter nada — para dar uma resposta útil. */
export type DayProblem = 'closed' | 'no_staff' | 'too_far' | 'none'

/**
 * Ao remarcar, os blocos da marcação antiga não podem contar como
 * ocupação — senão a própria marcação impede-se a si mesma de mudar de
 * hora. É a única razão para esta opção existir.
 */
export type PlanOptions = { excludeAppointmentId?: string | null }

export async function loadDayContext(
  unit: Unit,
  day: IsoDay,
  cart: CartLine[],
  channel: Channel,
  now: Date = new Date(),
  options: PlanOptions = {},
): Promise<DayContext | DayProblem> {
  const excludeId = options.excludeAppointmentId ?? null
  if (cart.length === 0) return 'none'

  // Antecedência máxima: não se marca para daqui a um ano.
  if (channel === 'online') {
    const horizon = addDays(today(unit.timezone, now), unit.max_lead_days)
    if (day > horizon) return 'too_far'
  }

  // --- horário de funcionamento -------------------------------------
  // Feriados e horários especiais sobrepõem-se ao horário normal.
  const opening = await openingWindows(unit.id, day)
  if (opening.length === 0) return 'closed'

  // --- serviços do carrinho ------------------------------------------
  const serviceIds = [...new Set(cart.map((l) => l.serviceId))]
  const serviceRows = await sql<ServiceRow[]>`
    select id, name, duration_minutes, base_price_cents,
           buffer_before_minutes, buffer_after_minutes,
           bookable_online, is_active
      from service
     where id = any(${serviceIds}::uuid[]) and org_id = ${unit.org_id}
  `
  const services = new Map(serviceRows.map((s) => [s.id, s]))

  // Um serviço desativado (ou fechado ao online) é apanhado aqui, não
  // só no fim do funil.
  for (const id of serviceIds) {
    const service = services.get(id)
    if (!service || !service.is_active) return 'none'
    if (channel === 'online' && !service.bookable_online) return 'none'
  }

  // --- profissionais elegíveis ---------------------------------------
  // Quem não tem a habilidade nunca aparece como opção nesse serviço.
  const skillRows = await sql<
    (StaffRow & { service_id: string })[]
  >`
    select ss.service_id, s.id, s.name, s.public_alias, s.sort_order,
           s.accepts_online_booking
      from staff_skill ss
      join staff s        on s.id = ss.staff_id and s.is_active
      join staff_unit su  on su.staff_id = s.id and su.unit_id = ${unit.id}
     where ss.service_id = any(${serviceIds}::uuid[])
  `

  const staff = new Map<string, StaffRow>()
  const candidatesByService = new Map<string, string[]>()
  for (const row of skillRows) {
    // Só profissionais que aceitam marcação online entram no funil
    // público. A recepção não tem esse filtro.
    if (channel === 'online' && !row.accepts_online_booking) continue
    staff.set(row.id, {
      id: row.id,
      name: row.name,
      public_alias: row.public_alias,
      sort_order: row.sort_order,
      accepts_online_booking: row.accepts_online_booking,
    })
    const list = candidatesByService.get(row.service_id) ?? []
    list.push(row.id)
    candidatesByService.set(row.service_id, list)
  }

  // Uma escolha explícita restringe a lista a essa pessoa.
  for (const line of cart) {
    if (!line.staffId) continue
    const list = candidatesByService.get(line.serviceId) ?? []
    candidatesByService.set(
      line.serviceId,
      list.filter((id) => id === line.staffId),
    )
  }
  for (const line of cart) {
    if ((candidatesByService.get(line.serviceId) ?? []).length === 0) {
      return 'no_staff'
    }
  }

  const staffIds = [...staff.keys()]

  // --- janelas de tempo -----------------------------------------------
  // Alarga-se meio dia para cada lado: um bloco que começou ontem à
  // noite ou que passa da meia-noite continua a contar.
  const windowStart = new Date(dayStart(day, unit.timezone).getTime() - 12 * 3_600_000)
  const windowEnd = new Date(dayStart(addDays(day, 1), unit.timezone).getTime() + 12 * 3_600_000)

  const [scheduleRows, absenceRows, blockRows, pricingRows, requirementRows, resourceRows, resourceBlockRows] =
    await Promise.all([
      // A escala tem vigência: só conta a que vigora neste dia.
      sql<{ staff_id: string; starts_min: number; ends_min: number }[]>`
        select staff_id, starts_min, ends_min
          from staff_schedule
         where unit_id = ${unit.id}
           and weekday = ${weekdayOf(day)}
           and staff_id = any(${staffIds}::uuid[])
           and valid_from <= ${day}::date
           and (valid_to is null or valid_to >= ${day}::date)
      `,
      sql<{ staff_id: string; starts_at: Date; ends_at: Date }[]>`
        select staff_id, starts_at, ends_at
          from staff_absence
         where staff_id = any(${staffIds}::uuid[])
           and starts_at < ${windowEnd} and ends_at > ${windowStart}
      `,
      // A pessoa é uma só: um bloco na outra loja também a ocupa.
      sql<{ staff_id: string; s: Date; e: Date }[]>`
        select sb.staff_id, lower(sb.during) as s, upper(sb.during) as e
          from staff_block sb
          join appointment_item ai on ai.id = sb.appointment_item_id
         where sb.staff_id = any(${staffIds}::uuid[])
           and sb.during && tstzrange(${windowStart}, ${windowEnd})
           and (${excludeId}::uuid is null or ai.appointment_id <> ${excludeId}::uuid)
      `,
      // Preço e duração efectivos para cada par (serviço, profissional),
      // pela função de precedência que vive na base de dados.
      sql<
        { service_id: string; staff_id: string; price_cents: number; duration_minutes: number }[]
      >`
        with pairs as (
          select s.id as service_id, t.id as staff_id
            from unnest(${serviceIds}::uuid[]) as s(id)
           cross join unnest(${staffIds}::uuid[]) as t(id)
        )
        select p.service_id, p.staff_id, e.price_cents, e.duration_minutes
          from pairs p
         cross join lateral effective_service_pricing(p.service_id, ${unit.id}, p.staff_id) e
      `,
      sql<{ service_id: string; resource_type_id: string; quantity: number }[]>`
        select service_id, resource_type_id, quantity
          from service_resource_requirement
         where service_id = any(${serviceIds}::uuid[])
      `,
      sql<{ id: string; resource_type_id: string }[]>`
        select id, resource_type_id
          from resource
         where unit_id = ${unit.id} and is_active
         order by sort_order, name
      `,
      sql<{ resource_id: string; s: Date; e: Date }[]>`
        select rb.resource_id, lower(rb.during) as s, upper(rb.during) as e
          from resource_block rb
          join resource r on r.id = rb.resource_id
          join appointment_item ai on ai.id = rb.appointment_item_id
         where r.unit_id = ${unit.id}
           and rb.during && tstzrange(${windowStart}, ${windowEnd})
           and (${excludeId}::uuid is null or ai.appointment_id <> ${excludeId}::uuid)
      `,
    ])

  // Escala -> intervalos absolutos, menos as ausências.
  const scheduleByStaff = new Map<string, Interval[]>()
  for (const row of scheduleRows) {
    const list = scheduleByStaff.get(row.staff_id) ?? []
    list.push(
      interval(
        atMinutes(day, row.starts_min, unit.timezone).getTime(),
        atMinutes(day, row.ends_min, unit.timezone).getTime(),
      ),
    )
    scheduleByStaff.set(row.staff_id, list)
  }

  const absencesByStaff = new Map<string, Interval[]>()
  for (const row of absenceRows) {
    const list = absencesByStaff.get(row.staff_id) ?? []
    list.push(interval(row.starts_at.getTime(), row.ends_at.getTime()))
    absencesByStaff.set(row.staff_id, list)
  }

  const workable = new Map<string, Interval[]>()
  for (const id of staffIds) {
    const scheduled = merge(scheduleByStaff.get(id) ?? [])
    workable.set(id, subtract(scheduled, absencesByStaff.get(id) ?? []))
  }

  const busy = new Map<string, Interval[]>()
  for (const row of blockRows) {
    const list = busy.get(row.staff_id) ?? []
    list.push(interval(row.s.getTime(), row.e.getTime()))
    busy.set(row.staff_id, list)
  }

  const pricing = new Map<string, { priceCents: number; durationMinutes: number }>()
  for (const row of pricingRows) {
    pricing.set(pairKey(row.service_id, row.staff_id), {
      priceCents: row.price_cents,
      durationMinutes: row.duration_minutes,
    })
  }

  const requirements = new Map<string, { resourceTypeId: string; quantity: number }[]>()
  for (const row of requirementRows) {
    const list = requirements.get(row.service_id) ?? []
    list.push({ resourceTypeId: row.resource_type_id, quantity: row.quantity })
    requirements.set(row.service_id, list)
  }

  const resourcesByType = new Map<string, string[]>()
  for (const row of resourceRows) {
    const list = resourcesByType.get(row.resource_type_id) ?? []
    list.push(row.id)
    resourcesByType.set(row.resource_type_id, list)
  }

  const resourceBusy = new Map<string, Interval[]>()
  for (const row of resourceBlockRows) {
    const list = resourceBusy.get(row.resource_id) ?? []
    list.push(interval(row.s.getTime(), row.e.getTime()))
    resourceBusy.set(row.resource_id, list)
  }

  // Estratégia de "sem preferência": ordena as candidatas uma vez, aqui,
  // para que o plano seja determinístico — o mesmo instante replaneado
  // no servidor dá exactamente o mesmo resultado.
  const load = await staffLoad(unit, day, staffIds, busy)
  const candidates = new Map<string, string[]>()
  for (const [serviceId, ids] of candidatesByService) {
    candidates.set(serviceId, orderCandidates(unit, ids, staff, load))
  }

  return {
    unit,
    day,
    channel,
    now,
    cart,
    opening,
    services,
    staff,
    candidates,
    workable,
    busy,
    pricing,
    requirements,
    resourcesByType,
    resourceBusy,
  }
}

async function staffLoad(
  unit: Unit,
  day: IsoDay,
  staffIds: string[],
  busy: Map<string, Interval[]>,
): Promise<Map<string, number>> {
  const load = new Map<string, number>()

  if (unit.assignment_strategy === 'least_busy_week') {
    const from = dayStart(addDays(day, -weekdayOf(day)), unit.timezone)
    const to = new Date(from.getTime() + 7 * 86_400_000)
    const rows = await sql<{ staff_id: string; minutes: number }[]>`
      select staff_id,
             (sum(extract(epoch from (upper(during) - lower(during)))) / 60)::int as minutes
        from staff_block
       where staff_id = any(${staffIds}::uuid[])
         and during && tstzrange(${from}, ${to})
       group by staff_id
    `
    for (const row of rows) load.set(row.staff_id, row.minutes)
    return load
  }

  const dayFrom = dayStart(day, unit.timezone).getTime()
  const dayTo = dayStart(addDays(day, 1), unit.timezone).getTime()
  for (const id of staffIds) {
    const inDay = (busy.get(id) ?? []).filter(
      (b) => b.start < dayTo && b.end > dayFrom,
    )
    load.set(id, totalMinutes(inDay))
  }
  return load
}

function orderCandidates(
  unit: Unit,
  ids: string[],
  staff: Map<string, StaffRow>,
  load: Map<string, number>,
): string[] {
  const byName = (a: string, b: string) => {
    const sa = staff.get(a)
    const sb = staff.get(b)
    return (sa?.sort_order ?? 0) - (sb?.sort_order ?? 0) ||
      (sa?.name ?? '').localeCompare(sb?.name ?? '')
  }

  if (unit.assignment_strategy === 'first_available') {
    return [...ids].sort(byName)
  }
  // balance_load e least_busy_week: quem tem menos carga vai à frente.
  return [...ids].sort(
    (a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0) || byName(a, b),
  )
}

// ---------------------------------------------------------------------
// Construção do plano
// ---------------------------------------------------------------------

/**
 * Tenta montar o plano completo a começar neste instante.
 * Devolve null se qualquer condição falhar.
 *
 * Vários serviços numa visita encadeiam-se em sequência, com o intervalo
 * configurável da loja entre eles. O horário oferecido é o do conjunto.
 */
export function buildPlan(ctx: DayContext, startMs: number): Plan | null {
  const openings = ctx.opening.map((o) =>
    interval(
      atMinutes(ctx.day, o.openMin, ctx.unit.timezone).getTime(),
      atMinutes(ctx.day, o.closeMin, ctx.unit.timezone).getTime(),
    ),
  )

  // Antecedência mínima. A recepção pode ignorá-la — é isso que é um
  // encaixe.
  if (ctx.channel === 'online') {
    const earliest = ctx.now.getTime() + ctx.unit.min_lead_minutes * 60_000
    if (startMs < earliest) return null
  }

  const items: PlannedItem[] = []
  // Ocupação acumulada DENTRO deste plano (a mesma profissional não pode
  // fazer dois serviços ao mesmo tempo, nem o mesmo recurso servir dois).
  const plannedStaff = new Map<string, Interval[]>()
  const plannedResources = new Map<string, Interval[]>()

  let cursor = startMs

  for (const line of ctx.cart) {
    const service = ctx.services.get(line.serviceId)
    if (!service) return null

    const assigned = assign(
      ctx,
      line,
      service,
      cursor,
      openings,
      plannedStaff,
      plannedResources,
    )
    if (!assigned) return null

    items.push(assigned)

    const block = blockOf(assigned)
    plannedStaff.set(assigned.staffId, [
      ...(plannedStaff.get(assigned.staffId) ?? []),
      block,
    ])
    for (const resourceId of assigned.resourceIds) {
      plannedResources.set(resourceId, [
        ...(plannedResources.get(resourceId) ?? []),
        block,
      ])
    }

    cursor =
      assigned.endsAt.getTime() +
      ctx.unit.gap_between_services_minutes * 60_000
  }

  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return null

  return {
    startsAt: first.startsAt,
    endsAt: last.endsAt,
    items,
    totalCents: items.reduce((sum, i) => sum + i.priceCents, 0),
    totalMinutes: items.reduce((sum, i) => sum + i.durationMinutes, 0),
  }
}

const blockOf = (item: PlannedItem): Interval =>
  interval(
    item.startsAt.getTime() - item.bufferBeforeMinutes * 60_000,
    item.endsAt.getTime() + item.bufferAfterMinutes * 60_000,
  )

function assign(
  ctx: DayContext,
  line: CartLine,
  service: ServiceRow,
  startMs: number,
  openings: Interval[],
  plannedStaff: Map<string, Interval[]>,
  plannedResources: Map<string, Interval[]>,
): PlannedItem | null {
  const ids = ctx.candidates.get(line.serviceId) ?? []

  for (const staffId of ids) {
    const price = ctx.pricing.get(pairKey(line.serviceId, staffId))
    if (!price) continue

    const endMs = startMs + price.durationMinutes * 60_000
    const serviceSpan = interval(startMs, endMs)

    // A loja tem de estar aberta durante o serviço.
    if (!containedInAny(serviceSpan, openings)) continue

    // A profissional tem de estar escalada nesta loja, sem ausência.
    if (!containedInAny(serviceSpan, ctx.workable.get(staffId) ?? [])) continue

    // Livre — com as folgas do serviço incluídas no bloco.
    const block = interval(
      startMs - service.buffer_before_minutes * 60_000,
      endMs + service.buffer_after_minutes * 60_000,
    )
    if (overlapsAny(block, ctx.busy.get(staffId) ?? [])) continue
    if (overlapsAny(block, plannedStaff.get(staffId) ?? [])) continue

    // Recursos físicos: pessoa e equipamento reservam-se juntos.
    const resourceIds = pickResources(ctx, service.id, block, plannedResources)
    if (!resourceIds) continue

    const staffRow = ctx.staff.get(staffId)
    return {
      serviceId: service.id,
      serviceName: service.name,
      staffId,
      staffName: staffRow?.name ?? '',
      staffPublicName: staffRow?.public_alias ?? staffRow?.name ?? '',
      startsAt: new Date(startMs),
      endsAt: new Date(endMs),
      priceCents: price.priceCents,
      durationMinutes: price.durationMinutes,
      bufferBeforeMinutes: service.buffer_before_minutes,
      bufferAfterMinutes: service.buffer_after_minutes,
      resourceIds,
    }
  }

  return null
}

/** Devolve os recursos a reservar, ou null se faltar algum tipo. */
function pickResources(
  ctx: DayContext,
  serviceId: string,
  block: Interval,
  plannedResources: Map<string, Interval[]>,
): string[] | null {
  const needs = ctx.requirements.get(serviceId)
  if (!needs || needs.length === 0) return []

  const chosen: string[] = []
  for (const need of needs) {
    const pool = ctx.resourcesByType.get(need.resourceTypeId) ?? []
    const free = pool.filter(
      (id) =>
        !chosen.includes(id) &&
        !overlapsAny(block, ctx.resourceBusy.get(id) ?? []) &&
        !overlapsAny(block, plannedResources.get(id) ?? []),
    )
    if (free.length < need.quantity) return null
    chosen.push(...free.slice(0, need.quantity))
  }
  return chosen
}

// ---------------------------------------------------------------------
// Horários oferecidos
// ---------------------------------------------------------------------

export function slotsFrom(ctx: DayContext): Slot[] {
  const step = ctx.unit.slot_granularity_minutes
  const slots: Slot[] = []

  for (const window of ctx.opening) {
    for (let m = window.openMin; m < window.closeMin; m += step) {
      const startsAt = atMinutes(ctx.day, m, ctx.unit.timezone)
      const plan = buildPlan(ctx, startsAt.getTime())
      if (plan) slots.push({ startsAt, minutesOfDay: m, plan })
    }
  }

  return slots
}

/** Atalho: contexto + horários, numa chamada. */
export async function availableSlots(
  unit: Unit,
  day: IsoDay,
  cart: CartLine[],
  channel: Channel,
  now: Date = new Date(),
  options: PlanOptions = {},
): Promise<{ slots: Slot[]; problem: DayProblem | null }> {
  const ctx = await loadDayContext(unit, day, cart, channel, now, options)
  if (typeof ctx === 'string') return { slots: [], problem: ctx }
  return { slots: slotsFrom(ctx), problem: null }
}

/**
 * Replaneia um instante concreto. É isto que corre no momento de gravar:
 * o navegador manda a hora, o servidor decide quem faz o quê.
 */
export async function planAt(
  unit: Unit,
  day: IsoDay,
  cart: CartLine[],
  startsAt: Date,
  channel: Channel,
  now: Date = new Date(),
  options: PlanOptions = {},
): Promise<Plan | null> {
  const ctx = await loadDayContext(unit, day, cart, channel, now, options)
  if (typeof ctx === 'string') return null
  return buildPlan(ctx, startsAt.getTime())
}

// ---------------------------------------------------------------------
// Quem está de serviço, num dia
// ---------------------------------------------------------------------

/**
 * Porque é que uma profissional não pode ser escolhida neste dia.
 * `none` = pode.
 */
export type StaffDayProblem = 'closed' | 'off' | 'full' | 'none'

export type StaffDay = {
  id: string
  /** Nome que a cliente vê. */
  publicName: string
  /** Retrato, quando existe. */
  avatarUrl: string | null
  /** A cor dela na agenda — serve de fundo ao monograma quando não há retrato. */
  displayColor: string
  sortOrder: number
  /** Falso = fica cinzenta e não se clica. */
  available: boolean
  reason: StaffDayProblem
  /** Minutos livres que ainda restam no dia. Zero quando não há. */
  freeMinutes: number
}

/**
 * A equipa da loja num dia, já dita como cliente a vê: quem se pode
 * escolher e quem fica cinzento, com o motivo.
 *
 * Isto é o passo do funil que vem antes do serviço, por isso não sabe
 * ainda qual é o serviço — a pergunta que responde é mais simples:
 * «esta pessoa ainda tem algum bocado livre hoje nesta loja?». O que
 * ela sabe ou não fazer decide-se no passo seguinte, e a hora exacta
 * no passo a seguir a esse; os dois voltam a passar pelo motor de cima,
 * que é quem manda de facto.
 *
 * Ninguém desaparece da lista: quem folga aparece à mesma, apagado,
 * porque uma lista que encolhe faz a cliente pensar que se enganou.
 */
export async function staffForDay(
  unit: Unit,
  day: IsoDay,
  channel: Channel = 'online',
  now: Date = new Date(),
): Promise<StaffDay[]> {
  const rows = await sql<
    (StaffRow & { avatar_url: string | null; display_color: string })[]
  >`
    select s.id, s.name, s.public_alias, s.sort_order, s.accepts_online_booking,
           s.avatar_url, s.display_color
      from staff s
      join staff_unit su on su.staff_id = s.id and su.unit_id = ${unit.id}
     where s.org_id = ${unit.org_id} and s.is_active
     order by s.sort_order, s.name
  `
  const team = rows.filter(
    (r) => channel !== 'online' || r.accepts_online_booking,
  )
  if (team.length === 0) return []

  type Row = (typeof team)[number]
  const shape = (row: Row, reason: StaffDayProblem, freeMinutes: number): StaffDay => ({
    id: row.id,
    publicName: row.public_alias ?? row.name,
    avatarUrl: row.avatar_url,
    displayColor: row.display_color,
    sortOrder: row.sort_order,
    available: reason === 'none',
    reason,
    freeMinutes,
  })

  // Loja fechada: ninguém trabalha, e o motivo é da casa, não da pessoa.
  const opening = await openingWindows(unit.id, day)
  if (opening.length === 0) return team.map((r) => shape(r, 'closed', 0))

  const staffIds = team.map((r) => r.id)
  const windowStart = new Date(dayStart(day, unit.timezone).getTime() - 12 * 3_600_000)
  const windowEnd = new Date(dayStart(addDays(day, 1), unit.timezone).getTime() + 12 * 3_600_000)

  const [scheduleRows, absenceRows, blockRows] = await Promise.all([
    sql<{ staff_id: string; starts_min: number; ends_min: number }[]>`
      select staff_id, starts_min, ends_min
        from staff_schedule
       where unit_id = ${unit.id}
         and weekday = ${weekdayOf(day)}
         and staff_id = any(${staffIds}::uuid[])
         and valid_from <= ${day}::date
         and (valid_to is null or valid_to >= ${day}::date)
    `,
    sql<{ staff_id: string; starts_at: Date; ends_at: Date }[]>`
      select staff_id, starts_at, ends_at
        from staff_absence
       where staff_id = any(${staffIds}::uuid[])
         and starts_at < ${windowEnd} and ends_at > ${windowStart}
    `,
    // A pessoa é uma só: um bloco na outra loja também a ocupa.
    sql<{ staff_id: string; s: Date; e: Date }[]>`
      select staff_id, lower(during) as s, upper(during) as e
        from staff_block
       where staff_id = any(${staffIds}::uuid[])
         and during && tstzrange(${windowStart}, ${windowEnd})
    `,
  ])

  const byStaff = <T extends { staff_id: string }>(list: T[]) => {
    const out = new Map<string, T[]>()
    for (const row of list) {
      const kept = out.get(row.staff_id) ?? []
      kept.push(row)
      out.set(row.staff_id, kept)
    }
    return out
  }
  const schedules = byStaff(scheduleRows)
  const absences = byStaff(absenceRows)
  const blocks = byStaff(blockRows)

  // A janela útil do dia: aberto, e ainda por vir. Uma hora que já
  // passou não é vaga nenhuma.
  const openWindows = merge(
    opening.map((o) =>
      interval(
        atMinutes(day, o.openMin, unit.timezone).getTime(),
        atMinutes(day, o.closeMin, unit.timezone).getTime(),
      ),
    ),
  )
  const earliest =
    channel === 'online' ? now.getTime() + unit.min_lead_minutes * 60_000 : now.getTime()
  const future = subtract(openWindows, [interval(0, earliest)])

  return team.map((row) => {
    const scheduled = merge(
      (schedules.get(row.id) ?? []).map((s) =>
        interval(
          atMinutes(day, s.starts_min, unit.timezone).getTime(),
          atMinutes(day, s.ends_min, unit.timezone).getTime(),
        ),
      ),
    )
    if (scheduled.length === 0) return shape(row, 'off', 0)

    const working = subtract(
      scheduled,
      (absences.get(row.id) ?? []).map((a) =>
        interval(a.starts_at.getTime(), a.ends_at.getTime()),
      ),
    )
    if (working.length === 0) return shape(row, 'off', 0)

    // Livre = escalada, dentro da abertura, ainda por vir, e sem bloco.
    const free = subtract(
      subtract(working, invert(future)),
      (blocks.get(row.id) ?? []).map((b) => interval(b.s.getTime(), b.e.getTime())),
    )
    const minutes = Math.round(totalMinutes(free))
    // Menos do que a menor fatia da loja não dá para marcar nada.
    if (minutes < unit.slot_granularity_minutes) return shape(row, 'full', 0)
    return shape(row, 'none', minutes)
  })
}

/** O complemento de uma lista de intervalos, para a poder subtrair. */
function invert(list: readonly Interval[]): Interval[] {
  const merged = merge(list)
  const out: Interval[] = []
  let cursor = -Infinity
  for (const piece of merged) {
    if (cursor < piece.start) out.push(interval(cursor, piece.start))
    cursor = piece.end
  }
  out.push(interval(cursor, Infinity))
  return out
}
