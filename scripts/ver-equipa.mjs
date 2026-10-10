/* Quanto trabalho tem uma semana desta casa, a sério. */
import { ligar } from './_ligar.mjs'
const sql = ligar()
const r = await sql`
  select u.slug,
         date_trunc('week', ai.starts_at at time zone u.timezone) as semana,
         count(*)::int as itens,
         count(distinct ai.staff_id)::int as profissionais,
         count(distinct date(ai.starts_at at time zone u.timezone))::int as dias
    from appointment_item ai
    join staff_block sb on sb.appointment_item_id = ai.id
    join unit u on u.id = sb.unit_id
   group by 1,2 order by 2 desc limit 8`
console.log('semanas com trabalho marcado:', r.length)
for (const x of r) console.log(` ${x.slug.padEnd(9)} ${x.semana.toISOString().slice(0,10)}  ${String(x.itens).padStart(3)} itens  ${x.profissionais} profissionais  ${x.dias} dias`)
const p = await sql`select count(*)::int as n from appointment_item`
console.log('\ntotal de itens na base:', p[0].n)
await sql.end()
