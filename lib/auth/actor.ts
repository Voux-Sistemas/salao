import 'server-only'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { readSessionState } from '@/lib/auth/session'
import { getUnitBySlug, type Unit } from '@/lib/org'

/**
 * Quatro degraus, do mais alto ao mais baixo.
 *
 *   master        quem monta o sistema. Tudo o que a dona faz, mais o
 *                 que muda a forma do sistema: abrir e fechar unidades.
 *   owner         a dona. A casa dela toda — equipa, catálogo, preços,
 *                 agenda das duas lojas. Não abre nem fecha unidades,
 *                 porque isso não é gerir o salão, é mudar o sistema.
 *   manager       o mesmo que a dona, limitado às lojas onde tem o
 *                 papel. Não vê o catálogo da rede nem as contas dela.
 *   professional  vê só a agenda dela e as marcações onde é ela quem
 *                 atende. Não vê clientes nem gestão.
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
  /**
   * ESTE APARELHO ESTÁ NO BALCÃO.
   *
   * A dona deixa o login dela aberto num tablet em cada salão, para as
   * funcionárias marcarem, e quase nunca lá está. A marca vive na linha
   * da SESSÃO — por aparelho, não por conta — e é lida aqui, à entrada
   * de tudo.
   *
   * O QUE ISTO FECHA ESTÁ NO `can`, E EM MAIS LADO NENHUM. Foi de
   * propósito: os portões já existiam todos para separar a profissional
   * da dona, e bastou ensiná-los a olhar também para aqui. Um cadeado
   * espalhado por trinta páginas esquece-se numa; um portão só, não.
   *
   * Enquanto ela estiver com a sessão ELEVADA — escreveu a palavra-passe
   * ali no tablet — isto é falso, e ela é ela outra vez. Meia hora
   * depois volta a ser verdade sozinho.
   */
  balcao: boolean
  /** Até quando dura a elevação, para a fita poder contar. */
  elevadaAte: Date | null
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
  const sessao = await readSessionState('staff')
  if (!sessao) return null
  const staffId = sessao.subjectId

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
    /*
      Elevada é ela outra vez. É a única coisa que desliga o balcão, e
      dura meia hora contada pela base — não por nada que o navegador
      possa dizer.
    */
    balcao: sessao.balcao && !sessao.elevada,
    elevadaAte: sessao.elevadaAte,
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

/** Painel, clientes, gestão: tudo acima de profissional. */
export async function requireManagement(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role === 'professional') redirect('/agenda')
  return actor
}

/**
 * A GESTÃO — e o que o balcão não abre.
 *
 * A diferença entre isto e um cadeado no ecrã está toda aqui: quem
 * escreve «/admin» na barra bate nisto, e as acções do servidor por trás
 * das páginas batem nisto também. Não há botão escondido nenhum.
 *
 * PORQUE NÃO ENTROU NO `requireManagement`: esse guarda também as
 * clientes, e as clientes ficam abertas no balcão de propósito — quem
 * atende precisa da ficha de quem tem à frente. Um portão que servisse
 * os dois teria de mentir a um deles.
 *
 * Manda para uma página que EXPLICA, em vez de um `notFound`. Do outro
 * lado está quase sempre a própria dona, que se esqueceu de ter deixado
 * aquele tablet no balcão; um 404 mandava-a pensar que o sistema estava
 * partido em vez de trancado por ela.
 */
export async function requireGestao(): Promise<Actor> {
  const actor = await requireManagement()
  if (actor.balcao) redirect('/balcao')
  return actor
}

/**
 * MARCAR NÃO É GERIR.
 *
 * O encaixe e a remarcação viviam atrás do portão da gestão, e por isso
 * a profissional não lhes chegava — via a agenda dela e não lhe podia
 * tocar. Mas escrever uma marcação é o trabalho dela: é ela que tem a
 * cliente à frente, e é a ela que a cliente pergunta se dá para
 * amanhã. O painel e a ficha das clientes continuam onde estavam; o que
 * abre é o livro de marcações.
 */
export async function requireBooking(): Promise<Actor> {
  return requireActor()
}

