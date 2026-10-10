/**
 * As marcações que ficaram em «Marcada» à espera de uma confirmação que
 * deixou de existir. Passam a «Confirmada» — e SÓ ISSO.
 *
 * Hora, cliente, serviço, profissional, preço e bloco de agenda não se
 * tocam. O script prova-o: tira um retrato antes, muda o estado, tira
 * outro retrato, e compara. Se alguma coisa além do estado se mexer, a
 * transacção desfaz-se sozinha.
 *
 * As que já passaram ficam como estão — o passado não se reescreve.
 */
import { ligar } from './_ligar.mjs'

const sql = ligar()
const serio = process.argv.includes('--a-serio')

/**
 * O retrato de tudo o que NÃO pode mudar.
 *
 * As colunas são as da tabela, lidas do esquema e não adivinhadas — a
 * primeira versão deste script inventou um `total_amount_cents` que não
 * existe e rebentou antes de escrever seja o que for. O total não se
 * guarda: soma-se dos itens, que é onde o preço está congelado.
 */
const retrato = (tx, ids) => tx`
  select a.id,
         a.starts_at, a.ends_at, a.client_id, a.unit_id, a.org_id,
         a.language, a.source,
         a.client_note, a.internal_note,
         a.discount_cents, a.discount_reason, a.discount_by_staff_id,
         a.discount_at, a.closed_at, a.closed_by_staff_id,
         a.rescheduled_from_id, a.created_by_staff_id, a.created_at,
         (select jsonb_agg(jsonb_build_object(
                   'id', i.id, 'servico', i.service_name,
                   'staff', i.staff_id, 'de', i.starts_at, 'ate', i.ends_at,
                   'preco', i.price_cents, 'minutos', i.duration_minutes,
                   'folga_antes', i.buffer_before_minutes,
                   'folga_depois', i.buffer_after_minutes)
                 order by i.sort_order)
            from appointment_item i where i.appointment_id = a.id) as itens,
         (select coalesce(sum(i.price_cents), 0)
            from appointment_item i where i.appointment_id = a.id) as total,
         (select jsonb_agg(sb.during::text order by sb.id)
            from staff_block sb
            join appointment_item i on i.id = sb.appointment_item_id
           where i.appointment_id = a.id) as blocos_equipa,
         (select jsonb_agg(rb.during::text order by rb.id)
            from resource_block rb
            join appointment_item i on i.id = rb.appointment_item_id
           where i.appointment_id = a.id) as blocos_recurso
    from appointment a
   where a.id = any(${ids})
   order by a.id
`

const futuras = await sql`
  select a.id, a.starts_at, c.name as cliente
    from appointment a
    join client c on c.id = a.client_id
   where a.status = 'booked' and a.starts_at >= now()
   order by a.starts_at
`
const passadas = await sql`
  select count(*)::int as n from appointment
   where status = 'booked' and starts_at < now()
`

console.log(`Marcações futuras em «Marcada»: ${futuras.length}`)
console.log(`Já passadas, ficam intactas:    ${passadas[0].n}\n`)
for (const m of futuras) {
  console.log(`  ${m.starts_at.toISOString().slice(0, 16).replace('T', ' ')}  ${m.cliente}`)
}

if (futuras.length === 0) {
  console.log('\nNada a fazer.')
  await sql.end()
  process.exit(0)
}

const ids = futuras.map((m) => m.id)

// O ensaio tira o retrato a sério. Um nome de coluna errado rebenta
// AQUI, com a base intacta, e não a meio da gravação.
const prova = await retrato(sql, ids)
console.log(`\nRetrato: ${prova.length} marcação(ões) fotografada(s), sem erro.`)

if (!serio) {
  console.log('Ensaio — nada foi gravado. Para gravar mesmo: --a-serio')
  await sql.end()
  process.exit(0)
}

await sql.begin(async (tx) => {
  const antes = await retrato(tx, ids)

  await tx`
    update appointment set status = 'confirmed'
     where id = any(${ids}) and status = 'booked'
  `
  await tx`
    insert into appointment_status_event
           (appointment_id, from_status, to_status, by_staff_id, by_client, reason)
    select id, 'booked', 'confirmed', null, false,
           'Passagem à nova dinâmica: a marcação deixou de precisar de confirmação.'
      from appointment where id = any(${ids})
  `

  const depois = await retrato(tx, ids)

  // A prova. Os dois retratos têm de sair idênticos — se não saírem,
  // mexeu-se em algo que não era para mexer, e nada disto fica gravado.
  const a = JSON.stringify(antes)
  const d = JSON.stringify(depois)
  if (a !== d) {
    throw new Error(
      'Algo além do estado mudou. Transacção desfeita, nada foi gravado.',
    )
  }
  console.log('\nRetratos idênticos: hora, cliente, serviços, preços e blocos intactos.')
})

const conta = await sql`
  select status, count(*)::int as n from appointment group by status order by status
`
console.log(`\n${ids.length} marcação(ões) passada(s) a «Confirmada».`)
console.log('Estados no livro:', conta.map((r) => `${r.status}: ${r.n}`).join(', '))

await sql.end()
