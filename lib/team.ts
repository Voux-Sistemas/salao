import 'server-only'
import { isOverlapError, isUniqueError, sql } from '@/lib/db'
import { canSeeUnit, type Actor } from '@/lib/auth/actor'
import { hashPassword } from '@/lib/auth/password'
import { destroyAllSessions } from '@/lib/auth/session'
import type { IsoDay, Minutes } from '@/lib/time'

/**
 * A EQUIPA.
 *
 * Este é o único separador da gestão que a gerente também abre — e por
 * isso nada aqui usa `requireOrgScope`. O alcance é o das lojas dela:
 * quem atende nas suas lojas existe; quem tem papel de escopo rede (a
 * dona, ou outra gerente da rede) NÃO EXISTE, que é exactamente a mesma
 * resposta que se dá a um identificador inventado.
 *
 * Duas regras que a base de dados escreveu primeiro e aqui só se
 * respeitam:
 *
 *   · TROCAR DE ESCALA É FECHAR A ANTIGA E ABRIR UMA NOVA. Nunca se
 *     edita uma vigência, senão o passado da agenda muda com ela.
 *   · A sobreposição de escalas é problema da restrição de exclusão;
 *     aqui só se traduz o 23P01 para português.
 */

export type Level = 'owner' | 'manager' | 'professional'
export type AbsenceKind = 'day_off' | 'vacation' | 'training' | 'block'

/** Dona (ou suporte). A gerente não passa daqui. */
function isOwner(actor: Actor): boolean {
  return actor.orgScope && actor.role !== 'manager'
}

// ---------------------------------------------------------------------
// Quem é que esta pessoa pode ver
// ---------------------------------------------------------------------

/**
 * Devolve sempre um fragmento novo: o postgres.js não deixa reaproveitar
 * o mesmo pedaço em duas consultas.
 */
function reach(actor: Actor) {
  if (actor.orgScope) return sql`s.org_id = ${actor.orgId}`
  return sql`
    s.org_id = ${actor.orgId}
    and (
      s.id = ${actor.id}
      or (
        exists (
          select 1 from staff_unit su
           where su.staff_id = s.id
             and su.unit_id = any(${actor.unitIds}::uuid[])
        )
        and not exists (
          select 1 from staff_role r
           where r.staff_id = s.id
             and r.unit_id is null
             and r.role in ('owner', 'manager')
        )
      )
    )
  `
}

export type TeamRow = {
  id: string
  name: string
  phone: string
  email: string | null
  display_color: string
  accepts_online_booking: boolean
  is_active: boolean
  has_password: boolean
  roles: Level[]
  org_scope: boolean
  units: string[]
  skills: number
}

export async function listTeam(
  actor: Actor,
  includeInactive = false,
): Promise<TeamRow[]> {
  return sql<TeamRow[]>`
    select
      s.id, s.name, s.phone, s.email, s.display_color,
      s.accepts_online_booking, s.is_active,
      s.password_hash is not null as has_password,
      coalesce(
        (select array_agg(distinct r.role)
           from staff_role r where r.staff_id = s.id),
        '{}'::text[]
      ) as roles,
      exists (
        select 1 from staff_role r
         where r.staff_id = s.id and r.unit_id is null
           and r.role in ('owner', 'manager')
      ) as org_scope,
      coalesce(
        (select array_agg(u.name order by u.sort_order, u.name)
           from staff_unit su
           join unit u on u.id = su.unit_id
          where su.staff_id = s.id and u.is_active),
        '{}'::text[]
      ) as units,
      (select count(*)::int from staff_skill k where k.staff_id = s.id)
        as skills
    from staff s
   where ${reach(actor)}
     and (s.is_active or ${includeInactive}::boolean)
   order by s.is_active desc, s.sort_order, s.name
  `
}

export type Member = {
  id: string
  org_id: string
  name: string
  public_alias: string | null
  phone: string
  email: string | null
  bio: string | null
  avatar_url: string | null
  display_color: string
  accepts_online_booking: boolean
  is_active: boolean
  sort_order: number
  has_password: boolean
}