/** Catálogo e unidades são escopo rede — só a dona. */
export async function requireOrgScope(): Promise<Actor> {
  const actor = await requireManagement()
  if (actor.balcao) redirect('/balcao')
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
 * A quem é que esta pessoa se pode limitar a marcar.
 *
 * A profissional marca para ela própria; quem está acima marca para
 * quem quiser. `null` quer dizer "sem limite" — a mesma convenção do
 * `noticesStaffId`, e pela mesma razão: é um filtro, não uma proibição.
 */
export function ownStaffId(actor: Actor): string | null {
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

/**
 * O QUE CADA UM PODE — E O BALCÃO PASSA POR AQUI.
 *
 * Um tablet no balcão é a sessão da DONA, e por isso o papel dela diz
 * «master» e diria que sim a tudo. Quem o trava é o `a.balcao`, e trava-o
 * AQUI e em mais lado nenhum: os portões já existiam todos para separar
 * a profissional da dona, e bastou ensiná-los a olhar também para isto.
 *
 * SE ACRESCENTARES UM PORTÃO, COMEÇA-O POR `!a.balcao &&`. Os três que
 * NÃO o levam — clientes, avisos e encaixar — são o trabalho do balcão,
 * e estão comentados um a um para se ver que é escolha e não esquecimento.
 */
export const can = {
  seeDashboard: (a: Actor) => !a.balcao && a.role !== 'professional',
  /* Houve aqui um `seeCash`, e depois um `seeMoney`. Abriam, por esta
     ordem, a gaveta do dia e a comanda da cliente. Saíram as duas, e o
     portão ficou sem porta nenhuma para guardar — a única coisa que a
     casa mostra de dinheiro é o painel, e esse tem o seu. */
  /* ABERTO NO BALCÃO, de propósito: quem atende ao balcão precisa da
     ficha da cliente que tem à frente — o telefone, o histórico, o que
     ela costuma fazer. Foi a dona que o pediu assim. */
  seeClients: (a: Actor) => a.role !== 'professional',
  /* Toda a gente avisa — mas a profissional só vê as clientes dela.
     Quem corta a fila é o `noticesStaffId`, não este portão. */
  /* Também aberto no balcão, pela mesma razão: confirmar a cliente de
     amanhã é trabalho de quem está lá, não da dona a 60 km. */
  seeNotices: (_a: Actor) => true,
  manageTeam: (a: Actor) => !a.balcao && a.role !== 'professional',
  manageCatalog: (a: Actor) =>
    !a.balcao && a.orgScope && a.role !== 'manager',
  /* Mexer numa loja que já existe — nome, morada, horas, WhatsApp — é
     gerir o salão, e isso é da dona. */
  manageUnits: (a: Actor) => !a.balcao && a.orgScope && a.role !== 'manager',
  /* ABRIR E FECHAR LOJAS NÃO É GERIR O SALÃO, É MUDAR A FORMA DO
     SISTEMA. Uma loja a mais arrasta catálogo, equipa, horários,
     e as contas atrás dela; uma loja a menos leva tudo isso com
     ela. Fica de quem monta o sistema, não de quem o usa. */
  createUnits: (a: Actor) => !a.balcao && a.role === 'master',
  /* Chamava-se `manageCommissions` e fazia dois trabalhos: abria o
     separador das comissões e decidia quem vê as CONTAS DA REDE — o
     painel inteiro, contra os quatro atalhos que a gerente recebe. As
     comissões saíram; o segundo trabalho não tinha nada que ver com
     elas e ficou com o nome certo. A regra é a mesma: quem vê a rede
     toda é quem manda nela. */
  seeNetworkNumbers: (a: Actor) =>
    !a.balcao && a.orgScope && a.role !== 'manager',
  /* ENCAIXAR É TRABALHO DE QUEM ESTÁ AO BALCÃO, e ao balcão está quem
     atende. A profissional é quem tem a cliente à frente a perguntar
     «e amanhã, dá?» — mandá-la chamar a dona para isso era pôr um
     degrau no meio de uma conversa de dez segundos. Quem vê a pessoa
     decide a hora dela. */
  /* O terceiro que fica aberto no balcão, e o mais importante dos
     três: é para isto que o tablet lá está. */
  overrideLeadRules: (_a: Actor) => true,
  /* Só o master mexe noutro master — a dona não promove ninguém acima
     dela própria, nem se despromove por engano. */
  manageMasters: (a: Actor) => !a.balcao && a.role === 'master',
} as const
