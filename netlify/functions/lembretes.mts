import type { Config } from '@netlify/functions'

/**
 * O RELÓGIO — a única peça deste sistema que age sem ninguém lhe pedir.
 *
 * Corre de hora a hora, em UTC, e não decide nada: bate à porta do
 * `/api/whatsapp/lembretes` com o segredo e é lá dentro que se pergunta
 * se já são as sete DE ALGUMA LOJA. A decisão vive ao pé da base de
 * dados, onde estão os fusos.
 *
 * DE HORA A HORA E NÃO ÀS 19:00 EM PONTO. A casa tem lojas e pode vir a
 * ter mais, em fusos diferentes; e as 19:00 de Lisboa não são a mesma
 * hora UTC no Verão e no Inverno. Uma expressão cron fixa acertava
 * durante metade do ano. Correr sempre e perguntar de cada vez custa
 * vinte e três pedidos por dia que respondem «ainda não» num
 * milissegundo — e nunca falha uma mudança de hora.
 */

export default async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.CRON_SECRET

  if (!base || !secret) {
    // Sem isto não há nada a fazer, e não é um erro: é um sistema que
    // ainda não foi ligado. Ver a fase 1 do WHATSAPP.md.
    console.log('[lembretes] sem URL ou CRON_SECRET; nada a fazer')
    return
  }

  const resposta = await fetch(`${base}/api/whatsapp/lembretes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  })

  const corpo = await resposta.text()
  console.log(`[lembretes] ${resposta.status} ${corpo}`)
}

export const config: Config = {
  schedule: '@hourly',
}
