/**
 * O QUE HÁ PARA SUBMETER NA META, IMPRESSO PARA SE COLAR.
 *
 * Os modelos da Meta têm de ser aprovados antes de se poder enviar
 * seja o que for, e submetem-se à mão no WhatsApp Manager. O que este
 * guião faz é tirar dessa tarefa a única parte perigosa: transcrever.
 *
 * O texto que sai daqui é EXACTAMENTE o texto que o sistema vai enviar
 * — mesmos acentos, mesmas mudanças de linha, mesmos asteriscos. A Meta
 * compara o que foi aprovado com o que chega, e um espaço a mais dá
 * erro 132005 na cara da cliente. Copiar daqui e colar lá é a diferença
 * entre isso acontecer e não acontecer.
 *
 *   node scripts/wa-modelos.mjs           os modelos da casa
 *   node scripts/_prod.mjs wa-modelos     os que estão na Supabase
 *
 * Não envia nada, não escreve nada. Só lê e imprime.
 */
import { ligar } from './_ligar.mjs'

/*
 * Os modelos de origem vivem em `lib/whatsapp.ts`, que é TypeScript e
 * não se importa daqui. Estão copiados abaixo, e essa cópia é uma
 * dívida assumida — mas é uma dívida com rede: o guião compara o que
 * tem com o que está na base e AVISA se divergirem, em vez de imprimir
 * calado um texto que já não é o que se envia.
 *
 * A alternativa era este guião só funcionar contra a base, e então não
 * servia para nada antes de a casa reescrever o primeiro modelo.
 */
const linhas = (...partes) => partes.join('\n')

const ORIGEM = {
  confirm: {
    pt: linhas(
      'Olá {cliente}, a sua marcação no {loja} ficou registada.',
      '',
      '*{dia}, às {hora}*',
      'Para: {servicos}',
      '',
      'Até já!',
    ),
    en: linhas(
      'Hello {cliente}, your appointment at {loja} is booked.',
      '',
      '*{dia}, at {hora}*',
      'For: {servicos}',
      '',
      'See you soon!',
    ),
    es: linhas(
      '¡Hola {cliente}! Su cita en {loja} ha quedado reservada.',
      '',
      '*{dia}, a las {hora}*',
      'Para: {servicos}',
      '',
      '¡Hasta pronto!',
    ),
  },
  reminder_eve: {
    pt: linhas(
      'Olá {cliente}, é já amanhã.',
      '',
      '*{dia}, às {hora}*',
      'No {loja}',
      '',
      'Se precisar de mudar, é só dizer.',
    ),
    en: linhas(
      'Hello {cliente}, it is tomorrow.',
      '',
      '*{dia}, at {hora}*',
      'At {loja}',
      '',
      'Just tell us if you need to change it.',
    ),
    es: linhas(
      '¡Hola {cliente}! Es mañana.',
      '',
      '*{dia}, a las {hora}*',
      'En {loja}',
      '',
      'Si necesita cambiarla, díganos.',
    ),
  },
}

/** As que se automatizam. As outras três ficam à mão, por decisão. */
const ROTINAS = ['confirm', 'reminder_eve']
const LINGUAS = ['pt', 'en', 'es']
const META_LINGUA = { pt: 'pt_PT', en: 'en_US', es: 'es_ES' }
const MARCADORES = ['cliente', 'loja', 'dia', 'hora', 'servicos']

/** A mesma leitura do `lib/whatsapp/template.ts`. Se mudar lá, muda aqui. */
function ordem(corpo) {
  const vistos = []
  for (const m of corpo.matchAll(/\{(\w+)\}/g)) {
    const nome = m[1]
    if (!MARCADORES.includes(nome)) continue
    if (!vistos.includes(nome)) vistos.push(nome)
  }
  return vistos
}

/**
 * As duas recusas que a Meta faz e que se descobrem tarde. É a mesma
 * regra do `lintMetaBody` — se mudar lá, muda aqui.
 */
