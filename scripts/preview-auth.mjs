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
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { ligar, loadEnv } from './_ligar.mjs'

loadEnv()

const out = process.argv[2]
if (!out) {
  console.error('Uso: node scripts/preview-auth.mjs <pasta-destino>')
  process.exit(1)
}
mkdirSync(out, { recursive: true })

// Pelo `_ligar` e nao a mao: e ele que liga cifrado. Isto escreve
// sessoes na base — sem TLS iam por ai fora em texto simples, e uma
// sessao lida do fio e uma sessao roubada.
const sql = ligar()
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

/** joao-da-silva a partir de "João da Silva". */
const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

try {
  // Uma sessão por pessoa da equipa, seja quem for: assim o script não
  // fica preso aos telefones de um seed em particular.
  const staff = await sql`
    select s.id, s.name, coalesce(r.role, 'professional') as role
      from staff s
      left join staff_role r on r.staff_id = s.id
     order by case coalesce(r.role, 'professional')
                when 'owner' then 0 when 'manager' then 1 else 2 end,
              s.sort_order
  `
  for (const person of staff) {
    await mint('staff', person.id, `state-${slugify(person.name)}.json`)
  }

  const [client] = await sql`select id from client order by created_at limit 1`
  if (client) await mint('client', client.id, 'state-cliente.json')
} catch (error) {
  console.error('Falhou:', error?.message ?? error)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
