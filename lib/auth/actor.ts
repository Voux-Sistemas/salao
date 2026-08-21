import 'server-only'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { env, normalisePhone } from '@/lib/env'
import { readSession } from '@/lib/auth/session'
import { getUnitBySlug, type Unit } from '@/lib/org'

/**
 * Quatro degraus, do mais alto ao mais baixo.
 *
 *   support       quem construiu o sistema. Não vive na base de dados:
 *                 é uma lista de telefones numa variável de ambiente.
 *   owner         escopo rede. Vê e mexe em tudo.
 *   manager       o mesmo, limitado às lojas onde tem o papel. Não vê o
 *                 catálogo da rede nem as regras de comissão.
 *   professional  vê só a agenda dela e as marcações onde é ela quem
 *                 atende. Não vê caixa, nem clientes, nem gestão.
 *
 * Um papel guarda-se com uma loja associada; SEM LOJA ASSOCIADA
 * SIGNIFICA "A REDE TODA".
 */
export type Role = 'support' | 'owner' | 'manager' | 'professional'

const RANK: Record<Role, number> = {
  support: 4,
  owner: 3,
  manager: 2,
  professional: 1,
}

export type Actor = {
  id: string
  orgId: string
  name: string
  phone: string
  email: string | null
  avatarUrl: string | null
  role: Role
  isSupport: boolean
  /** Vê a rede toda (suporte, dona, ou gerente com papel sem loja). */
  orgScope: boolean
  /** Lojas a que tem acesso quando não é escopo rede. */
  unitIds: string[]
}

type ActorRow = {
  id: string
  org_id: string
  name: string
  phone: string
  email: string | null
  avatar_url: string | null
  roles: string[]
  has_org_scope: boolean
  unit_ids: string[]
}

export const getActor = cache(async (): Promise<Actor | null> => {
  const staffId = await readSession('staff')
  if (!staffId) return null

  const rows = await sql<ActorRow[]>`
    select
      s.id, s.org_id, s.name, s.phone, s.email, s.avatar_url,
      coalesce(
        array_agg(distinct r.role) filter (where r.role is not null),
        '{}'
      ) as roles,
      coalesce(
        bool_or(r.unit_id is null and r.role in ('owner','manager')),
        false
      ) as has_org_scope,
      coalesce(
        (
          select array_agg(distinct u)
            from (
              select unit_id as u from staff_role
               where staff_id = s.id and unit_id is not null
              union
              select unit_id as u from staff_unit where staff_id = s.id
            ) x
        ),
        '{}'
      ) as unit_ids
    from staff s
    left join staff_role r on r.staff_id = s.id
    where s.id = ${staffId} and s.is_active
    group by s.id
  `

  const row = rows[0]
  if (!row) return null

  const isSupport = env.supportPhones.includes(normalisePhone(row.phone))
  const candidates: Role[] = isSupport ? ['support'] : []
  for (const r of row.roles) {
    if (r === 'owner' || r === 'manager' || r === 'professional') {
      candidates.push(r)
    }
  }
  if (candidates.length === 0) return null

  const role = candidates.reduce((best, r) =>
    RANK[r] > RANK[best] ? r : best,
  )

  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    avatarUrl: row.avatar_url,
    role,
    isSupport,
    orgScope: isSupport || role === 'owner' || row.has_org_scope,
    unitIds: row.unit_ids ?? [],
  }
})

// ---------------------------------------------------------------------
// Portões
// ---------------------------------------------------------------------

export async function requireActor(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) redirect('/entrar')
  return actor
}

/**
 * A página inicial depende do papel: a profissional cai na agenda dela,
 * toda a gente acima cai no painel do dia.
 */
export function homeFor(actor: Actor): string {
  return actor.role === 'professional' ? '/agenda' : '/'
}

/** Painel, avisos, caixa, clientes, gestão: tudo acima de profissional. */
export async function requireManagement(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role === 'professional') redirect('/agenda')
  return actor
}

/** Catálogo, unidades e comissões são escopo rede — só a dona. */
export async function requireOrgScope(): Promise<Actor> {
  const actor = await requireManagement()
  if (!actor.orgScope || actor.role === 'manager') notFound()
  return actor
}

// ---------------------------------------------------------------------
// Lojas
// ---------------------------------------------------------------------

export function canSeeUnit(actor: Actor, unitId: string): boolean {
  return actor.orgScope || actor.unitIds.includes(unitId)
}

/**
 * Loja inexistente e loja sem acesso dão A MESMA RESPOSTA: não existe.
 * Não se confirma a existência do que a pessoa não pode ver.
 */
export async function resolveUnit(
  actor: Actor,
  slug: string,
): Promise<Unit> {
  const unit = await getUnitBySlug(slug)
  if (!unit || unit.org_id !== actor.orgId) notFound()
  if (!canSeeUnit(actor, unit.id)) notFound()
  return unit
}

/** As lojas que esta pessoa pode escolher no seletor do topo. */
export async function unitsFor(actor: Actor): Promise<Unit[]> {
  if (actor.orgScope) {
    return sql<Unit[]>`
      select * from unit
       where org_id = ${actor.orgId} and is_active
       order by sort_order, name
    `
  }
  if (actor.unitIds.length === 0) return []
  return sql<Unit[]>`
    select * from unit
     where org_id = ${actor.orgId} and is_active and id = any(${actor.unitIds})
     order by sort_order, name
  `
}

// ---------------------------------------------------------------------
// O que cada degrau pode
// ---------------------------------------------------------------------

export const can = {
  seeDashboard: (a: Actor) => a.role !== 'professional',
  seeCash: (a: Actor) => a.role !== 'professional',
  seeClients: (a: Actor) => a.role !== 'professional',
  seeNotices: (a: Actor) => a.role !== 'professional',
  manageTeam: (a: Actor) => a.role !== 'professional',
  manageCatalog: (a: Actor) => a.orgScope && a.role !== 'manager',
  manageUnits: (a: Actor) => a.orgScope && a.role !== 'manager',
  manageCommissions: (a: Actor) => a.orgScope && a.role !== 'manager',
  overrideLeadRules: (a: Actor) => a.role !== 'professional',
} as const
