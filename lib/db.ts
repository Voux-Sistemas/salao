import 'server-only'
import postgres from 'postgres'
import { env } from './env'

/**
 * Ligação directa ao Postgres do Supabase.
 *
 * Porquê SQL directo e não o cliente PostgREST: este sistema vive de
 * restrições de exclusão, transações e consultas com intervalos. A trava
 * contra overbooking é da base de dados — precisamos de falar com ela
 * na sua própria língua.
 *
 * `prepare: false` porque em produção liga-se pelo pooler em modo
 * transação (porta 6543), que não guarda declarações preparadas.
 */

type Client = ReturnType<typeof createClient>

declare global {
  // eslint-disable-next-line no-var
  var __salaoSql: Client | undefined
}

/**
 * O Postgres local não fala TLS; o Supabase fala e devia ser obrigado a
 * falar — entre a Netlify e a base vão nomes, telefones e a própria
 * palavra-passe da ligação, pela internet fora. Sem isto o condutor liga
 * em texto simples quando o servidor deixa, e o Supabase deixa.
 *
 * `require` e não `verify-full` porque o certificado do pooler é
 * assinado pela autoridade da própria Supabase: verificar a cadeia
 * obrigaria a trazer o certificado deles connosco, e a alternativa
 * seria ficar sem cifra nenhuma. Quem quiser mandar nisto escreve
 * `?sslmode=...` na própria DATABASE_URL e essa decisão ganha.
 *
 * Daí o `undefined`, e não `false`: no `postgres.js` a opção passada à
 * mão ganha SEMPRE ao `sslmode` do endereço (`k in o ? o[k] : query[k]`),
 * por isso devolver `false` aqui desligava a cifra a quem tinha escrito
 * `?sslmode=require` de propósito. Não passar a chave é o que deixa o
 * endereço decidir.
 */
function sslFor(url: string): 'require' | false | undefined {
  if (/[?&]sslmode=/.test(url)) return undefined
  return /@(localhost|127\.0\.0\.1|\[::1\])/.test(url) ? false : 'require'
}

function createClient() {
  const url = env.databaseUrl
  const ssl = sslFor(url)
  return postgres(url, {
    // O pooler da Supabase é partilhado e a Netlify arranca uma função
    // por pedido: cada instância que abrisse dez ligações esgotava o
    // pooler numa manhã de sábado. Quatro chegam — as consultas são
    // curtas — e o `idle_timeout` devolve-as depressa.
    max: env.isProduction ? 4 : 8,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ...(ssl === undefined ? {} : { ssl }),
    transform: { undefined: null },
  })
}

let client: Client | undefined

function connection(): Client {
  if (!client) {
    client = globalThis.__salaoSql ?? createClient()
    if (!env.isProduction) globalThis.__salaoSql = client
  }
  return client
}

/**
 * A ligação abre-se na primeira consulta, não ao carregar o módulo.
 * O `next build` corre sem base de dados: recolhe a configuração das
 * páginas e nunca deve rebentar por causa de uma variável que só faz
 * falta em tempo de execução.
 */
export const sql: Client = new Proxy(function noop() {} as unknown as Client, {
  apply(_target, _thisArg, args: unknown[]) {
    const call = connection() as unknown as (...a: unknown[]) => unknown
    return call(...args)
  },
  get(_target, property) {
    const conn = connection() as unknown as Record<PropertyKey, unknown>
    const value = conn[property]
    return typeof value === 'function' ? value.bind(conn) : value
  },
})

/**
 * QUEM FAZ A PERGUNTA.
 *
 * Quase todas as leituras usam o `sql` de cima e não pensam nisto. Mas
 * uma leitura feita DENTRO de uma transação tem de ser feita pela mão
 * dessa transação, senão sai por outra ligação e não vê — nem espera
 * por — o que lá dentro está a acontecer. É o que separa uma trava a
 * sério de uma trava que parece.
 *
 * Daí este tipo: as funções que tanto servem um caso como o outro
 * recebem-no e usam o que lhes derem.
 */
export type Sql = Client | postgres.TransactionSql<Record<string, never>>

/** Erro de sobreposição levantado pelas restrições de exclusão. */
export const EXCLUSION_VIOLATION = '23P01'
export const UNIQUE_VIOLATION = '23505'

export function isOverlapError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === EXCLUSION_VIOLATION
  )
}

export function isUniqueError(error: unknown, constraint?: string): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code?: string }).code !== UNIQUE_VIOLATION
  ) {
    return false
  }
  if (!constraint) return true
  return (error as { constraint_name?: string }).constraint_name === constraint
}
