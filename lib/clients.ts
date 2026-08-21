import 'server-only'
import { sql } from '@/lib/db'
import type { Status } from '@/lib/booking'
import { isLanguage, type Language } from '@/lib/i18n/config'
import { normalisePhone } from '@/lib/env'
import type { ParsedClient } from '@/lib/csv'

/**
 * AS CLIENTES.
 *
 * O TELEFONE É A IDENTIDADE: é único na rede, e por isso a mesma pessoa
 * nas duas lojas é uma só ficha — o histórico atravessa as lojas.
 *
 * A ficha guarda o que serve para atender bem: a bebida, a alergia, a
 * nota do serviço, a loja e a profissional de preferência, a língua. As
 * notas internas são da equipa e nunca aparecem à cliente.
 */

export type ClientRow = {
  id: string
  name: string
  phone: string
  email: string | null
  language: Language
  tags: string[]
  no_show_count: number
  first_visit_at: Date | null
  last_visit_at: Date | null
  preferred_unit_name: string | null
  visits: number
  next_at: Date | null
}

export type ClientDetail = ClientRow & {
  org_id: string
  birthdate: string | null
  drink_preference: string | null
  allergies: string | null
  service_notes: string | null
  preferred_unit_id: string | null
  preferred_staff_id: string | null
  preferred_staff_name: string | null
  is_active: boolean
  created_at: Date
}

export type ClientVisit = {
  appointment_id: string
  unit_slug: string
  unit_name: string
  timezone: string
  starts_at: Date
  status: Status
  closed_at: Date | null
  services: string | null
  staff_names: string | null
  gross_cents: number
  discount_cents: number
}

export type ClientNote = {
  id: string
  body: string
  author: string | null
  created_at: Date
}

/** Só os dígitos — é assim que se procura um telefone escrito de qualquer maneira. */
export function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

const LIST_LIMIT = 50

/**
 * A lista. Procura pelo nome ou pelo telefone — e o telefone compara-se
 * só por dígitos, porque ninguém o escreve duas vezes da mesma forma.
 */
export async function searchClients(
  orgId: string,
  options: { term?: string; tag?: string; offset?: number } = {},
): Promise<{ rows: ClientRow[]; total: number }> {
  const term = (options.term ?? '').trim()
  const digits = digitsOf(term)
  const tag = (options.tag ?? '').trim()
  const offset = Math.max(0, options.offset ?? 0)

  // Fragmento novo a cada uso: o mesmo pedaço não se serve a duas consultas.
  const where = () => sql`
    c.org_id = ${orgId}
    and (${term}::text = '' or (
      c.name ilike ${'%' + term + '%'}
      or (${digits}::text <> '' and regexp_replace(c.phone, '\\D', '', 'g') like ${'%' + digits + '%'})
    ))
    and (${tag}::text = '' or ${tag} = any(c.tags))
  `

  const [rows, counted] = await Promise.all([
    sql<ClientRow[]>`
      select c.id, c.name, c.phone, c.email, c.language, c.tags,
             c.no_show_count, c.first_visit_at, c.last_visit_at,
             u.name as preferred_unit_name,
             (select count(*)::int from appointment a
               where a.client_id = c.id and a.status = 'completed') as visits,
             (select min(a.starts_at) from appointment a
               where a.client_id = c.id
                 and a.starts_at > now()
                 and a.status in ('booked','confirmed','checked_in','in_service')
             ) as next_at
        from client c
        left join unit u on u.id = c.preferred_unit_id
       where ${where()}
       order by c.name
       limit ${LIST_LIMIT} offset ${offset}
    `,
    sql<{ total: number }[]>`
      select count(*)::int as total from client c where ${where()}
    `,
  ])

  return { rows, total: counted[0]?.total ?? 0 }
}

/** As etiquetas em uso, para se filtrar por elas. */
export async function listTags(
  orgId: string,
): Promise<{ tag: string; count: number }[]> {
  return sql<{ tag: string; count: number }[]>`
    select t.tag, count(*)::int as count
      from client c, unnest(c.tags) as t(tag)
     where c.org_id = ${orgId}
     group by t.tag
     order by count desc, t.tag
     limit 24
  `
}

