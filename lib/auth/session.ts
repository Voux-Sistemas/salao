import 'server-only'
import { cookies, headers } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'
import { env } from '@/lib/env'

/**
 * Duas portas separadas que não se cruzam: a equipa entra com
 * palavra-passe, a cliente com código. Cada porta tem o seu cookie e o
 * seu tipo de sujeito — uma sessão de cliente nunca abre a área da
 * equipa, mesmo que alguém troque os identificadores.
 */

export type SubjectType = 'staff' | 'client'

const COOKIE: Record<SubjectType, string> = {
  staff: 'salao_desk',
  client: 'salao_conta',
}

const TTL_DAYS: Record<SubjectType, number> = {
  staff: 14,
  client: 60,
}

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export async function createSession(
  subjectType: SubjectType,
  subjectId: string,
): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(
    Date.now() + TTL_DAYS[subjectType] * 86_400_000,
  )

  const headerList = await headers()
  await sql`
    insert into session (subject_type, subject_id, token_hash, expires_at, user_agent)
    values (${subjectType}, ${subjectId}, ${hash(token)}, ${expiresAt},
            ${headerList.get('user-agent')?.slice(0, 300) ?? null})
  `

  const jar = await cookies()
  jar.set(COOKIE[subjectType], token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    expires: expiresAt,
  })
}

/**
 * O ESTADO DE UMA SESSÃO, tal como o servidor a vê.
 *
 * O `balcao` não é um enfeite do ecrã: é a partir daqui que a página
 * decide o que a pessoa pode fazer, e é por isso que vive na base de
 * dados e não num cookie que o navegador possa mexer.
 */
export type EstadoDaSessao = {
  subjectId: string
  /** Está posta no balcão? */
  balcao: boolean
  /** Destrancada pela dona, e ainda dentro do tempo? */
  elevada: boolean
  /** Até quando, para a fita poder contar os minutos. */
  elevadaAte: Date | null
}

/**
 * A SESSÃO RENOVA-SE COM O USO — e isto não é comodidade, é o que
 * impede o tablet de se deitar fora sozinho.
 *
 * O prazo era fixo desde o login: catorze dias e acabou, mexesse-se
 * nele todos os dias ou nenhum. Num tablet deixado num salão isso é uma
 * bomba-relógio de duas semanas — rebenta com a dona noutro salão, uma
 * funcionária ao balcão e uma cliente à frente a perguntar se dá para
 * a semana.
 *
 * Empurra-se o fim para a frente na mesma ida à base que já lá ia
 * marcar o `last_seen_at`. Um aparelho mexido todos os dias nunca
 * expira; um que ninguém toca durante catorze dias fecha-se, que é o
 * que se quer.
 *
 * O COOKIE FICA PARA TRÁS. Só se pode reescrever um cookie a meio de
 * uma resposta, e isto lê-se em páginas que já começaram a desenhar. O
 * cookie leva a validade que tinha no login e a base leva a nova — e
 * quem manda é a base, porque é ela que a consulta verifica. O que se
 * perde é o caso raro do navegador deitar fora um cookie que o servidor
 * ainda aceitaria; entrar outra vez resolve-o.
 */
export async function readSessionState(
  subjectType: SubjectType,
): Promise<EstadoDaSessao | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE[subjectType])?.value
  if (!token) return null

  const rows = await sql<
    { subject_id: string; balcao: boolean; elevado_ate: Date | null }[]
  >`
    update session
       set last_seen_at = now(),
           expires_at = now() + make_interval(days => ${TTL_DAYS[subjectType]})
     where token_hash = ${hash(token)}
       and subject_type = ${subjectType}
       and expires_at > now()
    returning subject_id, balcao_at is not null as balcao, elevado_ate
  `

  const row = rows[0]
  if (!row) return null

  const elevada = row.elevado_ate !== null && row.elevado_ate > new Date()
  return {
    subjectId: row.subject_id,
    balcao: row.balcao,
    elevada,
    elevadaAte: elevada ? row.elevado_ate : null,
  }
}

/** Só o id, para quem não precisa de saber do balcão. */
export async function readSession(
  subjectType: SubjectType,
): Promise<string | null> {
  return (await readSessionState(subjectType))?.subjectId ?? null
}

// ---------------------------------------------------------------------
// O balcão
// ---------------------------------------------------------------------

/**
 * Põe ESTA sessão no balcão, ou tira-a de lá.
 *
 * Tirar de lá limpa também a elevação: uma sessão que deixou de ser de
 * balcão não tem nada que guardar meia hora de crédito.
 */
export async function marcarBalcao(
  subjectType: SubjectType,
  ligado: boolean,
): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE[subjectType])?.value
  if (!token) return

  await sql`
    update session
       set balcao_at = ${ligado ? sql`now()` : sql`null`},
           elevado_ate = null
     where token_hash = ${hash(token)}
       and subject_type = ${subjectType}
  `
}