/** Fora do alcance e inexistente dão a mesma coisa: nulo. */
export async function getMember(
  actor: Actor,
  id: string,
): Promise<Member | null> {
  const rows = await sql<Member[]>`
    select s.id, s.org_id, s.name, s.public_alias, s.phone, s.email,
           s.bio, s.avatar_url,
           s.display_color, s.accepts_online_booking, s.is_active,
           s.sort_order,
           s.password_hash is not null as has_password
      from staff s
     where s.id = ${id} and ${reach(actor)}
  `
  return rows[0] ?? null
}

// ---------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------

export type MemberInput = {
  name: string
  /** Nome mostrado a cliente. Nulo mostra o verdadeiro. */
  publicAlias: string | null
  phone: string
  email: string | null
  bio: string | null
  displayColor: string
  acceptsOnline: boolean
}

export type MemberResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'taken' | 'email_taken' | 'invalid' | 'not_found' }

function takenReason(error: unknown): 'taken' | 'email_taken' | null {
  if (!isUniqueError(error)) return null
  const name = String(
    (error as { constraint_name?: string }).constraint_name ?? '',
  )
  return name.includes('email') ? 'email_taken' : 'taken'
}

/**
 * Nasce profissional e sem palavra-passe. O papel guarda-se com unidade
 * nula porque uma profissional não tem escopo nenhum para gerir — vê a
 * agenda dela e mais nada. As lojas onde atende são outra coisa, e
 * escrevem-se em staff_unit.
 */
