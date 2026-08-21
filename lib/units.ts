import 'server-only'
import { sql } from '@/lib/db'
import type { Unit } from '@/lib/org'
import type { IsoDay, Minutes } from '@/lib/time'

/**
 * GERIR AS LOJAS.
 *
 * O horário é por dia da semana, com várias faixas no mesmo dia — é
 * assim que se representa a pausa de almoço. Os feriados e horários
 * especiais substituem por completo o dia normal. E as regras de
 * marcação (granularidade, antecedência, intervalo) são o que o motor
 * de disponibilidade obedece.
 *
 * A trava contra faixas sobrepostas é da base de dados. Aqui apanha-se
 * o erro e diz-se-o por palavras.
 */

const OVERLAP = '23P01' // exclusion_violation
const UNIQUE = '23505'

function codeOf(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code)
  }
  return null
}

// ---------------------------------------------------------------------
// A loja
// ---------------------------------------------------------------------

export type UnitSummary = Unit & {
  staff_count: number
  resource_count: number
  open_days: number
}

export async function listUnitsForAdmin(
  orgId: string,
): Promise<UnitSummary[]> {
  return sql<UnitSummary[]>`
    select u.*,
      (select count(*)::int from staff_unit su
        join staff s on s.id = su.staff_id
       where su.unit_id = u.id and s.is_active) as staff_count,
      (select count(*)::int from resource r
        where r.unit_id = u.id and r.is_active) as resource_count,
      (select count(distinct bh.weekday)::int from business_hours bh
        where bh.unit_id = u.id) as open_days
      from unit u
     where u.org_id = ${orgId} and u.is_active
     order by u.sort_order, u.name
  `
}

export async function getUnitForAdmin(
  orgId: string,
  id: string,
): Promise<Unit | null> {
  const rows = await sql<Unit[]>`
    select * from unit where id = ${id} and org_id = ${orgId} limit 1
  `
  return rows[0] ?? null
}

export type UnitDetails = {
  name: string
  slug: string
  timezone: string
  addressLine: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
  whatsappPhone: string | null
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'slug_taken' | 'invalid' | 'not_found' }

export async function createUnit(
  orgId: string,
  input: UnitDetails,
): Promise<SaveResult> {
  if (!input.name.trim() || !input.slug) return { ok: false, reason: 'invalid' }

  try {
    const rows = await sql<{ id: string }[]>`
      insert into unit (
        org_id, slug, name, timezone,
        address_line, postal_code, city, phone, email, whatsapp_phone,
        sort_order
      ) values (
        ${orgId}, ${input.slug}, ${input.name.trim()}, ${input.timezone},
        ${input.addressLine}, ${input.postalCode}, ${input.city},
        ${input.phone}, ${input.email}, ${input.whatsappPhone},
        (select coalesce(max(sort_order), 0) + 1 from unit where org_id = ${orgId})
      )
      returning id
    `
    const created = rows[0]
    if (!created) return { ok: false, reason: 'invalid' }
    return { ok: true, id: created.id }
  } catch (error) {
    if (codeOf(error) === UNIQUE) return { ok: false, reason: 'slug_taken' }
    throw error
  }
}

export async function updateUnit(
  orgId: string,
  id: string,
  input: UnitDetails,
): Promise<SaveResult> {
  if (!input.name.trim() || !input.slug) return { ok: false, reason: 'invalid' }

  try {
    const rows = await sql<{ id: string }[]>`
      update unit set
        slug = ${input.slug},
        name = ${input.name.trim()},
        timezone = ${input.timezone},
        address_line = ${input.addressLine},
        postal_code = ${input.postalCode},
        city = ${input.city},
        phone = ${input.phone},
        email = ${input.email},
        whatsapp_phone = ${input.whatsappPhone}
       where id = ${id} and org_id = ${orgId}
       returning id
    `
    const row = rows[0]
    if (!row) return { ok: false, reason: 'not_found' }
    return { ok: true, id: row.id }
  } catch (error) {
    if (codeOf(error) === UNIQUE) return { ok: false, reason: 'slug_taken' }
    throw error
  }
}

export type BookingRules = {
  minLeadMinutes: number
  maxLeadDays: number
  slotGranularityMinutes: number
  gapBetweenServicesMinutes: number
  cancelWindowHours: number
  assignmentStrategy: Unit['assignment_strategy']
}