/**
 * A dona destrancou este tablet. Meia hora, e volta ao balcão sozinho.
 *
 * MEIA HORA É UM PALPITE HONESTO: chega para ver as contas do dia e para
 * mexer num preço, e não chega para se esquecer do tablet aberto em cima
 * do balcão até ao fim da tarde.
 */
const ELEVACAO_MINUTOS = 30

export async function elevarSessao(subjectType: SubjectType): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE[subjectType])?.value
  if (!token) return

  await sql`
    update session
       set elevado_ate = now() + make_interval(mins => ${ELEVACAO_MINUTOS})
     where token_hash = ${hash(token)}
       and subject_type = ${subjectType}
       and balcao_at is not null
  `
}

/** «Voltar já» — desiste do resto do tempo. */
export async function baixarSessao(subjectType: SubjectType): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE[subjectType])?.value
  if (!token) return

  await sql`
    update session set elevado_ate = null
     where token_hash = ${hash(token)} and subject_type = ${subjectType}
  `
}

/**
 * OS APARELHOS ONDE O LOGIN DELA ESTÁ ABERTO.
 *
 * É a lista que lhe deixa trancar um tablet à distância. Trancar sim,
 * destrancar não: destrancar de longe seria abrir um tablet num salão
 * onde ela não está, e isso não serve a ninguém.
 *
 * A sessão de quem está a ver vem assinalada, para ela não se terminar
 * a si própria por engano.
 */
export type Aparelho = {
  id: string
  user_agent: string | null
  last_seen_at: Date
  created_at: Date
  balcao: boolean
  esta: boolean
  /** A última agenda que este aparelho abriu — ver `marcarLojaDaSessao`. */
  unit_name: string | null
}

export async function aparelhosDe(
  subjectType: SubjectType,
  subjectId: string,
): Promise<Aparelho[]> {
  const jar = await cookies()
  const token = jar.get(COOKIE[subjectType])?.value

  return sql<Aparelho[]>`
    select s.id, s.user_agent, s.last_seen_at, s.created_at,
           s.balcao_at is not null as balcao,
           s.token_hash = ${token ? hash(token) : ''} as esta,
           u.name as unit_name
      from session s
      left join unit u on u.id = s.last_unit_id
     where s.subject_type = ${subjectType}
       and s.subject_id = ${subjectId}
       and s.expires_at > now()
     order by s.last_seen_at desc
  `
}

/**
 * ONDE É QUE ESTE APARELHO ESTÁ — a loja, não a cidade.
 *
 * A lista dos aparelhos dizia «iPad · visto há 4 min», e com um tablet
 * em cada salão isso não chega para trancar o certo. O que ela precisa
 * de saber é QUAL, e a casa já o sabe de certeza: é a agenda que aquele
 * aparelho abriu da última vez.
 *
 * NÃO SE TIRA DO ENDEREÇO DE REDE, e é escolha. Uma cidade tirada do IP
 * mente — numa rede móvel dá o nó da operadora, numa fixa a central do
 * fornecedor — e um salão em Valongo aparecia como «Porto». Uma cidade
 * errada é pior do que nenhuma, porque se decide com ela. Além disso
 * obrigava a mandar o endereço dela a um serviço de fora, ou a carregar
 * uma base de dados de geografia para dizer pior o que isto diz bem.
 *
 * ESCREVE-SE E ESQUECE-SE. É uma linha por visita à agenda, sem esperar
 * pela resposta: se falhar, a lista mostra a loja anterior — o que é uma
 * imprecisão, não um erro, e não vale um milissegundo a quem está a
 * abrir o dia.
 */
export async function marcarLojaDaSessao(unitId: string): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE.staff)?.value
  if (!token) return

  await sql`
    update session set last_unit_id = ${unitId}
     where token_hash = ${hash(token)}
       and subject_type = 'staff'
       and last_unit_id is distinct from ${unitId}
  `
}

/** Tranca um aparelho à distância, pelo id. Nunca destranca. */
export async function trancarAparelho(
  subjectType: SubjectType,
  subjectId: string,
  sessionId: string,
): Promise<void> {
  await sql`
    update session
       set balcao_at = coalesce(balcao_at, now()),
           elevado_ate = null
     where id = ${sessionId}
       and subject_type = ${subjectType}
       and subject_id = ${subjectId}
  `
}

/** Termina um aparelho à distância. */
export async function terminarAparelho(
  subjectType: SubjectType,
  subjectId: string,
  sessionId: string,
): Promise<void> {
  await sql`
    delete from session
     where id = ${sessionId}
       and subject_type = ${subjectType}
       and subject_id = ${subjectId}
  `
}

export async function destroySession(subjectType: SubjectType): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE[subjectType])?.value
  if (token) {
    await sql`delete from session where token_hash = ${hash(token)}`
  }
  jar.delete(COOKIE[subjectType])
}

/** Fecha todas as sessões de alguém (ao mudar a palavra-passe). */
export async function destroyAllSessions(
  subjectType: SubjectType,
  subjectId: string,
): Promise<void> {
  await sql`
    delete from session
     where subject_type = ${subjectType} and subject_id = ${subjectId}
  `
}
