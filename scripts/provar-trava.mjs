/**
 * Prova que o cadeado põe mesmo duas escritas em fila.
 *
 * Nao toca em marcacoes: abre duas transacoes, pede o MESMO cadeado nas
 * duas, e mede se a segunda espera. No fim faz rollback das duas.
 */
import { ligar } from './_ligar.mjs'

// Tres ligacoes SEPARADAS. Com uma so (o `max: 1` do _ligar) as
// transacoes partilhavam-na e o teste media a fila da ligacao, nao a
// do cadeado — e dava falso negativo.
const a = ligar()
const b = ligar()
const c = ligar()
const sql = a

function hashKey(text) {
  let h = 0xcbf29ce484222325n
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i))
    h = BigInt.asUintN(64, h * 0x100000001b3n)
  }
  return BigInt.asIntN(64, h)
}

const chave = hashKey('profissional-x:2026-09-01').toString()
const outra = hashKey('profissional-y:2026-09-01').toString()
console.log('Chave gerada:', chave)
console.log('Chave de outra profissional:', outra, '(diferente:', chave !== outra, ')\n')

const marca = () => Number(process.hrtime.bigint() / 1000000n)

// As ligacoes abrem-se preguicosamente: a primeira consulta paga o
// TLS e o aperto de mao com o pooler, mais de um segundo daqui a
// Frankfurt. Sem isto o cronometro media a abertura da ligacao e nao a
// espera pelo cadeado — e a terceira transacao parecia bloqueada.
await Promise.all([a`select 1`, b`select 1`, c`select 1`])

// Quanto custa uma transacao vazia contra Frankfurt? Sem esta medida
// nao se sabe se os milissegundos da terceira sao espera pelo cadeado
// ou apenas as viagens do BEGIN e da consulta.
const base0 = marca()
await c.begin(async (tx) => { await tx`select 1` })
const base = marca() - base0
console.log(`Ida e volta de uma transacao vazia: ${base}ms (o piso de qualquer medida)
`)

let segundaEntrou = null

// A primeira segura o cadeado 900ms; a segunda pede o mesmo e deve esperar.
const primeira = a.begin(async (tx) => {
  await tx`select pg_advisory_xact_lock(${chave}::bigint)`
  console.log('1a transacao: cadeado na mao.')
  await new Promise((r) => setTimeout(r, 900))
  console.log('1a transacao: a largar (rollback).')
  throw new Error('rollback de proposito')
}).catch(() => {})

await new Promise((r) => setTimeout(r, 100))
const inicio = marca()

const segunda = b.begin(async (tx) => {
  await tx`select pg_advisory_xact_lock(${chave}::bigint)`
  segundaEntrou = marca() - inicio
  throw new Error('rollback de proposito')
}).catch(() => {})

// E uma terceira, com chave DIFERENTE, que nao deve esperar nada.
const t0 = marca()
let terceiraEntrou = null
const terceira = c.begin(async (tx) => {
  await tx`select pg_advisory_xact_lock(${outra}::bigint)`
  terceiraEntrou = marca() - t0
  throw new Error('rollback de proposito')
}).catch(() => {})

await Promise.all([primeira, segunda, terceira])

console.log(`\n2a transacao (MESMA chave) esperou ${segundaEntrou}ms`)
console.log(`3a transacao (chave DIFERENTE) esperou ${terceiraEntrou}ms\n`)
console.log('Poe em fila quem devia esperar:', segundaEntrou > 500 ? 'SIM' : '>>> NAO <<<')
// A terceira nao pode ser comparada com zero: pagou as mesmas viagens
// que a transacao vazia. O que prova que nao esperou pelo cadeado e
// nao ter esperado MUITO MAIS do que esse piso.
const tecto = base * 2 + 200
console.log(`Deixa passar quem nao colide:  ${terceiraEntrou < tecto ? 'SIM' : '>>> NAO <<<'} (piso ${base}ms, tolerado ate ${tecto}ms)`)

const restos = await sql`select count(*)::int n from pg_locks where locktype='advisory'`
console.log('\nCadeados ainda presos depois do rollback:', restos[0].n, restos[0].n === 0 ? '(largou tudo, SIM)' : '')
await sql.end()
