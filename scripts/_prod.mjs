/**
 * Correr um guião contra a base de produção.
 *
 * A senha da Supabase nunca passa pela linha de comandos nem aparece em
 * lado nenhum: este invólucro lê o .env.production.local (ignorado pelo
 * git) directamente para o ambiente e só depois carrega o guião pedido.
 *
 *   node scripts/_prod.mjs seed
 *   node scripts/_prod.mjs migrate
 *   node scripts/_prod.mjs apagar-cliente +351900000000 --a-serio
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const file = join(root, '.env.production.local')

if (!existsSync(file)) {
  console.error('Falta o .env.production.local.')
  process.exit(1)
}

for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
  if (!match) continue
  const [, key, raw] = match
  process.env[key] = raw.trim().replace(/^["']|["']$/g, '')
}

const target = process.argv[2]
if (!target) {
  console.error('Diga qual: seed | migrate')
  process.exit(1)
}

// Marca visível, para nunca haver dúvida sobre onde é que isto escreveu.
const host = /@([^/:]+)/.exec(process.env.DATABASE_URL ?? '')?.[1] ?? '?'
console.log(`> ${target} contra ${host}\n`)

// O guião importado herda este `process.argv`. Tirar-lhe o nome do
// guião faz com que ele veja os argumentos como se tivesse sido
// chamado à mão — `apagar-cliente.mjs +351900000000 --a-serio`.
process.argv.splice(2, 1)

await import(`./${target}.mjs`)
