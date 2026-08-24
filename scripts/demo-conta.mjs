/**
 * Acesso de demonstração à área do cliente (/conta), com dados a sério.
 *
 * Cria uma cliente de demonstração com marcações passadas e futuras, e
 * abre-lhe sessão directamente na tabela `session` — o mesmo que
 * `createSession()` faria, sem passar pelo ecrã de código. Serve para
 * mostrar o /conta populado sem depender do WhatsApp para receber o
 * código.
 *
 * Para desfazer: node scripts/_prod.mjs desfazer-demo-conta
 *
 *   node scripts/_prod.mjs demo-conta
 */
import { randomBytes, createHash } from 'node:crypto'
import { ligar, hostOf } from './_ligar.mjs'

const sql = ligar()
console.log(`> demo-conta contra ${hostOf(process.env.DATABASE_URL)}\n`)

const org = (await sql`select id from org order by created_at limit 1`)[0]
if (!org) throw new Error('sem org')

const unit =
  (await sql`select id, name from unit where org_id = ${org.id} and slug = 'valongo'`)[0] ??
  (await sql`select id, name from unit where org_id = ${org.id} order by sort_order limit 1`)[0]

const equipa = await sql`
  select s.id, s.name
    from staff s
    join staff_role r on r.staff_id = s.id and r.role = 'professional'
   where s.org_id = ${org.id} and s.is_active
   order by s.sort_order
   limit 2
`
if (equipa.length < 2) throw new Error('faltam profissionais activas')

const servicos = await sql`
  select id, name, base_price_cents as price_cents, duration_minutes as minutes
    from service
   where org_id = ${org.id} and is_active
   order by sort_order
   limit 6
`
if (servicos.length < 3) throw new Error('faltam serviços activos')

const dona = (await sql`
  select s.id from staff s
    join staff_role r on r.staff_id = s.id and r.role = 'owner'
   where s.org_id = ${org.id}
   limit 1
`)[0]

const TELEFONE = '+351900000000'
const NOME = 'Cliente Demo'

const existente = await sql`select id from client where org_id = ${org.id} and phone = ${TELEFONE}`
if (existente.length) {
  console.log('Já existe uma cliente demo — a apagar para recomeçar do zero.')
  await sql`delete from client where id = ${existente[0].id}`
}

const [client] = await sql`
  insert into client (org_id, phone, name, email, tags, preferred_unit_id, language)
  values (${org.id}, ${TELEFONE}, ${NOME}, null, ${['demo']}, ${unit.id}, 'pt')
  returning id
`

function em(dias, hora, minuto) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dias)
  d.setHours(hora, minuto, 0, 0)
  return d
}

async function marcar({ staffId, service, startsAt, status }) {
  const start = startsAt
  const end = new Date(start.getTime() + service.minutes * 60000)
  const [appt] = await sql`
    insert into appointment (org_id, unit_id, client_id, status, source,
                             starts_at, ends_at, created_by_staff_id)
    values (${org.id}, ${unit.id}, ${client.id}, ${status}, 'whatsapp',
            ${start.toISOString()}, ${end.toISOString()}, ${dona?.id ?? null})
    returning id
  `
  const [item] = await sql`
    insert into appointment_item (appointment_id, service_id, staff_id, starts_at,
                                  ends_at, price_cents, duration_minutes, service_name)
    values (${appt.id}, ${service.id}, ${staffId}, ${start.toISOString()},
            ${end.toISOString()}, ${service.price_cents}, ${service.minutes}, ${service.name})
    returning id
  `
  if (status !== 'cancelled_by_client' && status !== 'cancelled_by_salon') {
    await sql`
      insert into staff_block (staff_id, unit_id, appointment_item_id, during)
      values (${staffId}, ${unit.id}, ${item.id},
              tstzrange(${start.toISOString()}, ${end.toISOString()}))
    `
  }
  await sql`
    insert into appointment_status_event (appointment_id, from_status, to_status, by_staff_id)
    values (${appt.id}, null, ${status}, ${dona?.id ?? null})
  `
  if (status === 'completed') {
    await sql`update appointment set closed_at = ${end.toISOString()} where id = ${appt.id}`
    const [pay] = await sql`
      insert into payment (appointment_id, unit_id, method, amount_cents, received_at)
      values (${appt.id}, ${unit.id}, 'debit', ${service.price_cents}, ${end.toISOString()})
      returning id
    `
    void pay
  }
}

// Passado: três visitas já concluídas.
await marcar({ staffId: equipa[0].id, service: servicos[0], startsAt: em(-18, 10, 0), status: 'completed' })
await marcar({ staffId: equipa[1].id, service: servicos[1], startsAt: em(-9, 15, 30), status: 'completed' })
await marcar({ staffId: equipa[0].id, service: servicos[2], startsAt: em(-3, 11, 0), status: 'completed' })

// Futuro: duas marcações a caminho.
await marcar({ staffId: equipa[1].id, service: servicos[0], startsAt: em(3, 14, 0), status: 'confirmed' })
await marcar({ staffId: equipa[0].id, service: servicos[1], startsAt: em(9, 16, 30), status: 'booked' })

await sql`update client set first_visit_at = ${em(-18, 10, 0).toISOString()}, last_visit_at = ${em(-3, 11, 0).toISOString()} where id = ${client.id}`

// Sessão directa — o que createSession() faria, sem passar pelo código.
const token = randomBytes(32).toString('base64url')
const tokenHash = createHash('sha256').update(token).digest('hex')
const expiresAt = new Date(Date.now() + 60 * 86_400_000)
await sql`
  insert into session (subject_type, subject_id, token_hash, expires_at, user_agent)
  values ('client', ${client.id}, ${tokenHash}, ${expiresAt.toISOString()}, 'demo-manual')
`

console.log('Cliente demo criada:', client.id)
console.log('Telefone:', TELEFONE)
console.log('\nToken de sessão (60 dias):\n' + token)
console.log('\nPara desfazer tudo:\n  node scripts/_prod.mjs desfazer-demo-conta')

await sql.end()