export async function createMember(
  actor: Actor,
  input: MemberInput,
  unitIds: string[],
): Promise<MemberResult> {
  if (!input.name.trim() || !input.phone.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  const units = unitIds.filter((id) => canSeeUnit(actor, id))

  try {
    return await sql.begin(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        insert into staff
          (org_id, name, public_alias, phone, email, bio, display_color,
           accepts_online_booking, sort_order)
        values
          (${actor.orgId}, ${input.name.trim()}, ${input.publicAlias},
           ${input.phone.trim()},
           ${input.email}, ${input.bio}, ${input.displayColor},
           ${input.acceptsOnline},
           (select coalesce(max(sort_order), 0) + 1 from staff
             where org_id = ${actor.orgId}))
        returning id
      `
      const row = rows[0]
      if (!row) return { ok: false, reason: 'invalid' } as MemberResult

      await tx`
        insert into staff_role (staff_id, role, unit_id)
        values (${row.id}, 'professional', null)
      `
      if (units.length > 0) {
        await tx`
          insert into staff_unit (staff_id, unit_id)
          select ${row.id}, t.u from unnest(${units}::uuid[]) as t(u)
        `
      }
      return { ok: true, id: row.id } as MemberResult
    })
  } catch (error) {
    const reason = takenReason(error)
    if (reason) return { ok: false, reason }
    throw error
  }
}

export async function updateMember(
  actor: Actor,
  id: string,
  input: MemberInput,
): Promise<MemberResult> {
  if (!input.name.trim() || !input.phone.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  try {
    const rows = await sql<{ id: string }[]>`
      update staff s
         set name = ${input.name.trim()},
             public_alias = ${input.publicAlias},
             phone = ${input.phone.trim()},
             email = ${input.email},
             bio = ${input.bio},
             display_color = ${input.displayColor},
             accepts_online_booking = ${input.acceptsOnline}
       where s.id = ${id} and ${reach(actor)}
      returning s.id
    `
    const row = rows[0]
    if (!row) return { ok: false, reason: 'not_found' }
    return { ok: true, id: row.id }
  } catch (error) {
    const reason = takenReason(error)
    if (reason) return { ok: false, reason }
    throw error
  }
}

export type LeaveResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'has_future'; count?: number }

/**
 * Desactivar não apaga: as marcações passadas continuam a saber quem as
 * fez. Mas com agenda pela frente não se desactiva — desmarca-se ou
 * passa-se a outra mão primeiro.
 */
export async function deactivateMember(
  actor: Actor,
  id: string,
  todayIso: IsoDay,
): Promise<LeaveResult> {
  const member = await getMember(actor, id)
  if (!member) return { ok: false, reason: 'not_found' }

  const ahead = await sql<{ count: number }[]>`
    select count(*)::int as count
      from appointment_item i
      join appointment a on a.id = i.appointment_id
     where i.staff_id = ${id}
       and i.starts_at > now()
       and a.status in ('booked', 'confirmed', 'checked_in', 'in_service')
  `
  const count = ahead[0]?.count ?? 0
  if (count > 0) return { ok: false, reason: 'has_future', count }

  await sql.begin(async (tx) => {
    await tx`update staff set is_active = false where id = ${id}`
    await tx`
      delete from staff_schedule
       where staff_id = ${id} and valid_from > ${todayIso}::date
    `
    await tx`
      update staff_schedule
         set valid_to = ${todayIso}::date
       where staff_id = ${id}
         and (valid_to is null or valid_to > ${todayIso}::date)
    `
  })
  await destroyAllSessions('staff', id)
  return { ok: true }
}

export async function reactivateMember(
  actor: Actor,
  id: string,
): Promise<void> {
  await sql`
    update staff s set is_active = true
     where s.id = ${id} and ${reach(actor)}
  `
}

/**
 * Repor a palavra-passe fecha todas as sessões dessa pessoa: se a conta
 * andava em mãos erradas, deixa de andar no mesmo instante.
 */
export async function setPassword(
  actor: Actor,
  id: string,
  password: string,
): Promise<boolean> {
  const member = await getMember(actor, id)
  if (!member) return false
  const hash = await hashPassword(password)
  await sql`update staff set password_hash = ${hash} where id = ${id}`
  await destroyAllSessions('staff', id)
  return true
}

// ---------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------

export type RoleRow = {
  id: string
  role: Level
  unit_id: string | null
  unit_name: string | null
}

export async function listRoles(staffId: string): Promise<RoleRow[]> {
  return sql<RoleRow[]>`
    select r.id, r.role, r.unit_id, u.name as unit_name
      from staff_role r
      left join unit u on u.id = r.unit_id
     where r.staff_id = ${staffId}
     order by case r.role
                when 'owner' then 0
                when 'manager' then 1
                else 2
              end,
              u.sort_order nulls first, u.name
  `
}

export type RoleResult =
  | { ok: true }
  | {
      ok: false
      reason: 'forbidden' | 'taken' | 'invalid' | 'last_owner' | 'not_found'
    }

/**
 * Sem loja associada significa A REDE TODA — e isso só a dona dá. A
 * gerente distribui papéis dentro das lojas dela, e nunca o de dona.
 */
export async function addRole(
  actor: Actor,
  staffId: string,
  level: Level,
  unitId: string | null,
): Promise<RoleResult> {
  if (level === 'owner' && unitId !== null) {
    return { ok: false, reason: 'invalid' }
  }
  const networkScope = unitId === null && level !== 'professional'
  if (!isOwner(actor) && (level === 'owner' || networkScope)) {
    return { ok: false, reason: 'forbidden' }
  }
  if (unitId !== null && !canSeeUnit(actor, unitId)) {
    return { ok: false, reason: 'forbidden' }
  }

  const member = await getMember(actor, staffId)
  if (!member) return { ok: false, reason: 'not_found' }

  try {
    await sql`
      insert into staff_role (staff_id, role, unit_id)
      values (${staffId}, ${level}, ${unitId})
    `
  } catch (error) {
    if (isUniqueError(error)) return { ok: false, reason: 'taken' }
    throw error
  }
  return { ok: true }
}

/** A última dona da rede não se apaga: alguém tem de ficar com a chave. */
export async function removeRole(
  actor: Actor,
  staffId: string,
  roleId: string,
): Promise<RoleResult> {
  const member = await getMember(actor, staffId)
  if (!member) return { ok: false, reason: 'not_found' }

  const rows = await sql<{ role: Level; unit_id: string | null }[]>`
    select role, unit_id from staff_role
     where id = ${roleId} and staff_id = ${staffId}
  `
  const row = rows[0]
  if (!row) return { ok: false, reason: 'not_found' }

  const networkScope = row.unit_id === null && row.role !== 'professional'
  if (!isOwner(actor) && (row.role === 'owner' || networkScope)) {
    return { ok: false, reason: 'forbidden' }
  }
  if (row.unit_id !== null && !canSeeUnit(actor, row.unit_id)) {
    return { ok: false, reason: 'forbidden' }
  }

  if (row.role === 'owner') {
    const owners = await sql<{ count: number }[]>`
      select count(*)::int as count
        from staff_role r
        join staff s on s.id = r.staff_id
       where r.role = 'owner' and s.org_id = ${actor.orgId} and s.is_active
    `
    if ((owners[0]?.count ?? 0) <= 1) return { ok: false, reason: 'last_owner' }
  }

  await sql`delete from staff_role where id = ${roleId}`
  return { ok: true }
}

// ---------------------------------------------------------------------
// Lojas onde atende
// ---------------------------------------------------------------------

export async function listMemberUnits(staffId: string): Promise<string[]> {
  const rows = await sql<{ unit_id: string }[]>`
    select unit_id from staff_unit where staff_id = ${staffId}
  `
  return rows.map((row) => row.unit_id)
}

export type UnitLinkResult =
  | { ok: true }
  | { ok: false; reason: 'forbidden' | 'not_found' | 'has_schedule' }

export async function attachUnit(
  actor: Actor,
  staffId: string,
  unitId: string,
): Promise<UnitLinkResult> {
  if (!canSeeUnit(actor, unitId)) return { ok: false, reason: 'forbidden' }
  const member = await getMember(actor, staffId)
  if (!member) return { ok: false, reason: 'not_found' }

  await sql`
    insert into staff_unit (staff_id, unit_id)
    values (${staffId}, ${unitId})
    on conflict do nothing
  `
  return { ok: true }
}

/**
 * Tirar a loja com escala aberta lá dentro deixaria a agenda a oferecer
 * horários numa casa onde a pessoa já não põe os pés. Fecha-se a escala
 * primeiro.
 */
export async function detachUnit(
  actor: Actor,
  staffId: string,
  unitId: string,
  todayIso: IsoDay,
): Promise<UnitLinkResult> {
  if (!canSeeUnit(actor, unitId)) return { ok: false, reason: 'forbidden' }
  const member = await getMember(actor, staffId)
  if (!member) return { ok: false, reason: 'not_found' }

  const open = await sql<{ count: number }[]>`
    select count(*)::int as count
      from staff_schedule
     where staff_id = ${staffId} and unit_id = ${unitId}
       and (valid_to is null or valid_to >= ${todayIso}::date)
  `
  if ((open[0]?.count ?? 0) > 0) return { ok: false, reason: 'has_schedule' }

  await sql`
    delete from staff_unit
     where staff_id = ${staffId} and unit_id = ${unitId}
  `
  return { ok: true }
}

// ---------------------------------------------------------------------
// Habilidades
//
// A gerente não gere o catálogo, mas precisa de dizer quem faz o quê na
// loja dela — senão não põe ninguém a atender. Vê os nomes dos serviços;
// não lhes mexe.
// ---------------------------------------------------------------------

export type SkillGroup = {
  category: string
  services: { id: string; name: string; has: boolean }[]
}

export async function listSkills(
  orgId: string,
  staffId: string,
): Promise<SkillGroup[]> {
  const rows = await sql<
    { category: string; id: string; name: string; has: boolean }[]
  >`
    select c.name as category, s.id, s.name,
           exists (
             select 1 from staff_skill k
              where k.staff_id = ${staffId} and k.service_id = s.id
           ) as has
      from service s
      join service_category c on c.id = s.category_id
     where s.org_id = ${orgId} and s.is_active
     order by c.sort_order, c.name, s.sort_order, s.name
  `

  const groups: SkillGroup[] = []
  for (const row of rows) {
    let group = groups.at(-1)
    if (!group || group.category !== row.category) {
      group = { category: row.category, services: [] }
      groups.push(group)
    }
    group.services.push({ id: row.id, name: row.name, has: row.has })
  }
  return groups
}

export async function setSkill(
  actor: Actor,
  staffId: string,
  serviceId: string,
  on: boolean,
): Promise<boolean> {
  const member = await getMember(actor, staffId)
  if (!member) return false

  if (on) {
    await sql`
      insert into staff_skill (staff_id, service_id)
      select ${staffId}, s.id from service s
       where s.id = ${serviceId} and s.org_id = ${actor.orgId}
      on conflict do nothing
    `
  } else {
    await sql`
      delete from staff_skill
       where staff_id = ${staffId} and service_id = ${serviceId}
    `
  }
  return true
}

// ---------------------------------------------------------------------
// Escala recorrente, com vigência
// ---------------------------------------------------------------------

export type ScheduleRow = {
  id: string
  unit_id: string
  unit_name: string
  weekday: number
  starts_min: Minutes
  ends_min: Minutes
  valid_from: IsoDay
  valid_to: IsoDay | null
  is_current: boolean
  is_future: boolean
}

/** Só o que ainda vale: o que já fechou pertence ao passado da agenda. */
export async function listSchedule(
  staffId: string,
  todayIso: IsoDay,
): Promise<ScheduleRow[]> {
  return sql<ScheduleRow[]>`
    select e.id, e.unit_id, u.name as unit_name, e.weekday,
           e.starts_min, e.ends_min,
           to_char(e.valid_from, 'YYYY-MM-DD') as valid_from,
           to_char(e.valid_to, 'YYYY-MM-DD') as valid_to,
           (e.valid_from <= ${todayIso}::date
             and (e.valid_to is null or e.valid_to >= ${todayIso}::date))
             as is_current,
           (e.valid_from > ${todayIso}::date) as is_future
      from staff_schedule e
      join unit u on u.id = e.unit_id
     where e.staff_id = ${staffId}
       and (e.valid_to is null or e.valid_to >= ${todayIso}::date)
     order by e.weekday, e.starts_min, e.valid_from
  `
}

export type ScheduleInput = {
  unitId: string
  weekday: number
  startsMin: Minutes
  endsMin: Minutes
  validFrom: IsoDay
  validTo: IsoDay | null
}

export type ScheduleResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'forbidden'
        | 'not_found'
        | 'overlap'
        | 'invalid'
        | 'past'
        | 'not_there'
    }

/**
 * Abrir uma vigência. Se apanhar outra da mesma pessoa no mesmo dia da
 * semana, é a restrição de exclusão que recusa — e o que se diz a quem
 * está do outro lado é para fechar a antiga primeiro.
 */
export async function openSchedule(
  actor: Actor,
  staffId: string,
  input: ScheduleInput,
): Promise<ScheduleResult> {
  if (!canSeeUnit(actor, input.unitId)) {
    return { ok: false, reason: 'forbidden' }
  }
  if (input.endsMin <= input.startsMin) return { ok: false, reason: 'invalid' }
  if (input.weekday < 0 || input.weekday > 6) {
    return { ok: false, reason: 'invalid' }
  }
  if (input.validTo !== null && input.validTo < input.validFrom) {
    return { ok: false, reason: 'invalid' }
  }

  const member = await getMember(actor, staffId)
  if (!member) return { ok: false, reason: 'not_found' }

  const attends = await sql<{ count: number }[]>`
    select count(*)::int as count from staff_unit
     where staff_id = ${staffId} and unit_id = ${input.unitId}
  `
  if ((attends[0]?.count ?? 0) === 0) return { ok: false, reason: 'not_there' }

  try {
    await sql`
      insert into staff_schedule
        (staff_id, unit_id, weekday, starts_min, ends_min,
         valid_from, valid_to)
      values
        (${staffId}, ${input.unitId}, ${input.weekday},
         ${input.startsMin}, ${input.endsMin},
         ${input.validFrom}::date, ${input.validTo}::date)
    `
  } catch (error) {
    if (isOverlapError(error)) return { ok: false, reason: 'overlap' }
    throw error
  }
  return { ok: true }
}

/**
 * Fechar é escrever o último dia. Nunca se mexe nas horas de uma
 * vigência que já correu: o passado da agenda tem de continuar a
 * explicar-se sozinho.
 */
export async function closeSchedule(
  actor: Actor,
  staffId: string,
  id: string,
  lastDay: IsoDay,
): Promise<ScheduleResult> {
  const member = await getMember(actor, staffId)
  if (!member) return { ok: false, reason: 'not_found' }

  const rows = await sql<{ unit_id: string; valid_from: IsoDay }[]>`
    select unit_id, to_char(valid_from, 'YYYY-MM-DD') as valid_from
      from staff_schedule
     where id = ${id} and staff_id = ${staffId}
  `
  const row = rows[0]
  if (!row) return { ok: false, reason: 'not_found' }
  if (!canSeeUnit(actor, row.unit_id)) return { ok: false, reason: 'forbidden' }
  if (lastDay < row.valid_from) return { ok: false, reason: 'invalid' }

  await sql`
    update staff_schedule
       set valid_to = ${lastDay}::date
     where id = ${id} and staff_id = ${staffId}
  `
  return { ok: true }
}

/** Só se apaga o que ainda não começou; o resto fecha-se. */
export async function removeSchedule(
  actor: Actor,
  staffId: string,
  id: string,
  todayIso: IsoDay,
): Promise<ScheduleResult> {
  const member = await getMember(actor, staffId)
  if (!member) return { ok: false, reason: 'not_found' }

  const rows = await sql<{ unit_id: string; valid_from: IsoDay }[]>`
    select unit_id, to_char(valid_from, 'YYYY-MM-DD') as valid_from
      from staff_schedule
     where id = ${id} and staff_id = ${staffId}
  `
  const row = rows[0]
  if (!row) return { ok: false, reason: 'not_found' }
  if (!canSeeUnit(actor, row.unit_id)) return { ok: false, reason: 'forbidden' }
  if (row.valid_from <= todayIso) return { ok: false, reason: 'past' }

  await sql`delete from staff_schedule where id = ${id}`
  return { ok: true }
}

// ---------------------------------------------------------------------
// Ausências
// ---------------------------------------------------------------------

export type AbsenceRow = {
  id: string
  unit_id: string | null
  unit_name: string | null
  kind: AbsenceKind
  starts_at: Date
  ends_at: Date
  reason: string | null
  author: string | null
}

export async function listAbsences(staffId: string): Promise<AbsenceRow[]> {
  return sql<AbsenceRow[]>`
    select a.id, a.unit_id, u.name as unit_name, a.kind,
           a.starts_at, a.ends_at, a.reason,
           author.name as author
      from staff_absence a
      left join unit u on u.id = a.unit_id
      left join staff author on author.id = a.created_by
     where a.staff_id = ${staffId}
       and a.ends_at >= now() - interval '60 days'
     order by a.starts_at desc
     limit 40
  `
}

export type AbsenceInput = {
  unitId: string | null
  kind: AbsenceKind
  startsAt: Date
  endsAt: Date
  reason: string | null
}

export type AbsenceResult =
  | { ok: true; clashes: number }
  | { ok: false; reason: 'forbidden' | 'not_found' | 'invalid' }

/**
 * Marcar ausência não desmarca ninguém — devolve quantas marcações
 * ficaram dentro do intervalo, para que quem a escreveu as vá tratar à
 * mão. Apagar agenda por baixo de uma cliente não é decisão do sistema.
 */
export async function addAbsence(
  actor: Actor,
  staffId: string,
  input: AbsenceInput,
): Promise<AbsenceResult> {
  if (input.endsAt <= input.startsAt) return { ok: false, reason: 'invalid' }
  if (input.unitId !== null && !canSeeUnit(actor, input.unitId)) {
    return { ok: false, reason: 'forbidden' }
  }

  const member = await getMember(actor, staffId)
  if (!member) return { ok: false, reason: 'not_found' }

  await sql`
    insert into staff_absence
      (staff_id, unit_id, kind, starts_at, ends_at, reason, created_by)
    values
      (${staffId}, ${input.unitId}, ${input.kind},
       ${input.startsAt}, ${input.endsAt}, ${input.reason}, ${actor.id})
  `

  const rows = await sql<{ count: number }[]>`
    select count(*)::int as count
      from appointment_item i
      join appointment a on a.id = i.appointment_id
     where i.staff_id = ${staffId}
       and a.status in ('booked', 'confirmed', 'checked_in', 'in_service')
       and i.starts_at < ${input.endsAt}
       and i.ends_at > ${input.startsAt}
  `
  return { ok: true, clashes: rows[0]?.count ?? 0 }
}

export async function removeAbsence(
  actor: Actor,
  staffId: string,
  id: string,
): Promise<boolean> {
  const member = await getMember(actor, staffId)
  if (!member) return false
  await sql`
    delete from staff_absence where id = ${id} and staff_id = ${staffId}
  `
  return true
}
