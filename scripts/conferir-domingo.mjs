/** Leitura apenas: os turnos de domingo ficaram criados? */
import { ligar } from './_ligar.mjs'
const sql = ligar()
const rows = await sql`
  select u.name as loja, s.name, h.starts_min, h.ends_min
    from staff_schedule h
    join staff s on s.id = h.staff_id
    join unit u on u.id = h.unit_id
   where h.weekday = 0
   order by u.name, s.name`
for (const r of rows) {
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`
  console.log(`${r.loja.padEnd(10)} ${r.name.padEnd(20)} ${hm(r.starts_min)}–${hm(r.ends_min)}`)
}
console.log(rows.length + ' turno(s) de domingo')
await sql.end()
