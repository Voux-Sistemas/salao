/**
 * APAGAR UMA FICHA DA EQUIPA, E SÓ ESSA.
 *
 * O `apagar-cliente` faz isto do lado de quem é atendido. Este faz do
 * lado de quem atende, e a diferença importa: uma ficha de equipa pode
 * ter meses de trabalho pendurados nela — marcações que ela fez, caixas
 * que abriu, comissões que ganhou. Nada disso se apaga por causa de uma
 * arrumação.
 *
 * Por isso a regra é simples e não se negoceia: só sai quem não deixou
 * rasto. Se houver uma única linha de histórico, o guião recusa e diz
 * qual — nesse caso o caminho é desactivar (`is_active = false`), que é
 * o que a aplicação já faz, e que guarda o nome para quem já foi
 * atendido continuar a saber por que mãos passou.
 *
 * O que se apaga é só configuração: a loja onde atendia, as habilidades,
 * a escala, o papel e a sessão aberta. Isso volta a escrever-se numa
 * tarde; um histórico não volta nunca.
 *
 *   node scripts/apagar-equipa.mjs "Profissional 1"
 *   node scripts/_prod.mjs apagar-equipa "Profissional 1" --a-serio
 */
import { ligar, loadEnv, hostOf, isLocal } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const nomes = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const aSerio = process.argv.includes('--a-serio')

if (!nomes.length) {
  console.error('Diga o nome da ficha: apagar-equipa "Profissional 1"')
  process.exit(1)
}

const host = hostOf(url)
const sql = ligar()

/**
 * As tabelas que guardam o que a pessoa fez. Encontrar uma linha em
 * qualquer uma delas trava a eliminação — não há aqui nenhum caso em
 * que valha a pena perder isto.
 */
const HISTORICO = [
  ['appointment', 'created_by_staff_id'],
  ['appointment', 'closed_by_staff_id'],
  ['appointment', 'discount_by_staff_id'],
  ['appointment_item', 'staff_id'],
  ['appointment_status_event', 'by_staff_id'],
  ['cash_movement', 'by_staff_id'],
  ['cash_session', 'opened_by_staff_id'],
  ['cash_session', 'closed_by_staff_id'],
  ['client', 'preferred_staff_id'],
  ['client_note', 'author_id'],
  ['commission_entry', 'staff_id'],
  ['commission_payout', 'staff_id'],
  ['commission_payout', 'paid_by_staff_id'],
  ['commission_rule', 'staff_id'],
  ['notification_log', 'sent_by_staff_id'],
  ['payment', 'received_by_staff_id'],
  ['price_override', 'staff_id'],
  ['staff_absence', 'created_by'],
]

/** Configuração: sai com a ficha, e reescreve-se sem custo. */
const CONFIG = [
  ['staff_absence', 'staff_id'],
  ['staff_block', 'staff_id'],
  ['staff_schedule', 'staff_id'],
  ['staff_skill', 'staff_id'],
  ['staff_role', 'staff_id'],
  ['staff_unit', 'staff_id'],
]

try {
  const fichas = await sql`
    select id, name, public_alias, is_active, login,
           to_char(created_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI') as criada
      from staff where name = any(${nomes})`

  const emFalta = nomes.filter((n) => !fichas.some((f) => f.name === n))
  if (emFalta.length) {
    console.log(`Não há ficha nenhuma com ${emFalta.join(', ')} em ${host}.`)
  }
  if (!fichas.length) process.exit(0)

  console.log(`\n  ${host}\n`)

  const bloqueadas = []
  const livres = []

  for (const f of fichas) {
    const presas = []
    for (const [tabela, coluna] of HISTORICO) {
      const [{ n }] = await sql.unsafe(
        `select count(*)::int as n from "${tabela}" where "${coluna}" = $1::uuid`,
        [f.id],
      )
      if (n > 0) presas.push(`${tabela}.${coluna}: ${n}`)
    }

    const config = []
    const [{ n: sessoes }] = await sql`
      select count(*)::int as n from session
       where subject_type = 'staff' and subject_id = ${f.id}`
    if (sessoes > 0) config.push(`session: ${sessoes}`)
    for (const [tabela, coluna] of CONFIG) {
      const [{ n }] = await sql.unsafe(
        `select count(*)::int as n from "${tabela}" where "${coluna}" = $1::uuid`,
        [f.id],
      )
      if (n > 0) config.push(`${tabela}: ${n}`)
    }

    const etiqueta = f.public_alias ? `${f.name} (vista como ${f.public_alias})` : f.name
    console.log(`  ${etiqueta}`)
    console.log(`    criada em ${f.criada}${f.is_active ? '' : ', já desactivada'}${f.login ? `, entra como «${f.login}»` : ''}`)
    console.log(`    leva atrás: ${config.length ? config.join(', ') : 'nada'}`)

    if (presas.length) {
      console.log(`    NÃO SE APAGA — tem histórico: ${presas.join(', ')}`)
      bloqueadas.push(f)
    } else {
      livres.push(f)
    }
    console.log()
  }

  if (bloqueadas.length) {
    console.log(`  ${bloqueadas.length} ficha(s) com trabalho feito ficam onde estão.`)
    console.log('  Para essas, desactive na aplicação: o nome guarda-se e sai da agenda.\n')
  }

  if (!livres.length) {
    console.log('  Não há nada a apagar.')
    process.exit(0)
  }

  if (!aSerio && !isLocal(url)) {
    console.log(`  Isto é ${host}, não é a sua máquina.`)
    console.log('  Nada foi apagado. Repita com --a-serio se é mesmo isto que quer.')
    process.exit(0)
  }

  // Uma transação por ficha: se uma rebentar, as outras já feitas ficam.
  for (const f of livres) {
    await sql.begin(async (tx) => {
      // A sessão não tem chave para `staff`: guarda o tipo e o id em
      // colunas soltas, e por isso tem de sair à mão.
      await tx`delete from session where subject_type = 'staff' and subject_id = ${f.id}`
      for (const [tabela, coluna] of CONFIG) {
        await tx.unsafe(`delete from "${tabela}" where "${coluna}" = $1::uuid`, [f.id])
      }
      await tx`delete from staff where id = ${f.id}`
    })
    console.log(`  apagada  ${f.name}`)
  }

  console.log(`\n  ${livres.length} ficha(s) fora de ${host}.`)
} finally {
  await sql.end()
}
