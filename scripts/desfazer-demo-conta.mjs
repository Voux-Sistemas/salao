/**
 * Desfaz o scripts/demo-conta.mjs: apaga a cliente demo (e tudo o que
 * depende dela por cascata — marcações, itens, blocos, sessão).
 *
 *   node scripts/_prod.mjs desfazer-demo-conta
 */
import { ligar, hostOf } from './_ligar.mjs'

const sql = ligar()
console.log(`> desfazer-demo-conta contra ${hostOf(process.env.DATABASE_URL)}\n`)

const [client] = await sql`select id, name from client where phone = '+351900000000'`
if (!client) {
  console.log('Já não há cliente demo — nada a fazer.')
} else {
  await sql`delete from appointment where client_id = ${client.id}`
  await sql`delete from session where subject_type = 'client' and subject_id = ${client.id}`
  await sql`delete from client where id = ${client.id}`
  console.log('Apagada:', client.name, client.id)
}

await sql.end()
