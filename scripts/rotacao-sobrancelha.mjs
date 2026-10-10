/** Leitura apenas: quem apanharia a primeira Sobrancelha de um dia vazio. */
import { ligar } from './_ligar.mjs'
const sql = ligar()

const rows = await sql`
  select s.name, s.sort_order,
         coalesce((select (sum(extract(epoch from (upper(b.during) - lower(b.during)))) / 60)::int
            from staff_block b
           where b.staff_id = s.id
             and b.during && tstzrange(now() - interval '7 days', now())), 0) as min_7d
    from staff s
    join staff_skill k on k.staff_id = s.id
    join service v on v.id = k.service_id and v.name = 'Sobrancelha'
   where s.is_active
   order by s.sort_order`

for (const r of rows) console.log(`${r.name.padEnd(20)} sort=${String(r.sort_order).padStart(4)}  7dias=${r.min_7d}min`)
await sql.end()
