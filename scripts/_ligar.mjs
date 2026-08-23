/**
 * A LIGAÇÃO À BASE, PARA OS GUIÕES.
 *
 * Os guiões correm fora do Next: não têm o `lib/db.ts` nem o carregador
 * de ambiente dele. Cada um lia o `.env` à mão e montava o seu cliente,
 * e o que se perdia nessa cópia era sempre a mesma coisa — o TLS. O
 * `postgres.js` liga em texto simples por omissão e o Supabase aceita:
 * a senha da ligação e os telefones das clientes iam pela internet em
 * claro sem ninguém dar por isso.
 *
 * Aqui só há um sítio onde isso se decide, e é o mesmo critério do
 * `lib/db.ts`: em casa não há TLS nenhum para pedir, fora de casa
 * exige-se sempre.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Lê o `.env` para o ambiente. O que já estiver definido ganha — é
 * assim que o `_prod.mjs` manda o guião para a Supabase sem que o
 * `.env` local lhe passe por cima.
 */
export function loadEnv() {
  const file = join(root, '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    const [, key, raw] = match
    if (process.env[key]) continue
    process.env[key] = raw.trim().replace(/^["']|["']$/g, '')
  }
}

/** O servidor a que a DATABASE_URL aponta, para se dizer em voz alta. */
export function hostOf(url) {
  return /@([^/:]+)/.exec(url ?? '')?.[1] ?? '?'
}

export function isLocal(url) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostOf(url))
}

/**
 * `require` e não `verify-full`: o certificado do pooler da Supabase é
 * assinado pela autoridade deles, e verificar a cadeia obrigaria a
 * trazer esse certificado connosco. Quem quiser mandar nisto escreve
 * `?sslmode=...` na própria DATABASE_URL e essa decisão ganha.
 */
function sslFor(url) {
  if (/[?&]sslmode=/.test(url)) return undefined
  return isLocal(url) ? false : 'require'
}

/**
 * Devolve o cliente já ligado ao sítio certo. Sai com erro — em vez de
 * rebentar a meio de uma transação — se não houver DATABASE_URL.
 */
export function ligar(options = {}) {
  loadEnv()
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
    process.exit(1)
  }
  const ssl = sslFor(url)
  return postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 20,
    // Os `NOTICE` do Postgres (`... already exists, skipping`) enchiam o
    // ecrã e escondiam o que o guião tinha para dizer. Quem os quiser
    // passa o seu `onnotice`.
    onnotice: () => {},
    ...(ssl === undefined ? {} : { ssl }),
    ...options,
  })
}
