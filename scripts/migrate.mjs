/**
 * CORRER AS MIGRAÇÕES SEM DOCKER E SEM psql.
 *
 * O `supabase db push` precisa da CLI ligada ao projecto; o `psql` pode
 * nem existir na máquina. Isto só precisa da DATABASE_URL: liga-se ao
 * Postgres, vê o que já correu e aplica o que falta, por ordem de nome.
 *
 *   node scripts/migrate.mjs            aplica o que falta
 *   node scripts/migrate.mjs --status   só diz o que falta, não toca
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const folder = join(root, 'supabase', 'migrations')

/** Lê o .env à mão — este script corre fora do Next. */
function loadEnv() {
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

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const statusOnly = process.argv.includes('--status')

const sql = postgres(url, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  idle_timeout: 5,
  onnotice: () => {},
})

try {
  await sql.unsafe(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const done = new Set(
    (await sql`select name from public.schema_migrations`).map((r) => r.name),
  )
  const files = readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  const pending = files.filter((name) => !done.has(name))

  if (pending.length === 0) {
    console.log(`Nada a fazer — ${files.length} migrações já aplicadas.`)
  } else if (statusOnly) {
    console.log(`Por aplicar (${pending.length}):`)
    for (const name of pending) console.log(`  · ${name}`)
  } else {
    for (const name of pending) {
      const body = readFileSync(join(folder, name), 'utf8')
      process.stdout.write(`→ ${name} `)
      /*
       * Protocolo simples: o Postgres envolve o lote inteiro numa
       * transação implícita. Ou o ficheiro entra todo, ou não entra —
       * e o registo entra no mesmo lote, para não haver meio-caminho.
       */
      await sql
        .unsafe(
          `${body}\n;\ninsert into public.schema_migrations (name) values ('${name}');`,
        )
        .simple()
      console.log('ok')
    }
    console.log(`\n${pending.length} migração(ões) aplicada(s).`)
  }
} catch (error) {
  console.error('\nFalhou:', error?.message ?? error)
  if (error?.position) console.error('posição:', error.position)
  if (error?.detail) console.error('detalhe:', error.detail)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
