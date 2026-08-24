import 'server-only'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { readSession } from '@/lib/auth/session'
import { getUnitBySlug, type Unit } from '@/lib/org'

/**
 * Quatro degraus, do mais alto ao mais baixo.
 *
 *   master        quem monta o sistema. Tudo o que a dona faz, mais o
 *                 que muda a forma do sistema: abrir e fechar unidades.
 *   owner         a dona. A casa dela toda — equipa, catálogo, preços,
 *                 comissões, caixa, agenda das duas lojas. Não abre nem
 *                 fecha unidades, porque isso não é gerir o salão, é
 *                 mudar o sistema.
 *   manager       o mesmo que a dona, limitado às lojas onde tem o
 *                 papel. Não vê o catálogo da rede nem as comissões.
 *   professional  vê só a agenda dela e as marcações onde é ela quem
 *                 atende. Não vê caixa, nem clientes, nem gestão.
 *
 * Um papel guarda-se com uma loja associada; SEM LOJA ASSOCIADA
 * SIGNIFICA "A REDE TODA".
 */
export type Role = 'master' | 'owner' | 'manager' | 'professional'

const RANK: Record<Role, number> = {
  master: 4,
  owner: 3,
  manager: 2,
  professional: 1,
}

/** Quem tem mais do que uma loja debaixo de si. */
const ACIMA_DA_LOJA: Role[] = ['master', 'owner']

export type Actor = {
  id: string
  orgId: string
  name: string
  phone: string
  email: string | null
  avatarUrl: string | null
  role: Role
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
        bool_or(r.unit_id is null and r.role in ('master','owner','manager')),
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

  const candidates: Role[] = []
  for (const r of row.roles) {
    if (r === 'master' || r === 'owner' || r === 'manager' || r === 'professional') {
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
    orgScope: ACIMA_DA_LOJA.includes(role) || row.has_org_scope,
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

/** Painel, caixa, clientes, gestão: tudo acima de profissional. */
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

/**
 * Abrir e fechar lojas. `notFound` e não «não pode»: a dona não precisa
 * de saber que existe uma porta que não é dela.
 */
export async function requireMaster(): Promise<Actor> {
  const actor = await requireOrgScope()
  if (actor.role !== 'master') notFound()
  return actor
}

// ---------------------------------------------------------------------
// Lojas
// ---------------------------------------------------------------------

export function canSeeUnit(actor: Actor, unitId: string): boolean {
  return actor.orgScope || actor.unitIds.includes(unitId)
}

/**
 * OS AVISOS DE QUEM.
 *
 * Avisar a cliente é trabalho de quem a vai atender: é ela que conhece
 * a conversa e é a ela que a cliente responde. A profissional vê a fila
 * das marcações onde é ela quem atende, e mais nenhuma.
 *
 * Acima dela a fila é da casa toda — a dona e a gerente veem tudo, e
 * também podem enviar. `null` quer dizer "sem filtro".
 */
export function noticesStaffId(actor: Actor): string | null {
  return actor.role === 'professional' ? actor.id : null
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
  /* Toda a gente avisa — mas a profissional só vê as clientes dela.
     Quem corta a fila é o `noticesStaffId`, não este portão. */
  seeNotices: (_a: Actor) => true,
  manageTeam: (a: Actor) => a.role !== 'professional',
  manageCatalog: (a: Actor) => a.orgScope && a.role !== 'manager',
  /* Mexer numa loja que já existe — nome, morada, horas, WhatsApp — é
     gerir o salão, e isso é da dona. */
  manageUnits: (a: Actor) => a.orgScope && a.role !== 'manager',
  /* ABRIR E FECHAR LOJAS NÃO É GERIR O SALÃO, É MUDAR A FORMA DO
     SISTEMA. Uma loja a mais arrasta catálogo, equipa, horários,
     comissões e caixa atrás dela; uma loja a menos leva tudo isso com
     ela. Fica de quem monta o sistema, não de quem o usa. */
  createUnits: (a: Actor) => a.role === 'master',
  manageCommissions: (a: Actor) => a.orgScope && a.role !== 'manager',
  overrideLeadRules: (a: Actor) => a.role !== 'professional',
  /* Só o master mexe noutro master — a dona não promove ninguém acima
     dela própria, nem se despromove por engano. */
  manageMasters: (a: Actor) => a.role === 'master',
} as const