function problemas(metaCorpo) {
  const b = metaCorpo.trim()
  const pr = []
  if (/^\{\{\d+\}\}/.test(b)) pr.push('começa num marcador')
  if (/\{\{\d+\}\}$/.test(b)) pr.push('acaba num marcador')
  if (/\{\{\d+\}\}[^\p{L}\p{N}]*\{\{\d+\}\}/u.test(b)) {
    pr.push('dois marcadores seguidos sem texto pelo meio')
  }
  return pr
}

function paraMeta(corpo) {
  const pos = ordem(corpo)
  return corpo.replace(/\{(\w+)\}/g, (todo, nome) => {
    const i = pos.indexOf(nome)
    return i === -1 ? todo : `{{${i + 1}}}`
  })
}

// ---- o que a casa tem hoje --------------------------------------------
const sql = ligar({ idle_timeout: 5 })
let daBase = new Map()

try {
  const linhasBase = await sql`
    select routine, language, body from message_template
  `
  daBase = new Map(linhasBase.map((r) => [`${r.routine}:${r.language}`, r.body]))
} catch (erro) {
  console.error(`\n  Não consegui ler a base: ${erro?.message ?? erro}`)
  console.error('  Imprimo os modelos de origem.\n')
} finally {
  await sql.end({ timeout: 5 }).catch(() => {})
}

// ---- imprime -----------------------------------------------------------
console.log('')
console.log('  ═══════════════════════════════════════════════════════════')
console.log('  MODELOS A SUBMETER NO WHATSAPP MANAGER')
console.log('  ═══════════════════════════════════════════════════════════')
console.log('')
console.log('  Categoria:  Utility   (NÃO Marketing — é um terço do preço')
console.log('                         e não precisa de opt-in de marketing)')
console.log('')
console.log('  São DOIS modelos, cada um com TRÊS traduções por baixo.')
console.log('  Na Meta isso é um nome só com três línguas, e não seis')
console.log('  modelos separados.')
console.log('')

let divergencias = 0

for (const rotina of ROTINAS) {
  console.log('')
  console.log(`  ─── nome do modelo:  ${rotina}`)
  console.log('')

  for (const lingua of LINGUAS) {
    const chave = `${rotina}:${lingua}`
    const origem = ORIGEM[rotina][lingua]
    const base = daBase.get(chave)
    const corpo = base ?? origem

    if (base && base !== origem) {
      divergencias++
    }

    console.log(`      língua:  ${META_LINGUA[lingua]}${base ? '   (reescrito pela casa)' : ''}`)
    console.log('')
    for (const linha of paraMeta(corpo).split('\n')) {
      console.log(`      │ ${linha}`)
    }
    const males = problemas(paraMeta(corpo))
    if (males.length) {
      console.log(`      *** A META VAI RECUSAR: ${males.join('; ')}`)
      console.log('')
    }

    console.log('')
    const pos = ordem(corpo)
    if (pos.length) {
      console.log('      exemplos para a Meta pedir:')
      const exemplos = {
        cliente: 'Maria',
        loja: 'Valongo',
        dia: 'sábado, 13 de setembro',
        hora: '10:30',
        servicos: 'Corte + Coloração',
      }
      pos.forEach((nome, i) => {
        console.log(`        {{${i + 1}}}  ${exemplos[nome]}      (${nome})`)
      })
    } else {
      console.log('      (sem parâmetros)')
    }
    console.log('')
  }
}

console.log('  ═══════════════════════════════════════════════════════════')
console.log('')
if (divergencias > 0) {
  console.log(`  ATENÇÃO: ${divergencias} modelo(s) foram reescritos na base e`)
  console.log('  o que está impresso acima é o da BASE — que é o que se envia.')
  console.log('')
}
console.log('  Depois de aprovados, mais nada é preciso do lado do código:')
console.log('  o nome do modelo é o nome da rotina, e a ordem dos {{n}} sai')
console.log('  do próprio texto. Ninguém tem de escrever a ordem à mão.')
console.log('')
