/**
 * MANDA UMA MENSAGEM, E MAIS NADA.
 *
 * É a prova de que a conta da Meta está bem ligada — e é a única forma
 * de a fazer sem que uma única linha do sistema dependa disso. Não toca
 * na base de dados, não sabe o que é uma marcação, não regista nada.
 *
 *   node scripts/wa-teste.mjs +351912345678 nome_do_modelo pt_PT Maria sábado 10:30
 *
 * O primeiro argumento é o número. O segundo é o nome do modelo tal
 * como foi aprovado na Meta. O terceiro é a língua ('pt_PT', 'en_US',
 * 'es_ES'). O que vier depois são os valores dos {{1}}, {{2}}, {{3}},
 * POR ORDEM.
 *
 * Sem modelo, faz só o diagnóstico: diz se as variáveis estão lá e se o
 * token abre a porta. É por aí que se começa.
 *
 *   node scripts/wa-teste.mjs
 */
import { loadEnv } from './_ligar.mjs'

loadEnv()

const GRAPH = 'https://graph.facebook.com/v26.0'

const id = process.env.WHATSAPP_PHONE_NUMBER_ID
const token = process.env.WHATSAPP_ACCESS_TOKEN

const [numero, modelo, lingua = 'pt_PT', ...valores] = process.argv.slice(2)

console.log('')

// ---- as variáveis estão lá? ------------------------------------------
if (!id || !token) {
  console.log('  Falta configuração.\n')
  console.log(`  WHATSAPP_PHONE_NUMBER_ID   ${id ? 'está lá' : 'FALTA'}`)
  console.log(`  WHATSAPP_ACCESS_TOKEN      ${token ? 'está lá' : 'FALTA'}`)
  console.log('\n  Põe as duas no .env. Vê o .env.example.\n')
  process.exit(1)
}

console.log(`  Número de origem   ${id}`)
console.log(`  Token              ...${token.slice(-6)}\n`)

// ---- o token abre a porta? -------------------------------------------
// Uma leitura simples do próprio número. Se isto responde, a ligação
// está de pé — e não custa uma mensagem para saber.
const olhar = await fetch(
  `${GRAPH}/${id}?fields=display_phone_number,verified_name,quality_rating`,
  { headers: { Authorization: `Bearer ${token}` } },
).catch((erro) => ({ ok: false, erro }))

if (olhar.erro) {
  console.log(`  A rede falhou: ${olhar.erro.message}\n`)
  process.exit(1)
}

const conta = await olhar.json().catch(() => null)

if (!olhar.ok) {
  console.log('  A Meta recusou.\n')
  console.log(`  ${conta?.error?.message ?? `HTTP ${olhar.status}`}`)
  if (conta?.error?.code) console.log(`  código ${conta.error.code}`)
  console.log('')
  process.exit(1)
}

console.log(`  Ligado a           ${conta.display_phone_number ?? '?'}`)
console.log(`  Nome que aparece   ${conta.verified_name ?? '?'}`)
console.log(`  Qualidade          ${conta.quality_rating ?? '?'}\n`)

if (!modelo) {
  console.log('  A ligação está de pé. Para mandar uma mensagem:\n')
  console.log('    node scripts/wa-teste.mjs +351912345678 modelo pt_PT Maria sábado 10:30\n')
  process.exit(0)
}

if (!numero) {
  console.log('  Falta o número de destino.\n')
  process.exit(1)
}

// ---- manda ------------------------------------------------------------
const para = numero.replace(/\D/g, '')

console.log(`  A enviar «${modelo}» (${lingua}) para +${para}`)
if (valores.length) {
  valores.forEach((v, i) => console.log(`    {{${i + 1}}}  ${v}`))
}
console.log('')

const resposta = await fetch(`${GRAPH}/${id}/messages`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: para,
    type: 'template',
    template: {
      name: modelo,
      language: { code: lingua },
      ...(valores.length > 0
        ? {
            components: [
              {
                type: 'body',
                parameters: valores.map((text) => ({ type: 'text', text })),
              },
            ],
          }
        : {}),
    },
  }),
}).catch((erro) => ({ ok: false, erro }))

if (resposta.erro) {
  console.log(`  A rede falhou: ${resposta.erro.message}\n`)
  process.exit(1)
}

const corpo = await resposta.json().catch(() => null)

if (!resposta.ok) {
  const erro = corpo?.error
  console.log('  Não saiu.\n')
  console.log(`  ${erro?.error_data?.details ?? erro?.message ?? `HTTP ${resposta.status}`}`)
  if (erro?.code) console.log(`  código ${erro.code}`)

  // Os três enganos que se cometem sempre na primeira vez.
  if (erro?.code === 132001) {
    console.log('\n  Esse modelo não existe nessa língua, ou ainda não foi aprovado.')
    console.log('  Confere o nome e o código de língua no WhatsApp Manager.')
  }
  if (erro?.code === 132000) {
    console.log('\n  O número de valores não bate certo com o modelo.')
    console.log(`  Mandaste ${valores.length}. Conta os {{n}} do modelo aprovado.`)
  }
  if (erro?.code === 131026) {
    console.log('\n  Esse número não recebe: ou não tem WhatsApp, ou bloqueou-nos.')
  }
  console.log('')
  process.exit(1)
}

console.log('  Saiu.\n')
console.log(`  wamid   ${corpo?.messages?.[0]?.id ?? '?'}`)
console.log('\n  Vê o telemóvel.\n')
