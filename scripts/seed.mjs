/**
 * DADOS DE DEMONSTRAÇÃO — só para o preview local.
 *
 * Semeia a rede "Nohora Ramirez Beauty Studio": duas casas, catálogo,
 * equipa, clientes, o dia de hoje em andamento, uma semana futura de
 * marcações e SEIS SEMANAS de histórico fechado (pagamentos e
 * comissões) para os painéis da dona terem carne.
 *
 * Volta a correr quantas vezes quiseres: apaga a rede anterior pelo
 * slug antes de semear outra vez. Determinístico — mesmo resultado
 * sempre, a menos do dia em que corre.
 *
 *   node scripts/seed.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, scrypt } from 'node:crypto'
import postgres from 'postgres'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const file = join(root, '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    const [, key, raw] = match
    if (process.env[key]) continue
    process.env[key] = raw.trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

// Isto apaga tudo e põe um salão de mentira no lugar. Contra uma base
// local é o que se quer; contra a Supabase seria trocar o salão a sério
// por dois salões inventados em Lisboa. Fora de casa, nem por engano.
const host = /@([^/:]+)/.exec(url)?.[1] ?? '?'
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`Este é o seed de DEMONSTRAÇÃO e ${host} não é a sua máquina.`)
  console.error('Para semear o salão a sério use scripts/seed-real.mjs.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 20 })

/** scrypt$N$r$p$salt$chave — mesmo formato de lib/auth/password.ts. */
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16)
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error)
        else
          resolve(
            ['scrypt', 16384, 8, 1, salt.toString('base64url'), key.toString('base64url')].join('$'),
          )
      },
    )
  })
}

/** Gerador determinístico: o seed produz sempre o mesmo salão. */
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260821)
const pick = (list) => list[Math.floor(rand() * list.length)]

const DEMO_PASSWORD = 'demo1234'

