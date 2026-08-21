import 'server-only'
import { sql } from '@/lib/db'
import type { Cents } from '@/lib/money'

/**
 * GERIR O CATÁLOGO.
 *
 * O serviço é da rede: tem categoria, preço-base, duração, folgas antes
 * e depois, e um interruptor de "marcável online". O que varia por loja
 * ou por profissional não muda o serviço — escreve-se como excepção, e
 * a precedência é sempre profissional+loja → profissional → loja → base.
 *
 * A habilidade (quem executa o quê) mora na equipa; aqui só se mostra
 * quem já a tem, para não se publicar um serviço que ninguém faz.
 */

const UNIQUE = '23505'

function codeOf(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code)
  }
  return null
}

// ---------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------

export type Category = {
  id: string
  slug: string
  name: string
  sort_order: number
  services: number
}

export async function listCategories(orgId: string): Promise<Category[]> {
  return sql<Category[]>`
    select c.id, c.slug, c.name, c.sort_order,
           (select count(*)::int from service s
             where s.category_id = c.id and s.is_active) as services
      from service_category c
     where c.org_id = ${orgId} and c.is_active
     order by c.sort_order, c.name
  `
}

export type CategoryResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'taken' | 'invalid' | 'in_use' }

export async function createCategory(
  orgId: string,
  name: string,
  slug: string,
): Promise<CategoryResult> {
  if (!name.trim() || !slug) return { ok: false, reason: 'invalid' }
  try {
    const rows = await sql<{ id: string }[]>`
      insert into service_category (org_id, slug, name, sort_order)
      values (
        ${orgId}, ${slug}, ${name.trim()},
        (select coalesce(max(sort_order), 0) + 1 from service_category
          where org_id = ${orgId})
      )
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

export async function renameCategory(
  orgId: string,
  id: string,
  name: string,
): Promise<CategoryResult> {
  if (!name.trim()) return { ok: false, reason: 'invalid' }
  await sql`
    update service_category set name = ${name.trim()}
     where id = ${id} and org_id = ${orgId}
  `
  return { ok: true, id }
}

/** Uma categoria com serviços dentro não se apaga — arrastava-os. */
export async function removeCategory(
  orgId: string,
  id: string,
): Promise<CategoryResult> {
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from service
     where category_id = ${id} and is_active
  `
  if ((rows[0]?.n ?? 0) > 0) return { ok: false, reason: 'in_use' }

  await sql`
    update service_category set is_active = false
     where id = ${id} and org_id = ${orgId}
  `
  return { ok: true, id }
}

// ---------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------

export type ServiceRow = {
  id: string
  slug: string
  name: string
  category_id: string
  category_name: string
  base_price_cents: number
  duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  bookable_online: boolean
  description: string | null
  skilled: number
  overrides: number
}

export async function listServices(orgId: string): Promise<ServiceRow[]> {
  return sql<ServiceRow[]>`
    select s.id, s.slug, s.name, s.category_id, c.name as category_name,
           s.base_price_cents, s.duration_minutes,
           s.buffer_before_minutes, s.buffer_after_minutes,
           s.bookable_online, s.description,
           (select count(*)::int from staff_skill k
             join staff st on st.id = k.staff_id
            where k.service_id = s.id and st.is_active) as skilled,
           (select count(*)::int from price_override o
             where o.service_id = s.id) as overrides
      from service s
      join service_category c on c.id = s.category_id
     where s.org_id = ${orgId} and s.is_active
     order by c.sort_order, c.name, s.sort_order, s.name
  `
}

export async function getService(
  orgId: string,
  id: string,
): Promise<ServiceRow | null> {
  const rows = await sql<ServiceRow[]>`
    select s.id, s.slug, s.name, s.category_id, c.name as category_name,
           s.base_price_cents, s.duration_minutes,
           s.buffer_before_minutes, s.buffer_after_minutes,
           s.bookable_online, s.description,
           0 as skilled, 0 as overrides
      from service s
      join service_category c on c.id = s.category_id
     where s.id = ${id} and s.org_id = ${orgId} and s.is_active
     limit 1
  `
  return rows[0] ?? null
}

export type ServiceInput = {
  categoryId: string
  slug: string
  name: string
  description: string | null
  basePriceCents: Cents
  durationMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  bookableOnline: boolean
}

export type ServiceResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'taken' | 'invalid' | 'not_found' }

