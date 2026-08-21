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

function createClient() {
  return postgres(env.databaseUrl, {
    max: env.isProduction ? 4 : 8,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
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