export async function getClient(
  orgId: string,
  clientId: string,
): Promise<ClientDetail | null> {
  const rows = await sql<ClientDetail[]>`
    select c.id, c.org_id, c.name, c.phone, c.email, c.language, c.tags,
           to_char(c.birthdate, 'YYYY-MM-DD') as birthdate,
           c.drink_preference, c.allergies, c.service_notes,
           c.preferred_unit_id, c.preferred_staff_id,
           c.no_show_count, c.first_visit_at, c.last_visit_at,
           c.is_active, c.created_at,
           u.name as preferred_unit_name,
           s.name as preferred_staff_name,
           (select count(*)::int from appointment a
             where a.client_id = c.id and a.status = 'completed') as visits,
           (select min(a.starts_at) from appointment a
             where a.client_id = c.id
               and a.starts_at > now()
               and a.status in ('booked','confirmed','checked_in','in_service')
           ) as next_at
      from client c
      left join unit u on u.id = c.preferred_unit_id
      left join staff s on s.id = c.preferred_staff_id
     where c.id = ${clientId} and c.org_id = ${orgId}
  `
  return rows[0] ?? null
}

export async function findByPhone(
  orgId: string,
  phone: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from client
     where org_id = ${orgId}
       and regexp_replace(phone, '\\D', '', 'g') = ${digitsOf(phone)}
     limit 1
  `
  return rows[0] ?? null
}

/** O histórico atravessa as lojas: é uma ficha só na rede. */
export async function clientVisits(
  clientId: string,
  limit = 60,
): Promise<ClientVisit[]> {
  return sql<ClientVisit[]>`
    select a.id as appointment_id, u.slug as unit_slug, u.name as unit_name,
           u.timezone, a.starts_at, a.status, a.closed_at, a.discount_cents,
           coalesce((select sum(i.price_cents)::int from appointment_item i
                      where i.appointment_id = a.id), 0) as gross_cents,
           (select string_agg(i.service_name, ' + ' order by i.sort_order)
              from appointment_item i where i.appointment_id = a.id) as services,
           (select string_agg(distinct s.name, ', ' order by s.name)
              from appointment_item i join staff s on s.id = i.staff_id
             where i.appointment_id = a.id) as staff_names
      from appointment a
      join unit u on u.id = a.unit_id
     where a.client_id = ${clientId}
     order by a.starts_at desc
     limit ${limit}
  `
}

/** Notas internas: da equipa para a equipa. */
export async function clientNotes(clientId: string): Promise<ClientNote[]> {
  return sql<ClientNote[]>`
    select n.id, n.body, n.created_at, s.name as author
      from client_note n
      left join staff s on s.id = n.author_id
     where n.client_id = ${clientId}
     order by n.created_at desc
  `
}

/** As escolhas de preferência da ficha: lojas e pessoas, pelo nome. */
export async function preferenceOptions(orgId: string): Promise<{
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
       order by sort_order, name
    `,
  ])
  return { units, staff }
}

export type ClientInput = {
  name: string
  phone: string
  email: string | null
  language: Language
  birthdate: string | null
  preferredUnitId: string | null
  preferredStaffId: string | null
  drinkPreference: string | null
  allergies: string | null
  serviceNotes: string | null
  tags: string[]
}

export type SaveResult =
  | { ok: true; clientId: string }
  | { ok: false; reason: 'duplicate_phone' | 'not_found' }

/** Criar. O telefone é a identidade — se já existir, não se cria outra. */
export async function createClient(
  orgId: string,
  input: ClientInput,
): Promise<SaveResult> {
  const clash = await findByPhone(orgId, input.phone)
  if (clash) return { ok: false, reason: 'duplicate_phone' }

  const rows = await sql<{ id: string }[]>`
    insert into client
      (org_id, name, phone, email, language, birthdate,
       preferred_unit_id, preferred_staff_id,
       drink_preference, allergies, service_notes, tags)
    values
      (${orgId}, ${input.name}, ${input.phone}, ${input.email},
       ${input.language}, ${input.birthdate}::date,
       ${input.preferredUnitId}, ${input.preferredStaffId},
       ${input.drinkPreference}, ${input.allergies}, ${input.serviceNotes},
       ${input.tags})
    returning id
  `
  const row = rows[0]
  if (!row) return { ok: false, reason: 'not_found' }
  return { ok: true, clientId: row.id }
}

