/**
 * APAGAR UMA FICHA, E SÓ ESSA.
 *
 * O `limpar` varre o movimento todo — serve no dia em que a casa começa
 * a usar isto a sério, e nunca mais. Depois disso, o que aparece são
 * fichas soltas: a marcação de teste que ficou de um ensaio, a ficha
 * criada duas vezes com o mesmo telefone. Para essas é este.
 *
 * Diz primeiro o que vai levar, e só depois leva. Fora de casa exige a
 * intenção escrita, como o `limpar` — porque o telefone errado apaga
 * uma cliente verdadeira e o histórico dela não volta.
 *
 * A ordem é a das chaves: as marcações primeiro (a ficha está presa a
 * elas por `restrict`), depois o que não tem chave nenhuma — o código
 * por usar, que só conhece o telefone, e a sessão, que só guarda o id.
 * O resto — itens, blocos, pagamentos, comissões, notificações, notas —
 * cai por cascata e não precisa de ser escrito aqui.
 *
 * O código por usar é o único que se identifica pelo telefone e não pelo
 * id, e há telefones repartidos entre uma ficha e alguém da equipa. Nesse
 * caso fica onde está: apagá-lo tirava a entrada a quem não se mandou
 * apagar.
 *
 *   node scripts/apagar-cliente.mjs +351934189475
 *   node scripts/_prod.mjs apagar-cliente +351934189475 --a-serio
 */
import { ligar, loadEnv, hostOf, isLocal } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const telefone = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!telefone) {
  console.error('Diga o telefone da ficha: apagar-cliente +351900000000')
  process.exit(1)
}

const host = hostOf(url)
const sql = ligar()

try {
  const [cliente] = await sql`
    select id, name, phone, tags,
           to_char(created_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI') as criada
      from client where phone = ${telefone}
  `
  if (!cliente) {
    console.log(`Não há ficha nenhuma com ${telefone} em ${host}.`)
    process.exit(0)
  }

  // O que vai levar atrás, dito por extenso antes de ser levado.
  const marcacoes = await sql`
    select to_char(a.starts_at at time zone u.timezone, 'DD/MM/YYYY HH24:MI') as quando,
           a.status, u.name as loja,
           coalesce(sum(ai.price_cents), 0)::int as cents
      from appointment a
      join unit u on u.id = a.unit_id
      left join appointment_item ai on ai.appointment_id = a.id
     where a.client_id = ${cliente.id}
     group by a.id, u.name, u.timezone
     order by a.starts_at
  `
  const [contas] = await sql`
    select
      (select count(*)::int from payment p
         join appointment a on a.id = p.appointment_id
        where a.client_id = ${cliente.id}) as pagamentos,
      (select count(*)::int from notification_log
        where client_id = ${cliente.id}) as notificacoes,
      (select count(*)::int from client_note
        where client_id = ${cliente.id}) as notas,
      (select count(*)::int from session
        where subject_type = 'client' and subject_id = ${cliente.id}) as sessoes,
      (select count(*)::int from otp_code where target = ${telefone}) as codigos,
      (select count(*)::int from staff where phone = ${telefone}) as equipa
  `

  console.log(`\n  ${cliente.name}  ${cliente.phone}  (criada ${cliente.criada})`)
  if (cliente.tags?.length) console.log(`  etiquetas: ${cliente.tags.join(', ')}`)
  console.log(`  ${'─'.repeat(60)}`)
  for (const m of marcacoes) {
    console.log(
      `  ${m.quando}  ${m.loja.padEnd(9)} ${m.status.padEnd(19)} ` +
        `${(m.cents / 100).toFixed(2).padStart(8)} €`,
    )
  }
  if (marcacoes.length === 0) console.log('  (sem marcações)')
  console.log(
    `  ${'─'.repeat(60)}\n` +
      `  pagamentos ${contas.pagamentos} · notificações ${contas.notificacoes} · ` +
      `notas ${contas.notas} · sessões ${contas.sessoes} · códigos ${contas.codigos}\n`,
  )

  if (!isLocal(url) && !process.argv.includes('--a-serio')) {
    console.error(`Isto apaga esta ficha e o histórico dela em ${host}.`)
    console.error('Se é mesmo o que quer, repita com --a-serio.')
    process.exit(1)
  }

  // Tudo ou nada: a meio disto ficava uma marcação sem ficha.
  await sql.begin(async (tx) => {
    await tx`delete from appointment where client_id = ${cliente.id}`
    if (contas.equipa === 0) {
      await tx`delete from otp_code where target = ${telefone}`
    }
    await tx`delete from session
              where subject_type = 'client' and subject_id = ${cliente.id}`
    await tx`delete from client where id = ${cliente.id}`
  })

  console.log(`  Apagada: ${cliente.name} (${cliente.id})\n`)
} finally {
  await sql.end()
}
