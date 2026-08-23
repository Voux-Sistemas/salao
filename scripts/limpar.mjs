/**
 * APAGAR O MOVIMENTO DE TESTE, DEIXANDO O SALÃO DE PÉ.
 *
 * Corre-se uma vez, no dia em que a casa começa a usar isto a sério. O
 * que desaparece é o que foi inventado para as telas terem carne: as
 * clientes, as marcações, as comandas, os pagamentos, o caixa e as
 * comissões. O que fica é tudo o que custou a escrever — as lojas e as
 * fotografias, o preçário, a equipa, as escalas, as senhas já dadas e a
 * regra de comissão.
 *
 * Não é o `seed-real`: esse começa por um `truncate cascade` e devolve
 * o salão ao estado de fábrica, senhas incluídas. Este só varre por
 * cima.
 *
 * Depois de correr, a agenda de ontem está vazia — e passa a ser
 * verdade que o que lá aparecer aconteceu mesmo.
 *
 *   node scripts/limpar.mjs                    (base local)
 *   node scripts/_prod.mjs limpar --a-serio    (Supabase)
 */
import { ligar, loadEnv, hostOf, isLocal } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const host = hostOf(url)
const emCasa = isLocal(url)

// Fora de casa isto apaga histórico verdadeiro se for corrido tarde
// demais. Exige-se a intenção escrita, como no seed.
if (!emCasa && !process.argv.includes('--a-serio')) {
  console.error(`Isto apaga TODAS as clientes e marcações em ${host}.`)
  console.error('Se é mesmo o que quer, repita com --a-serio.')
  process.exit(1)
}

const sql = ligar()

/*
 * A ordem é a das chaves estrangeiras, das folhas para a raiz. Podia
 * ser um `truncate ... cascade` de uma penada, mas escrito assim lê-se
 * o que se está a apagar — e o que não se está.
 */
const VARRER = [
  'commission_entry',
  'commission_payout',
  'cash_movement',
  'payment',
  'cash_session',
  'appointment_status_event',
  'appointment_item',
  'resource_block',
  'staff_block',
  'appointment',
  'notification_log',
  'client_note',
  'otp_code',
  'client',
]

try {
  console.log(`> limpar movimento em ${host}\n`)

  const antes = []
  for (const tabela of VARRER) {
    const [row] = await sql.unsafe(`select count(*)::int as n from ${tabela}`)
    if (row.n > 0) antes.push([tabela, row.n])
  }

  if (antes.length === 0) {
    console.log('  Já estava limpo. Nada a fazer.')
  } else {
    // Tudo ou nada: a meio disto a base ficaria com comandas sem
    // marcação e pagamentos sem comanda, que é pior do que não começar.
    await sql.begin(async (tx) => {
      for (const tabela of VARRER) {
        await tx.unsafe(`delete from ${tabela}`)
      }
      // A sessão não tem chave estrangeira para a cliente (guarda só o
      // id), por isso não cai sozinha — e uma sessão aberta para uma
      // cliente que já não existe é um erro à espera de acontecer.
      // As da equipa ficam: ninguém quer ser posto fora a meio do dia.
      await tx`delete from session where subject_type = 'client'`
    })
    for (const [tabela, n] of antes) {
      console.log(`  ${tabela.padEnd(26)} ${String(n).padStart(6)} apagado(s)`)
    }
  }

  // O que fica, para se ver de relance que o salão continua inteiro.
  console.log('')
  for (const tabela of ['org', 'unit', 'unit_photo', 'service', 'staff', 'staff_schedule']) {
    const [row] = await sql.unsafe(`select count(*)::int as n from ${tabela}`)
    console.log(`  ${tabela.padEnd(26)} ${String(row.n).padStart(6)} de pé`)
  }
  console.log('')
} finally {
  await sql.end()
}
