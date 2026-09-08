/**
 * O QUE O SISTEMA MANDOU, E O QUE A META FEZ COM ISSO.
 *
 * A fila do balcão mostra o que FALTA fazer. Isto mostra o que JÁ foi
 * feito — que é a pergunta que se faz quando alguma coisa parece
 * errada: «ela recebeu?», «saiu a que horas?», «porque é que aquela
 * falhou?».
 *
 *   node scripts/wa-estado.mjs           os últimos 7 dias
 *   node scripts/wa-estado.mjs 30        os últimos 30
 *   node scripts/_prod.mjs wa-estado     contra a Supabase
 *
 * Só lê. Não envia nada, não escreve nada.
 */
import { ligar } from './_ligar.mjs'

const dias = Number(process.argv[2] ?? 7)
const sql = ligar({ idle_timeout: 5 })

try {
  const linhas = await sql`
    select n.routine,
           n.sent_at,
           n.delivery_state,
           n.delivery_error,
           n.provider_id,
           n.delivered_at,
           n.read_at,
           n.sent_by_staff_id is null as automatico,
           c.name as cliente,
           u.name as loja
      from notification_log n
      join client c on c.id = n.client_id
      join unit u on u.id = n.unit_id
     where n.sent_at > now() - (${dias} || ' days')::interval
     order by n.sent_at desc
     limit 200
  `

  console.log('')
  if (linhas.length === 0) {
    console.log(`  Nada nos últimos ${dias} dias.\n`)
    process.exit(0)
  }

  // ---- o resumo, que é o que responde à pergunta mais frequente ----
  const porEstado = {}
  let automaticos = 0
  for (const l of linhas) {
    const e = l.delivery_state ?? 'à mão'
    porEstado[e] = (porEstado[e] ?? 0) + 1
    if (l.automatico) automaticos++
  }

  console.log(`  Últimos ${dias} dias — ${linhas.length} avisos`)
  console.log(`  ${automaticos} pelo sistema, ${linhas.length - automaticos} por uma pessoa\n`)
  for (const [estado, quantos] of Object.entries(porEstado).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(quantos).padStart(4)}  ${estado}`)
  }
  console.log('')

  // ---- as falhadas primeiro: são as únicas que pedem acção ---------
  const falhadas = linhas.filter((l) => l.delivery_state === 'failed')
  if (falhadas.length) {
    console.log(`  ─── ${falhadas.length} FALHARAM ───\n`)
    for (const l of falhadas) {
      console.log(`    ${quando(l.sent_at)}  ${l.cliente} (${l.loja})`)
      console.log(`      ${l.routine} — ${l.delivery_error ?? 'sem detalhe'}`)
    }
    console.log('')
  }

  // ---- e a lista, para quem quer ver a sequência --------------------
  console.log('  ─── por ordem ───\n')
  for (const l of linhas.slice(0, 40)) {
    const marca = l.automatico ? '⚙' : '·'
    const estado = l.delivery_state ?? 'à mão'
    console.log(
      `    ${marca} ${quando(l.sent_at)}  ${estado.padEnd(10)} ${l.routine.padEnd(13)} ${l.cliente}`,
    )
  }
  if (linhas.length > 40) console.log(`\n    (e mais ${linhas.length - 40})`)
  console.log('')
  console.log('  ⚙ = enviado pelo sistema   · = alguém carregou no botão\n')
} catch (erro) {
  console.error(`\n  Falhou: ${erro?.message ?? erro}\n`)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 }).catch(() => {})
}

function quando(d) {
  const z = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(z.getDate())}/${p(z.getMonth() + 1)} ${p(z.getHours())}:${p(z.getMinutes())}`
}