/** Instantes na hora de Lisboa (verão = UTC+1). */
function onDay(offsetDays, hour, minute) {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`
}
const today = (h, m) => onDay(0, h, m)
function dateOf(offsetDays) {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}
const weekdayOf = (offsetDays) => {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  return now.getUTCDay()
}

try {
  // Reset total da demo: truncate cascade limpa tudo o que referencia a rede.
  await sql`truncate table org cascade`

  const [org] = await sql`
    insert into org (name, slug, timezone, currency, default_language, whatsapp_phone)
    values ('Nohora Ramirez', 'nohora-ramirez', 'Europe/Lisbon', 'EUR', 'pt', '+351911000000')
    returning id
  `
  const orgId = org.id

  const [chiado] = await sql`
    insert into unit (org_id, slug, name, timezone, address_line, postal_code, city, country, phone, whatsapp_phone, min_lead_minutes, max_lead_days, slot_granularity_minutes, cancel_window_hours, sort_order)
    values (${orgId}, 'chiado', 'Chiado', 'Europe/Lisbon', 'Rua Garrett 24, 2.º', '1200-204', 'Lisboa', 'PT', '+351211000001', '+351911000001', 120, 60, 15, 24, 1)
    returning id
  `
  const [cascais] = await sql`
    insert into unit (org_id, slug, name, timezone, address_line, postal_code, city, country, phone, whatsapp_phone, min_lead_minutes, max_lead_days, slot_granularity_minutes, cancel_window_hours, sort_order)
    values (${orgId}, 'cascais', 'Cascais', 'Europe/Lisbon', 'Avenida Valbom 12, loja B', '2750-508', 'Cascais', 'PT', '+351214000001', '+351914000001', 120, 60, 15, 24, 2)
    returning id
  `

  // terça a sábado; almoço fechado no Chiado (14h–15h aberto direto em Cascais)
  for (const unitId of [chiado.id, cascais.id]) {
    for (let weekday = 2; weekday <= 6; weekday++) {
      const closes = weekday === 6 ? 1080 : 1170 // sábado até 18h, resto até 19h30
      await sql`
        insert into business_hours (unit_id, weekday, opens_min, closes_min)
        values (${unitId}, ${weekday}, 570, ${closes})
      `
    }
    // segunda meio-dia
    await sql`
      insert into business_hours (unit_id, weekday, opens_min, closes_min)
      values (${unitId}, 1, 600, 840)
    `
  }

  const [catCabelo] = await sql`
    insert into service_category (org_id, slug, name, sort_order) values (${orgId}, 'cabelo', 'Cabelo', 1) returning id
  `
  const [catUnhas] = await sql`
    insert into service_category (org_id, slug, name, sort_order) values (${orgId}, 'unhas', 'Unhas', 2) returning id
  `
  const [catEstetica] = await sql`
    insert into service_category (org_id, slug, name, sort_order) values (${orgId}, 'estetica', 'Estética', 3) returning id
  `

  async function makeService(category, slug, name, description, priceCents, minutes, opts = {}) {
    const [row] = await sql`
      insert into service (org_id, category_id, slug, name, description, base_price_cents, duration_minutes, buffer_after_minutes, bookable_online, sort_order)
      values (${orgId}, ${category}, ${slug}, ${name}, ${description}, ${priceCents}, ${minutes}, ${opts.bufferAfter ?? 5}, ${opts.bookableOnline ?? true}, ${opts.sort ?? 0})
      returning id
    `
    return { id: row.id, name, priceCents, minutes }
  }

  const corte = await makeService(catCabelo.id, 'corte', 'Corte & styling',
    'Consulta, corte à tesoura e finalização com escova.', 3500, 45, { sort: 1 })
  const coloracao = await makeService(catCabelo.id, 'coloracao', 'Coloração',
    'Cor global com produtos profissionais e tratamento selante.', 7500, 120, { sort: 2, bufferAfter: 10 })
  const madeixas = await makeService(catCabelo.id, 'madeixas', 'Madeixas & balayage',
    'Técnica livre à mão, matização incluída.', 12000, 180, { sort: 3, bufferAfter: 15 })
  const escova = await makeService(catCabelo.id, 'escova', 'Brushing',
    'Lavagem, massagem de couro cabeludo e escova modelada.', 2500, 40, { sort: 4 })
  const manicure = await makeService(catUnhas.id, 'manicure', 'Manicure completa',
    'Tratamento de cutículas, forma e verniz de longa duração.', 2200, 45, { sort: 1 })
  const pedicure = await makeService(catUnhas.id, 'pedicure', 'Pedicure spa',
    'Esfoliação, hidratação e verniz — com cadeira de massagem.', 3000, 60, { sort: 2 })
  const gel = await makeService(catUnhas.id, 'gel', 'Unhas de gel',
    'Construção ou manutenção em gel, acabamento à escolha.', 4500, 75, { sort: 3 })
  const sobrancelha = await makeService(catEstetica.id, 'sobrancelha', 'Design de sobrancelha',
    'Mapeamento facial e depilação com pinça e cera.', 1800, 30, { sort: 1 })
  const limpeza = await makeService(catEstetica.id, 'limpeza-pele', 'Limpeza de pele',
    'Higienização profunda com vapor de ozono e máscara final.', 5500, 75, { sort: 2 })
  const maquilhagem = await makeService(catEstetica.id, 'maquilhagem', 'Maquilhagem',
    'Produção completa para eventos. Inclui prova de olhar.', 6000, 60, { sort: 3, bookableOnline: false })

  const passwordHash = await hashPassword(DEMO_PASSWORD)

  async function makeStaff(name, phone, email, color, bio, acceptsOnline = true) {
    const [row] = await sql`
      insert into staff (org_id, name, phone, email, password_hash, display_color, bio, accepts_online_booking)
      values (${orgId}, ${name}, ${phone}, ${email}, ${passwordHash}, ${color}, ${bio}, ${acceptsOnline})
      returning id
    `
    return row.id
  }

  const donaId = await makeStaff('Nohora Ramirez', '+351911000010', 'nohora@nohoraramirez.pt', '#B08968',
    'Fundadora. Trinta anos de tesoura, um só princípio: sair melhor do que se entrou.', false)
  await sql`insert into staff_role (staff_id, role, unit_id) values (${donaId}, 'owner', null)`

  const gerenteId = await makeStaff('Isabel Rocha', '+351911000011', 'isabel@nohoraramirez.pt', '#8C7A6B',
    'Gerente do Chiado. A agenda passa toda pelas mãos dela.', false)
  await sql`insert into staff_role (staff_id, role, unit_id) values (${gerenteId}, 'manager', ${chiado.id})`
  await sql`insert into staff_unit (staff_id, unit_id) values (${gerenteId}, ${chiado.id})`

  const martaId = await makeStaff('Marta Ferreira', '+351911000012', 'marta@nohoraramirez.pt', '#C6A96B',
    'Colorista. Balayage e loiros frios são a especialidade da casa.')
  await sql`insert into staff_role (staff_id, role, unit_id) values (${martaId}, 'professional', ${chiado.id})`
  await sql`insert into staff_unit (staff_id, unit_id) values (${martaId}, ${chiado.id})`

  const beatrizId = await makeStaff('Beatriz Alves', '+351911000013', 'beatriz@nohoraramirez.pt', '#A47C6F',
    'Nail artist. Do clássico francês à construção em gel.')
  await sql`insert into staff_role (staff_id, role, unit_id) values (${beatrizId}, 'professional', ${chiado.id})`
  await sql`insert into staff_unit (staff_id, unit_id) values (${beatrizId}, ${chiado.id})`

  const carlaId = await makeStaff('Carla Mendes', '+351911000014', 'carla@nohoraramirez.pt', '#C7A27C',
    'Cabelo e pele em Cascais. Mãos calmas, resultados discretos.')
  await sql`insert into staff_role (staff_id, role, unit_id) values (${carlaId}, 'professional', ${cascais.id})`
  await sql`insert into staff_unit (staff_id, unit_id) values (${carlaId}, ${cascais.id})`

  const sofiaId = await makeStaff('Sofia Teles', '+351911000015', 'sofia@nohoraramirez.pt', '#9C8F7A',
    'Esteticista em Cascais. Limpeza de pele e sobrancelhas.')
  await sql`insert into staff_role (staff_id, role, unit_id) values (${sofiaId}, 'professional', ${cascais.id})`
  await sql`insert into staff_unit (staff_id, unit_id) values (${sofiaId}, ${cascais.id})`

  const skillsOf = {
    [martaId]: [corte, coloracao, madeixas, escova],
    [beatrizId]: [manicure, pedicure, gel, sobrancelha],
    [carlaId]: [corte, escova, manicure, maquilhagem],
    [sofiaId]: [sobrancelha, limpeza, pedicure, maquilhagem],
  }
  for (const [staffId, services] of Object.entries(skillsOf)) {
    for (const s of services) {
      await sql`insert into staff_skill (staff_id, service_id) values (${staffId}, ${s.id})`
    }
  }

  const scheduleFrom = dateOf(-200)
  const unitOf = {
    [martaId]: chiado.id,
    [beatrizId]: chiado.id,
    [carlaId]: cascais.id,
    [sofiaId]: cascais.id,
  }
  for (const [staffId, unitId] of Object.entries(unitOf)) {
    for (let weekday = 2; weekday <= 6; weekday++) {
      const closes = weekday === 6 ? 1080 : 1170
      await sql`
        insert into staff_schedule (staff_id, unit_id, weekday, starts_min, ends_min, valid_from)
        values (${staffId}, ${unitId}, ${weekday}, 570, ${closes}, ${scheduleFrom})
      `
    }
  }

  await sql`insert into commission_rule (org_id, staff_id, service_id, percent) values (${orgId}, null, null, 30)`
  await sql`insert into commission_rule (org_id, staff_id, service_id, percent) values (${orgId}, ${martaId}, ${madeixas.id}, 40)`
  await sql`insert into commission_rule (org_id, staff_id, service_id, percent) values (${orgId}, null, ${gel.id}, 35)`

  const CLIENTS = [
    ['Ana Silva', '+351961000001', 'ana.silva@gmail.com', ['vip'], 0],
    ['João Costa', '+351961000002', null, [], 0],
    ['Rita Nunes', '+351961000003', 'rita.nunes@sapo.pt', [], 0],
    ['Sofia Lopes', '+351961000004', null, ['alergia'], 0],
    ['Teresa Vaz Pinto', '+351961000005', 'tvp@icloud.com', ['vip'], 0],
    ['Miguel Santos', '+351961000006', null, [], 2],
    ['Carolina Faria', '+351961000007', 'carolfaria@gmail.com', [], 0],
    ['Inês Barros', '+351961000008', null, [], 0],
    ['Helena Duarte', '+351961000009', 'h.duarte@gmail.com', ['noiva'], 0],
    ['Marta Gonçalves', '+351961000010', null, [], 0],
    ['Beatriz Cardoso', '+351961000011', null, [], 1],
    ['Laura Ribeiro', '+351961000012', 'laura.r@outlook.com', [], 0],
  ]
  const clientIds = []
  for (const [name, phone, email, tags, noShow] of CLIENTS) {
    const [row] = await sql`
      insert into client (org_id, phone, name, email, tags, no_show_count, preferred_unit_id, language)
      values (${orgId}, ${phone}, ${name}, ${email}, ${tags}, ${noShow}, ${rand() < 0.7 ? chiado.id : cascais.id}, 'pt')
      returning id
    `
    clientIds.push(row.id)
  }
  await sql`
    insert into client_note (client_id, author_id, body)
    values (${clientIds[3]}, ${beatrizId}, 'Alergia a acetona — usar removedor sem acetona.'),
           (${clientIds[0]}, ${martaId}, 'Prefere café curto sem açúcar. Base 7.1 no último retoque.'),
           (${clientIds[8]}, ${carlaId}, 'Casamento a 12 de Outubro — prova de maquilhagem duas semanas antes.')
  `

  /** Marcação completa: envelope + item + bloco + evento de estado. */
  async function makeAppointment({
    unitId, clientId, staffId, service, startsAt, status,
    source = 'counter', createdBy = gerenteId,
  }) {
    const start = new Date(startsAt)
    const end = new Date(start.getTime() + service.minutes * 60000)
    const [appt] = await sql`
      insert into appointment (org_id, unit_id, client_id, status, source, starts_at, ends_at, created_by_staff_id)
      values (${orgId}, ${unitId}, ${clientId}, ${status}, ${source}, ${start.toISOString()}, ${end.toISOString()}, ${createdBy})
      returning id
    `
    const [item] = await sql`
      insert into appointment_item (appointment_id, service_id, staff_id, starts_at, ends_at, price_cents, duration_minutes, service_name)
      values (${appt.id}, ${service.id}, ${staffId}, ${start.toISOString()}, ${end.toISOString()}, ${service.priceCents}, ${service.minutes}, ${service.name})
      returning id
    `
    if (!['cancelled_by_client', 'cancelled_by_salon'].includes(status)) {
      await sql`
        insert into staff_block (staff_id, unit_id, appointment_item_id, during)
        values (${staffId}, ${unitId}, ${item.id}, tstzrange(${start.toISOString()}, ${end.toISOString()}))
      `
    }
    await sql`
      insert into appointment_status_event (appointment_id, from_status, to_status, by_staff_id)
      values (${appt.id}, null, ${status}, ${createdBy})
    `
    return { apptId: appt.id, itemId: item.id }
  }

  /** Fecha a comanda: pagamento + comissão congelada. */
  async function closeOut({ apptId, itemId }, { unitId, staffId, service, whenIso, percent }) {
    await sql`
      update appointment set closed_at = ${whenIso}, closed_by_staff_id = ${staffId}
      where id = ${apptId}
    `
    const method = pick(['cash', 'debit', 'debit', 'credit', 'other'])
    await sql`
      insert into payment (appointment_id, unit_id, method, amount_cents, received_by_staff_id, received_at)
      values (${apptId}, ${unitId}, ${method}, ${service.priceCents}, ${staffId}, ${whenIso})
    `
    const amount = Math.round((service.priceCents * percent) / 100)
    const paid = rand() < 0.6
    await sql`
      insert into commission_entry (org_id, unit_id, appointment_id, appointment_item_id, staff_id, item_price_cents, discount_share_cents, base_cents, percent, amount_cents, status, paid_at, generated_at)
      values (${orgId}, ${unitId}, ${apptId}, ${itemId}, ${staffId}, ${service.priceCents}, 0, ${service.priceCents}, ${percent}, ${amount},
              ${paid ? 'paid' : 'pending'}, ${paid ? whenIso : null}, ${whenIso})
    `
    return method
  }

  function percentFor(staffId, service) {
    if (staffId === martaId && service.id === madeixas.id) return 40
    if (service.id === gel.id) return 35
    return 30
  }

  // --- SEIS SEMANAS DE HISTÓRICO ---------------------------------------
  const roster = [
    { staffId: martaId, unitId: chiado.id },
    { staffId: beatrizId, unitId: chiado.id },
    { staffId: carlaId, unitId: cascais.id },
    { staffId: sofiaId, unitId: cascais.id },
  ]
  for (let d = 42; d >= 1; d--) {
    const weekday = weekdayOf(-d)
    if (weekday === 0) continue // domingo fechado
    const dayLoad = weekday === 6 ? 3 : weekday === 1 ? 1 : 2 // sábado cheio, segunda leve
    for (const { staffId, unitId } of roster) {
      const services = skillsOf[staffId]
      const count = Math.max(1, Math.round(dayLoad * (0.6 + rand() * 0.9)))
      let hour = 9 + Math.floor(rand() * 2)
      for (let i = 0; i < count && hour <= 17; i++) {
        const service = pick(services)
        const clientId = pick(clientIds)
        const roll = rand()
        const minute = pick([0, 15, 30, 45])
        const startsAt = onDay(-d, hour, minute)
        if (roll < 0.06) {
          await makeAppointment({ unitId, clientId, staffId, service, startsAt, status: 'no_show', source: pick(['site', 'phone']) })
        } else if (roll < 0.1) {
          await makeAppointment({ unitId, clientId, staffId, service, startsAt, status: 'cancelled_by_client', source: 'site' })
        } else {
          const made = await makeAppointment({ unitId, clientId, staffId, service, startsAt, status: 'completed', source: pick(['site', 'site', 'counter', 'phone', 'whatsapp']) })
          const closeHour = hour + Math.ceil(service.minutes / 60)
          await closeOut(made, { unitId, staffId, service, whenIso: onDay(-d, Math.min(closeHour, 20), 15), percent: percentFor(staffId, service) })
        }
        hour += Math.ceil(service.minutes / 60) + 1
      }
    }
  }

  // --- HOJE, em andamento ----------------------------------------------
  const doneToday = await makeAppointment({
    unitId: chiado.id, clientId: clientIds[0], staffId: martaId,
    service: corte, startsAt: today(9, 15), status: 'completed', source: 'site',
  })
  await closeOut(doneToday, { unitId: chiado.id, staffId: martaId, service: corte, whenIso: today(10, 10), percent: 30 })

  await makeAppointment({
    unitId: chiado.id, clientId: clientIds[1], staffId: martaId,
    service: coloracao, startsAt: today(10, 30), status: 'in_service', source: 'site',
  })
  await makeAppointment({
    unitId: chiado.id, clientId: clientIds[2], staffId: beatrizId,
    service: gel, startsAt: today(11, 0), status: 'checked_in',
  })
  await makeAppointment({
    unitId: chiado.id, clientId: clientIds[4], staffId: beatrizId,
    service: manicure, startsAt: today(14, 30), status: 'confirmed', source: 'site',
  })
  await makeAppointment({
    unitId: chiado.id, clientId: clientIds[8], staffId: martaId,
    service: madeixas, startsAt: today(14, 0), status: 'confirmed', source: 'whatsapp',
  })
  await makeAppointment({
    unitId: chiado.id, clientId: clientIds[5], staffId: beatrizId,
    service: sobrancelha, startsAt: today(16, 30), status: 'booked', source: 'phone',
  })
  await makeAppointment({
    unitId: cascais.id, clientId: clientIds[6], staffId: carlaId,
    service: escova, startsAt: today(10, 0), status: 'completed',
  })
  await makeAppointment({
    unitId: cascais.id, clientId: clientIds[7], staffId: sofiaId,
    service: limpeza, startsAt: today(11, 30), status: 'in_service', source: 'site',
  })
  await makeAppointment({
    unitId: cascais.id, clientId: clientIds[11], staffId: carlaId,
    service: corte, startsAt: today(15, 0), status: 'booked', source: 'site',
  })

  // caixa de hoje aberto no Chiado, com a venda da manhã lançada
  const [cash] = await sql`
    insert into cash_session (unit_id, business_date, status, opening_cents, opened_by_staff_id)
    values (${chiado.id}, ${dateOf(0)}, 'open', 5000, ${gerenteId})
    returning id
  `
  const [pay] = await sql`
    select id from payment where appointment_id = ${doneToday.apptId}
  `
  await sql`
    insert into cash_movement (cash_session_id, kind, amount_cents, payment_id, appointment_id, by_staff_id)
    values (${cash.id}, 'sale', ${corte.priceCents}, ${pay.id}, ${doneToday.apptId}, ${martaId})
  `

  // --- PRÓXIMOS SETE DIAS ----------------------------------------------
  for (let d = 1; d <= 7; d++) {
    const weekday = weekdayOf(d)
    if (weekday === 0) continue
    for (const { staffId, unitId } of roster) {
      if (rand() < 0.35) continue
      const services = skillsOf[staffId]
      const service = pick(services)
      const hour = 10 + Math.floor(rand() * 6)
      await makeAppointment({
        unitId, clientId: pick(clientIds), staffId, service,
        startsAt: onDay(d, hour, pick([0, 30])),
        status: rand() < 0.5 ? 'confirmed' : 'booked',
        source: pick(['site', 'site', 'counter', 'whatsapp']),
      })
    }
  }

  const [{ count: apptCount }] = await sql`select count(*)::int as count from appointment`
  const [{ sum: revenue }] = await sql`select coalesce(sum(amount_cents),0)::int as sum from payment`
  console.log(`Semeado: Nohora Ramirez Beauty Studio — 2 casas, 10 serviços, 6 pessoas, ${CLIENTS.length} clientes.`)
  console.log(`${apptCount} marcações, ${(revenue / 100).toFixed(2)} € de faturação histórica.`)
  console.log('')
  console.log('Entrar em /entrar com a palavra-passe demo1234:')
  console.log('  Dona (Nohora Ramirez) ........ +351911000010')
  console.log('  Gerente (Isabel Rocha) ....... +351911000011  (Chiado)')
  console.log('  Profissional (Marta Ferreira)  +351911000012  (Chiado)')
  console.log('  Profissional (Beatriz Alves)   +351911000013  (Chiado)')
  console.log('  Profissional (Carla Mendes)    +351911000014  (Cascais)')
  console.log('  Profissional (Sofia Teles)     +351911000015  (Cascais)')
} catch (error) {
  console.error('Falhou:', error?.message ?? error)
  if (error?.detail) console.error('detalhe:', error.detail)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