export async function updateClient(
  orgId: string,
  clientId: string,
  input: ClientInput,
): Promise<SaveResult> {
  const clash = await sql<{ id: string }[]>`
    select id from client
     where org_id = ${orgId}
       and id <> ${clientId}
       and regexp_replace(phone, '\\D', '', 'g') = ${digitsOf(input.phone)}
     limit 1
  `
  if (clash[0]) return { ok: false, reason: 'duplicate_phone' }

  const rows = await sql<{ id: string }[]>`
    update client
       set name = ${input.name},
           phone = ${input.phone},
           email = ${input.email},
           language = ${input.language},
           birthdate = ${input.birthdate}::date,
           preferred_unit_id = ${input.preferredUnitId},
           preferred_staff_id = ${input.preferredStaffId},
           drink_preference = ${input.drinkPreference},
           allergies = ${input.allergies},
           service_notes = ${input.serviceNotes},
           tags = ${input.tags}
     where id = ${clientId} and org_id = ${orgId}
     returning id
  `
  const row = rows[0]
  if (!row) return { ok: false, reason: 'not_found' }
  return { ok: true, clientId: row.id }
}

export async function addNote(input: {
  clientId: string
  body: string
  authorId: string
}): Promise<void> {
  await sql`
    insert into client_note (client_id, author_id, body)
    values (${input.clientId}, ${input.authorId}, ${input.body})
  `
}

export async function removeNote(
  clientId: string,
  noteId: string,
): Promise<void> {
  await sql`
    delete from client_note where id = ${noteId} and client_id = ${clientId}
  `
}

// ---------------------------------------------------------------------
// Importar de um ficheiro
// ---------------------------------------------------------------------

/**
 * A importação mostra-se antes de acontecer. Cada linha recebe um
 * veredito, e quem importa vê a conta feita antes de carregar no botão.
 *
 * Quem já cá está NÃO É TOCADO: o telefone é a identidade, e uma folha
 * de cálculo não manda na ficha que a casa já tem.
 */
export type ImportVerdict = 'create' | 'exists' | 'invalid' | 'repeated'

export type ImportRow = {
  line: number
  name: string
  phone: string
  verdict: ImportVerdict
  problem: string | null
  existingId: string | null
}

const IMPORT_LIMIT = 2000

export async function planImport(
  orgId: string,
  records: readonly ParsedClient[],
): Promise<{ rows: ImportRow[]; toCreate: number }> {
  const existing = await sql<{ id: string; digits: string }[]>`
    select id, regexp_replace(phone, '\\D', '', 'g') as digits
      from client where org_id = ${orgId}
  `
  const known = new Map(existing.map((row) => [row.digits, row.id]))
  const seen = new Set<string>()

  const rows = records.slice(0, IMPORT_LIMIT).map((record): ImportRow => {
    const name = record.name.trim()
    const phone = normalisePhone(record.phone)
    const digits = digitsOf(phone)

    const base = { line: record.line, name, phone }

    if (!name) {
      return { ...base, verdict: 'invalid', problem: 'Sem nome.', existingId: null }
    }
    if (digits.length < 6) {
      return {
        ...base,
        verdict: 'invalid',
        problem: 'Telefone em falta ou curto demais.',
        existingId: null,
      }
    }
    const found = known.get(digits)
    if (found) {
      return {
        ...base,
        verdict: 'exists',
        problem: 'Já tem ficha — não se toca no que lá está.',
        existingId: found,
      }
    }
    if (seen.has(digits)) {
      return {
        ...base,
        verdict: 'repeated',
        problem: 'Telefone repetido dentro do próprio ficheiro.',
        existingId: null,
      }
    }
    seen.add(digits)
    return { ...base, verdict: 'create', problem: null, existingId: null }
  })

  return {
    rows,
    toCreate: rows.filter((row) => row.verdict === 'create').length,
  }
}

/** Grava o que o plano deu como novo — e só isso. */
export async function runImport(
  orgId: string,
  records: readonly ParsedClient[],
): Promise<{ created: number; skipped: number }> {
  const plan = await planImport(orgId, records)
  const byLine = new Map(records.map((record) => [record.line, record]))

  let created = 0
  for (const row of plan.rows) {
    if (row.verdict !== 'create') continue
    const record = byLine.get(row.line)
    if (!record) continue

    const rows = await sql<{ id: string }[]>`
      insert into client
        (org_id, name, phone, email, language, birthdate,
         drink_preference, allergies, service_notes, tags)
      values
        (${orgId}, ${row.name}, ${row.phone}, ${record.email},
         ${isLanguage(record.language) ? record.language : 'pt'},
         ${record.birthdate}::date,
         ${record.drink}, ${record.allergies}, ${record.notes}, ${record.tags})
      on conflict (org_id, phone) do nothing
      returning id
    `
    if (rows[0]) created++
  }

  return { created, skipped: plan.rows.length - created }
}
