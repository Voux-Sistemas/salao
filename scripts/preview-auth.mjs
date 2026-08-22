/**
 * SESSÕES DE PRÉ-VISUALIZAÇÃO — só para o preview local.
 *
 * Cria sessões directamente na base (mesmo formato de
 * lib/auth/session.ts: token aleatório no cookie, sha256 na tabela) e
 * escreve storage-states do Playwright para tirar screenshots das
 * áreas autenticadas sem passar pelo formulário.
 *
 *   node scripts/preview-auth.mjs <pasta-destino>
 *
 * Gera <pasta>/state-dona.json, state-gerente.json, state-marta.json,
 * state-cliente.json.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomBytes } from 'node:crypto'
import postgres from 'postgres'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const out = process.argv[2]
if (!out) {
  console.error('Uso: node scripts/preview-auth.mjs <pasta-destino>')
  process.exit(1)
}
mkdirSync(out, { recursive: true })

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
const sha256 = (t) => createHash('sha256').update(t).digest('hex')

async function mint(subjectType, subjectId, file) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 86_400_000)
  await sql`
    insert into session (subject_type, subject_id, token_hash, expires_at, user_agent)
    values (${subjectType}, ${subjectId}, ${sha256(token)}, ${expiresAt}, 'preview-auth')
  `
  const state = {
    cookies: [{
      name: subjectType === 'staff' ? 'salao_desk' : 'salao_conta',
      value: token,
      domain: 'localhost',
      path: '/',
      expires: Math.floor(expiresAt.getTime() / 1000),
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }],
    origins: [],
  }
  writeFileSync(join(out, file), JSON.stringify(state, null, 2))
  console.log(`${file} pronto`)
}

try {
  const staff = await sql`select id, phone from staff order by phone`
  const byPhone = Object.fromEntries(staff.map((s) => [s.phone, s.id]))
  const [client] = await sql`select id from client where phone = '+351961000001'`

  await mint('staff', byPhone['+351911000010'], 'state-dona.json')
  await mint('staff', byPhone['+351911000011'], 'state-gerente.json')
  await mint('staff', byPhone['+351911000012'], 'state-marta.json')
  if (client) await mint('client', client.id, 'state-cliente.json')
} catch (error) {
  console.error('Falhou:', error?.message ?? error)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
