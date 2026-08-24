/**
 * O MOVIMENTO, LINHA A LINHA.
 *
 * O `estado` diz quantos são; este diz quem são. É o que se lê antes de
 * apagar seja o que for: as clientes com o telefone e o dia em que
 * entraram, as marcações com a hora e quem as fez, e o dinheiro que
 * ficou pendurado em cada uma.
 *
 * Serve para separar o que foi inventado para as telas terem carne do
 * que aconteceu mesmo — porque a partir do dia em que a casa começa a
 * usar isto, as duas coisas passam a viver na mesma tabela.
 *
 * Só lê. Nunca escreve nada.
 *
 *   node scripts/inventario.mjs           (base local)
 *   node scripts/_prod.mjs inventario     (Supabase)
 */
import { ligar, loadEnv, hostOf } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const sql = ligar()
const titulo = (t) => console.log(`\n  ${t}\n  ${'─'.repeat(70)}`)

try {
  console.log(`\n  INVENTÁRIO — ${hostOf(url)}`)

  // ---- clientes ------------------------------------------------------
  const clientes = await sql`
    select c.id, c.name, c.phone, c.email, c.is_active,
           to_char(c.created_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') as criada,
           count(a.id)::int as marcacoes,
           max(a.starts_at) as ultima
      from client c
      left join appointment a on a.client_id = c.id
     group by c.id
     order by c.created_at
  `
  titulo(`CLIENTES (${clientes.length})`)
  for (const c of clientes) {
    console.log(
      `  ${c.id.slice(0, 8)}  ${c.name.padEnd(22).slice(0, 22)} ` +
        `${(c.phone ?? '').padEnd(16)} ${String(c.marcacoes).padStart(2)} marc.  ` +
        `criada ${c.criada}${c.is_active ? '' : '  [inactiva]'}`,
    )
  }

  // ---- marcações -----------------------------------------------------
  const marcacoes = await sql`
    select a.id, a.status, a.source,
           to_char(a.starts_at at time zone u.timezone, 'DD/MM/YYYY HH24:MI') as quando,
           to_char(a.created_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') as criada,
           u.name as loja, c.name as cliente,
           string_agg(distinct s.name, ' + ') as servicos,
           string_agg(distinct st.name, ', ') as equipa,
           sum(ai.price_cents)::int as cents,
           a.closed_at is not null as fechada
      from appointment a
      join unit u on u.id = a.unit_id
      join client c on c.id = a.client_id
      left join appointment_item ai on ai.appointment_id = a.id
      left join service s on s.id = ai.service_id
      left join staff st on st.id = ai.staff_id
     group by a.id, u.name, u.timezone, c.name
     order by a.starts_at
  `
  titulo(`MARCAÇÕES (${marcacoes.length})`)
  for (const m of marcacoes) {
    console.log(
      `  ${m.id.slice(0, 8)}  ${m.quando}  ${(m.cliente ?? '').padEnd(20).slice(0, 20)} ` +
        `${(m.loja ?? '').padEnd(9)} ${m.status.padEnd(12)} ${String(m.source ?? '').padEnd(8)} ` +
        `${((m.cents ?? 0) / 100).toFixed(2).padStart(7)} €  criada ${m.criada}`,
    )
    console.log(
      `            ${(m.servicos ?? '—').slice(0, 60)}  ·  ${m.equipa ?? '—'}`,
    )
  }

  // ---- dinheiro ------------------------------------------------------
  const pagamentos = await sql`
    select p.id, p.method, p.amount_cents,
           to_char(p.received_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') as quando,
           c.name as cliente
      from payment p
      left join appointment a on a.id = p.appointment_id
      left join client c on c.id = a.client_id
     order by p.received_at
  `
  titulo(`PAGAMENTOS (${pagamentos.length})`)
  for (const p of pagamentos) {
    console.log(
      `  ${p.id.slice(0, 8)}  ${p.quando}  ${(p.cliente ?? '—').padEnd(20).slice(0, 20)} ` +
        `${p.method.padEnd(7)} ${(p.amount_cents / 100).toFixed(2).padStart(8)} €`,
    )
  }

  const caixas = await sql`
    select cs.id, cs.status, cs.opening_cents, cs.counted_cents,
           to_char(cs.opened_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') as abriu,
           u.name as loja
      from cash_session cs join unit u on u.id = cs.unit_id
     order by cs.opened_at
  `
  const comissoes = await sql`
    select count(*)::int as n, coalesce(sum(amount_cents), 0)::int as cents,
           count(*) filter (where paid_at is null)::int as porPagar
      from commission_entry
  `
  titulo('RESTO DO MOVIMENTO')
  console.log(`  caixas               ${caixas.length}`)
  for (const cx of caixas) {
    console.log(
      `    ${cx.id.slice(0, 8)}  ${cx.loja.padEnd(9)} ${cx.status.padEnd(7)} abriu ${cx.abriu}`,
    )
  }
  console.log(
    `  comissões            ${comissoes[0].n} (${comissoes[0].porpagar} por pagar, ` +
      `${(comissoes[0].cents / 100).toFixed(2)} €)`,
  )
  for (const [rotulo, tabela] of [
    ['notificações', 'notification_log'],
    ['notas de cliente', 'client_note'],
    ['códigos por usar', 'otp_code'],
    ['bloqueios de equipa', 'staff_block'],
    ['fotografias na base', 'uploaded_image'],
  ]) {
    const [row] = await sql.unsafe(`select count(*)::int as n from ${tabela}`)
    console.log(`  ${rotulo.padEnd(20)} ${row.n}`)
  }

  // ---- sessões abertas ----------------------------------------------
  const sessoes = await sql`
    select s.id, s.subject_type, s.subject_id, s.expires_at < now() as expirada,
           to_char(s.created_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') as criada,
           to_char(s.expires_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY') as ate
      from session s
     order by s.created_at
  `
  titulo(`SESSÕES (${sessoes.length})`)
  for (const s of sessoes) {
    const dono =
      s.subject_type === 'client'
        ? (await sql`select name from client where id = ${s.subject_id}`)[0]?.name
        : (await sql`select name from staff where id = ${s.subject_id}`)[0]?.name
    console.log(
      `  ${s.id.slice(0, 8)}  ${s.subject_type.padEnd(8)} ${(dono ?? '—').padEnd(20).slice(0, 20)} ` +
        `criada ${s.criada}  até ${s.ate}${s.expirada ? '  [expirada]' : ''}`,
    )
  }

  // ---- equipa e catálogo, para se ver o que é de fachada -------------
  const equipa = await sql`
    select st.id, st.name, st.phone, st.is_active,
           st.password_hash is not null as tem_senha,
           coalesce(string_agg(distinct sr.role, '/'), '—') as papeis,
           count(distinct ss.service_id)::int as sabe,
           count(distinct sch.id)::int as escalas
      from staff st
      left join staff_role sr on sr.staff_id = st.id
      left join staff_skill ss on ss.staff_id = st.id
      left join staff_schedule sch on sch.staff_id = st.id
     group by st.id
     order by st.sort_order, st.name
  `
  titulo(`EQUIPA (${equipa.length})`)
  for (const e of equipa) {
    console.log(
      `  ${e.id.slice(0, 8)}  ${e.name.padEnd(20).slice(0, 20)} ${e.papeis.padEnd(13)} ` +
        `${(e.phone ?? '—').padEnd(16)} ${String(e.sabe).padStart(2)} serviços  ` +
        `${e.escalas} escala(s)  ${e.tem_senha ? 'com senha' : 'sem senha'}` +
        `${e.is_active ? '' : '  [inactiva]'}`,
    )
  }

  const servicos = await sql`
    select count(*)::int as n,
           count(*) filter (where image_url is not null)::int as comFoto,
           count(*) filter (where not is_active)::int as retirados
      from service
  `
  console.log(
    `\n  Serviços: ${servicos[0].n} (${servicos[0].comfoto} com fotografia, ` +
      `${servicos[0].retirados} retirados)\n`,
  )
} finally {
  await sql.end()
}
