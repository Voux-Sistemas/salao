import { readFileSync } from 'node:fs'
import postgres from 'postgres'
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const url = /DATABASE_URL="([^"]+)"/.exec(env)[1]
const sql = postgres(url, { prepare: false })

const staff = await sql`select id, name from staff order by name limit 1`
const client = await sql`select id, name from client order by created_at limit 1`
const booked = await sql`
  select a.id, u.slug
  from appointment a join unit u on u.id = a.unit_id
  where a.status = 'booked' order by a.starts_at limit 1`
const open = await sql`
  select a.id, u.slug
  from appointment a join unit u on u.id = a.unit_id
  where a.status in ('checked_in','in_service','booked')
  order by a.starts_at desc limit 1`

console.log(
  JSON.stringify(
    {
      staff: staff[0].id,
      client: client[0].id,
      booked: booked[0]?.id,
      bookedUnit: booked[0]?.slug,
      comanda: open[0]?.id,
      comandaUnit: open[0]?.slug,
    },
    null,
    2,
  ),
)
await sql.end()