export async function updateBookingRules(
  orgId: string,
  id: string,
  input: BookingRules,
): Promise<SaveResult> {
  const bad =
    input.minLeadMinutes < 0 ||
    input.maxLeadDays <= 0 ||
    input.slotGranularityMinutes < 5 ||
    input.slotGranularityMinutes > 120 ||
    input.gapBetweenServicesMinutes < 0 ||
    input.cancelWindowHours < 0
  if (bad) return { ok: false, reason: 'invalid' }

  const rows = await sql<{ id: string }[]>`
    update unit set
      min_lead_minutes = ${input.minLeadMinutes},
      max_lead_days = ${input.maxLeadDays},
      slot_granularity_minutes = ${input.slotGranularityMinutes},
      gap_between_services_minutes = ${input.gapBetweenServicesMinutes},
      cancel_window_hours = ${input.cancelWindowHours},
      assignment_strategy = ${input.assignmentStrategy}
     where id = ${id} and org_id = ${orgId}
     returning id
  `
  const row = rows[0]
  if (!row) return { ok: false, reason: 'not_found' }
  return { ok: true, id: row.id }
}

/**
 * Desactivar, não apagar: uma loja com histórico não desaparece sem
 * levar a agenda consigo.
 */
export async function deactivateUnit(
  orgId: string,
  id: string,
): Promise<void> {
  await sql`
    update unit set is_active = false
     where id = ${id} and org_id = ${orgId}
  `
}

// ---------------------------------------------------------------------
// Horário normal
// ---------------------------------------------------------------------

export type HoursRow = {
  id: string
  weekday: number
  opens_min: number
  closes_min: number
}

export async function listHours(unitId: string): Promise<HoursRow[]> {
  return sql<HoursRow[]>`
    select id, weekday, opens_min, closes_min
      from business_hours
     where unit_id = ${unitId}
     order by weekday, opens_min
  `
}

export type HoursResult =
  | { ok: true }
  | { ok: false; reason: 'overlap' | 'invalid' }

export async function addHours(
  unitId: string,
  weekday: number,
  opensMin: Minutes,
  closesMin: Minutes,
): Promise<HoursResult> {
  if (weekday < 0 || weekday > 6) return { ok: false, reason: 'invalid' }
  if (closesMin <= opensMin) return { ok: false, reason: 'invalid' }

  try {
    await sql`
      insert into business_hours (unit_id, weekday, opens_min, closes_min)
      values (${unitId}, ${weekday}, ${opensMin}, ${closesMin})
    `
    return { ok: true }
  } catch (error) {
    if (codeOf(error) === OVERLAP) return { ok: false, reason: 'overlap' }
    throw error
  }
}

export async function removeHours(unitId: string, id: string): Promise<void> {
  await sql`delete from business_hours where id = ${id} and unit_id = ${unitId}`
}

/** Copiar um dia para os outros poupa seis vezes o mesmo trabalho. */
export async function copyWeekday(
  unitId: string,
  from: number,
  to: number[],
): Promise<void> {
  const targets = to.filter((day) => day >= 0 && day <= 6 && day !== from)
  if (targets.length === 0) return

  await sql.begin(async (tx) => {
    await tx`
      delete from business_hours
       where unit_id = ${unitId} and weekday = any(${targets}::smallint[])
    `
    await tx`
      insert into business_hours (unit_id, weekday, opens_min, closes_min)
      select ${unitId}, d.weekday, b.opens_min, b.closes_min
        from business_hours b
        cross join unnest(${targets}::smallint[]) as d(weekday)
       where b.unit_id = ${unitId} and b.weekday = ${from}
    `
  })
}

// ---------------------------------------------------------------------
// Feriados e horários especiais
// ---------------------------------------------------------------------

export type SpecialRow = {
  id: string
  on_date: string
  is_closed: boolean
  opens_min: number | null
  closes_min: number | null
  note: string | null
}

export async function listSpecialHours(
  unitId: string,
  from: IsoDay,
): Promise<SpecialRow[]> {
  return sql<SpecialRow[]>`
    select id, to_char(on_date, 'YYYY-MM-DD') as on_date,
           is_closed, opens_min, closes_min, note
      from special_hours
     where unit_id = ${unitId} and on_date >= ${from}
     order by on_date, opens_min nulls first
  `
}

export type SpecialResult =
  | { ok: true }
  | { ok: false; reason: 'overlap' | 'invalid' }

/**
 * Uma linha para a data substitui o dia inteiro. Fechar e abrir mais
 * tarde no mesmo dia é contradição, e a base de dados recusa-a.
 */
