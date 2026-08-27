/**
 * Identificadores reais para apontar o navegador a páginas concretas.
 *
 * Liga pelo `_ligar` e não à mão: nomes de clientes não viajam em texto
 * simples, e o `.env` pode não ter as aspas que a leitura anterior
 * exigia — bastava tirá-las para isto rebentar.
 */
import { ligar, loadEnv } from './_ligar.mjs'

loadEnv()
const sql = ligar()

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