function invalid(input: ServiceInput): boolean {
  return (
    !input.name.trim() ||
    !input.slug ||
    !input.categoryId ||
    input.basePriceCents < 0 ||
    input.durationMinutes <= 0 ||
    input.bufferBeforeMinutes < 0 ||
    input.bufferAfterMinutes < 0
  )
}

export async function createService(
  orgId: string,
  input: ServiceInput,
): Promise<ServiceResult> {
  if (invalid(input)) return { ok: false, reason: 'invalid' }

  try {
    const rows = await sql<{ id: string }[]>`
      insert into service (
        org_id, category_id, slug, name, description,
        base_price_cents, duration_minutes,
        buffer_before_minutes, buffer_after_minutes,
        bookable_online, sort_order
      ) values (
        ${orgId}, ${input.categoryId}, ${input.slug}, ${input.name.trim()},
        ${input.description},
        ${input.basePriceCents}, ${input.durationMinutes},
        ${input.bufferBeforeMinutes}, ${input.bufferAfterMinutes},
        ${input.bookableOnline},
        (select coalesce(max(sort_order), 0) + 1 from service
          where category_id = ${input.categoryId})
      )
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

export async function updateService(
  orgId: string,
  id: string,
  input: ServiceInput,
): Promise<ServiceResult> {
  if (invalid(input)) return { ok: false, reason: 'invalid' }

  try {
    const rows = await sql<{ id: string }[]>`
      update service set
        category_id = ${input.categoryId},
        slug = ${input.slug},
        name = ${input.name.trim()},
        description = ${input.description},
        base_price_cents = ${input.basePriceCents},
        duration_minutes = ${input.durationMinutes},
        buffer_before_minutes = ${input.bufferBeforeMinutes},
        buffer_after_minutes = ${input.bufferAfterMinutes},
        bookable_online = ${input.bookableOnline}
       where id = ${id} and org_id = ${orgId}
       returning id
    `
    const row = rows[0]
    if (!row) return { ok: false, reason: 'not_found' }
    return { ok: true, id: row.id }
  } catch (error) {
    if (codeOf(error) === UNIQUE) return { ok: false, reason: 'taken' }
    throw error
  }
}

/**
 * Retirar do catálogo, não apagar: o que já foi feito guarda o nome e o
 * preço congelados, mas a marcação futura deixa de o encontrar.
 */
export async function retireService(
  orgId: string,
  id: string,
): Promise<void> {
  await sql`
    update service set is_active = false, bookable_online = false
     where id = ${id} and org_id = ${orgId}
  `
}

// ---------------------------------------------------------------------
// Excepções de preço e duração
// ---------------------------------------------------------------------

export type Override = {
  id: string
  unit_id: string | null
  staff_id: string | null
  unit_name: string | null
  staff_name: string | null
  price_cents: number | null
  duration_minutes: number | null
  note: string | null
}

/** Ordenadas como a precedência as lê: da mais específica à mais geral. */
export async function listOverrides(
  serviceId: string,
): Promise<Override[]> {
  return sql<Override[]>`
    select o.id, o.unit_id, o.staff_id,
           u.name as unit_name, s.name as staff_name,
           o.price_cents, o.duration_minutes, o.note
      from price_override o
      left join unit u on u.id = o.unit_id
      left join staff s on s.id = o.staff_id
     where o.service_id = ${serviceId}
     order by (o.staff_id is not null and o.unit_id is not null) desc,
              (o.staff_id is not null) desc,
              s.name nulls first, u.name nulls first
  `
}

export type OverrideResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'empty' }

/**
 * Uma excepção por combinação: gravar a mesma outra vez muda-a. E uma
 * excepção que não muda nem preço nem duração não é excepção nenhuma.
 */
export async function saveOverride(
  orgId: string,
  serviceId: string,
  input: {
    unitId: string | null
    staffId: string | null
    priceCents: Cents | null
    durationMinutes: number | null
    note: string | null
  },
): Promise<OverrideResult> {
  if (!input.unitId && !input.staffId) return { ok: false, reason: 'invalid' }
  if (input.priceCents === null && input.durationMinutes === null) {
    return { ok: false, reason: 'empty' }
  }
  if (input.priceCents !== null && input.priceCents < 0) {
    return { ok: false, reason: 'invalid' }
  }
  if (input.durationMinutes !== null && input.durationMinutes <= 0) {
    return { ok: false, reason: 'invalid' }
  }

  await sql`
    insert into price_override
      (org_id, service_id, unit_id, staff_id, price_cents, duration_minutes, note)
    values
      (${orgId}, ${serviceId}, ${input.unitId}, ${input.staffId},
       ${input.priceCents}, ${input.durationMinutes}, ${input.note})
    on conflict (service_id, unit_id, staff_id) do update set
      price_cents = excluded.price_cents,
      duration_minutes = excluded.duration_minutes,
      note = excluded.note
  `
  return { ok: true }
}

export async function removeOverride(
  orgId: string,
  serviceId: string,
  id: string,
): Promise<void> {
  await sql`
    delete from price_override
     where id = ${id} and service_id = ${serviceId} and org_id = ${orgId}
  `
}

// ---------------------------------------------------------------------
// Recursos que o serviço consome
// ---------------------------------------------------------------------

export type Requirement = {
  resource_type_id: string
  type_name: string
  quantity: number
  /** Quantos existem, na loja mais pobre da rede. */
  fewest: number
}

export async function listRequirements(
  serviceId: string,
  orgId: string,
): Promise<Requirement[]> {
  return sql<Requirement[]>`
    select r.resource_type_id, t.name as type_name, r.quantity,
           coalesce((
             select min(counted.n) from (
               select count(res.id) as n
                 from unit u
                 left join resource res
                        on res.unit_id = u.id
                       and res.resource_type_id = r.resource_type_id
                       and res.is_active
                where u.org_id = ${orgId} and u.is_active
                group by u.id
             ) counted
           ), 0)::int as fewest
      from service_resource_requirement r
      join resource_type t on t.id = r.resource_type_id
     where r.service_id = ${serviceId}
     order by t.name
  `
}

export async function saveRequirement(
  serviceId: string,
  typeId: string,
  quantity: number,
): Promise<{ ok: boolean }> {
  if (!typeId || !Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false }
  }
  await sql`
    insert into service_resource_requirement (service_id, resource_type_id, quantity)
    values (${serviceId}, ${typeId}, ${quantity})
    on conflict (service_id, resource_type_id)
      do update set quantity = excluded.quantity
  `
  return { ok: true }
}

export async function removeRequirement(
  serviceId: string,
  typeId: string,
): Promise<void> {
  await sql`
    delete from service_resource_requirement
     where service_id = ${serviceId} and resource_type_id = ${typeId}
  `
}

// ---------------------------------------------------------------------
// Quem o faz
// ---------------------------------------------------------------------

export type Skilled = { id: string; name: string; accepts_online: boolean }

export async function listSkilled(serviceId: string): Promise<Skilled[]> {
  return sql<Skilled[]>`
    select s.id, s.name, s.accepts_online_booking as accepts_online
      from staff_skill k
      join staff s on s.id = k.staff_id
     where k.service_id = ${serviceId} and s.is_active
     order by s.name
  `
}

/** Lojas e equipa, para escrever uma excepção. */
export async function overrideOptions(orgId: string): Promise<{
  units: { id: string; name: string }[]
  staff: { id: string; name: string }[]
}> {
  const [units, staff] = await Promise.all([
    sql<{ id: string; name: string }[]>`
      select id, name from unit
       where org_id = ${orgId} and is_active
       order by sort_order, name
    `,
    sql<{ id: string; name: string }[]>`
      select id, name from staff
       where org_id = ${orgId} and is_active
       order by name
    `,
  ])
  return { units, staff }
}