export async function addSpecial(
  unitId: string,
  input: {
    day: IsoDay
    isClosed: boolean
    opensMin: Minutes | null
    closesMin: Minutes | null
    note: string | null
  },
): Promise<SpecialResult> {
  if (!input.isClosed) {
    if (input.opensMin === null || input.closesMin === null) {
      return { ok: false, reason: 'invalid' }
    }
    if (input.closesMin <= input.opensMin) {
      return { ok: false, reason: 'invalid' }
    }
  }

  try {
    await sql`
      insert into special_hours
        (unit_id, on_date, is_closed, opens_min, closes_min, note)
      values (
        ${unitId}, ${input.day}, ${input.isClosed},
        ${input.isClosed ? null : input.opensMin},
        ${input.isClosed ? null : input.closesMin},
        ${input.note}
      )
    `
    return { ok: true }
  } catch (error) {
    if (codeOf(error) === OVERLAP) return { ok: false, reason: 'overlap' }
    throw error
  }
}

export async function removeSpecial(
  unitId: string,
  id: string,
): Promise<void> {
  await sql`delete from special_hours where id = ${id} and unit_id = ${unitId}`
}

// ---------------------------------------------------------------------
// Recursos físicos: o tipo é da rede, a instância é da loja
// ---------------------------------------------------------------------

export type ResourceType = {
  id: string
  slug: string
  name: string
  instances: number
}

export async function listResourceTypes(
  orgId: string,
): Promise<ResourceType[]> {
  return sql<ResourceType[]>`
    select t.id, t.slug, t.name,
           (select count(*)::int from resource r
             where r.resource_type_id = t.id and r.is_active) as instances
      from resource_type t
     where t.org_id = ${orgId}
     order by t.name
  `
}

export type TypeResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'taken' | 'invalid' | 'in_use' }

export async function createResourceType(
  orgId: string,
  name: string,
  slug: string,
): Promise<TypeResult> {
  if (!name.trim() || !slug) return { ok: false, reason: 'invalid' }
  try {
    const rows = await sql<{ id: string }[]>`
      insert into resource_type (org_id, slug, name)
      values (${orgId}, ${slug}, ${name.trim()})
      returning id
    `
    const row = rows[0]
    if (!row) return { ok: false, reason: 'invalid' }
    return { ok: true, id: row.id }
  } catch (error) {
    if (codeOf(error) === UNIQUE) return { ok: false, reason: 'taken' }
    throw error
  }
}

/**
 * Um tipo só sai quando não houver instância nem serviço a contar com
 * ele — senão apagava-se a razão pela qual há horários indisponíveis.
 */
export async function removeResourceType(
  orgId: string,
  id: string,
): Promise<TypeResult> {
  const used = await sql<{ n: number }[]>`
    select (
      (select count(*) from resource where resource_type_id = ${id}) +
      (select count(*) from service_resource_requirement
        where resource_type_id = ${id})
    )::int as n
  `
  if ((used[0]?.n ?? 0) > 0) return { ok: false, reason: 'in_use' }

  await sql`delete from resource_type where id = ${id} and org_id = ${orgId}`
  return { ok: true, id }
}

export type ResourceRow = {
  id: string
  name: string
  resource_type_id: string
  type_name: string
}

export async function listResources(unitId: string): Promise<ResourceRow[]> {
  return sql<ResourceRow[]>`
    select r.id, r.name, r.resource_type_id, t.name as type_name
      from resource r
      join resource_type t on t.id = r.resource_type_id
     where r.unit_id = ${unitId} and r.is_active
     order by t.name, r.sort_order, r.name
  `
}

export async function createResource(
  unitId: string,
  typeId: string,
  name: string,
): Promise<{ ok: boolean }> {
  if (!name.trim()) return { ok: false }
  await sql`
    insert into resource (unit_id, resource_type_id, name, sort_order)
    values (
      ${unitId}, ${typeId}, ${name.trim()},
      (select coalesce(max(sort_order), 0) + 1 from resource
        where unit_id = ${unitId} and resource_type_id = ${typeId})
    )
  `
  return { ok: true }
}

/**
 * Um recurso que já ocupou horários não se apaga — desactiva-se, e
 * deixa de contar para o que se marca de hoje em diante.
 */
export async function removeResource(
  unitId: string,
  id: string,
): Promise<void> {
  await sql`
    update resource set is_active = false
     where id = ${id} and unit_id = ${unitId}
  `
}
