import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

/**
 * O QUE A META RESPONDE.
 *
 * Depois de uma mensagem sair, a conversa continua sozinha: a Meta
 * avisa quando ela chegou ao telemóvel, quando foi lida, e quando não
 * saiu de todo. Isto é a porta por onde esses avisos entram.
 *
 * É A ÚNICA PORTA DESTE SISTEMA ABERTA À INTERNET SEM SESSÃO. Todo o
 * resto do balcão está atrás de um `requireActor`; isto não pode estar,
 * porque quem bate à porta é um servidor da Meta que não tem conta
 * nesta casa. O que faz as vezes da sessão é a assinatura — e é por
 * isso que ela não é opcional nem se verifica «quando dá jeito».
 */

export const dynamic = 'force-dynamic'

/**
 * A VERIFICAÇÃO INICIAL.
 *
 * Quando se regista o endereço no painel da Meta, ela bate aqui uma vez
 * com um desafio e um código combinado. Devolver o desafio em texto
 * simples é o que prova que a porta é nossa.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const esperado = process.env.WHATSAPP_VERIFY_TOKEN
  if (!esperado) return new NextResponse('não configurado', { status: 503 })

  if (mode === 'subscribe' && token && seguro(token, esperado)) {
    return new NextResponse(challenge ?? '', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
  }

  return new NextResponse('não', { status: 403 })
}

/**
 * OS ESTADOS.
 *
 * A Meta manda-os em lotes e espera um 200 depressa. Se demorarmos ou
 * respondermos mal, ela repete o mesmo lote — e repete durante dias,
 * com espaçamento crescente. Por isso responde-se 200 a tudo o que
 * esteja assinado, mesmo ao que não se percebe: um lote que não se
 * entende não melhora por ser reenviado cem vezes.
 *
 * O 200 diz «recebi», e não «concordo».
 */
export async function POST(request: Request) {
  const segredo = process.env.WHATSAPP_APP_SECRET
  if (!segredo) return new NextResponse('não configurado', { status: 503 })

  /*
   * O CORPO LÊ-SE UMA VEZ SÓ, E EM TEXTO CRU.
   *
   * A assinatura é feita sobre os bytes exactos que a Meta enviou. Ler
   * como JSON e voltar a serializar dá um texto diferente — outra
   * ordem de chaves, outros espaços — e a assinatura deixa de bater
   * certo. É o engano clássico desta verificação.
   */
  const cru = await request.text()

  if (!assinaturaValida(cru, request.headers.get('x-hub-signature-256'), segredo)) {
    return new NextResponse('assinatura inválida', { status: 401 })
  }

  let corpo: MetaWebhook
  try {
    corpo = JSON.parse(cru) as MetaWebhook
  } catch {
    return NextResponse.json({ ok: true })
  }

  for (const entry of corpo.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const estado of change.value?.statuses ?? []) {
        await registar(estado)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

/**
 * ESCREVE O QUE A META DISSE — mas só se for novidade.
 *
 * OS ESTADOS CHEGAM FORA DE ORDEM, e isto é a parte que se descobre
 * tarde. A rede não garante ordem nenhuma: o «lida» pode entrar antes
 * do «entregue», e a Meta reenvia lotes antigos quando não recebeu o
 * nosso 200 a tempo. Escrever sempre o que chega fazia uma mensagem
 * lida voltar a «entregue» sozinha, horas depois.
 *
 * Por isso compara-se o PESO dos estados e só se anda para a frente. É
 * a mesma ideia de um contador que não recua.
 */
async function registar(estado: MetaStatus): Promise<void> {
  const wamid = estado.id
  const novo = traduzir(estado.status)
  if (!wamid || !novo) return

  const quando = estado.timestamp
    ? new Date(Number(estado.timestamp) * 1000)
    : new Date()

  const erro =
    estado.errors?.[0]?.error_data?.details ??
    estado.errors?.[0]?.title ??
    null

  await sql`
    update notification_log
       set delivery_state = ${novo},
           delivered_at = case
             when ${novo} = 'delivered' then ${quando}
             else delivered_at
           end,
           read_at = case
             when ${novo} = 'read' then ${quando}
             else read_at
           end,
           delivery_error = case
             when ${novo} = 'failed' then ${erro}
             else delivery_error
           end
     where provider_id = ${wamid}
       and ${PESO[novo]} > coalesce(
             case delivery_state
               when 'queued'    then ${PESO.queued}
               when 'sent'      then ${PESO.sent}
               when 'delivered' then ${PESO.delivered}
               when 'read'      then ${PESO.read}
               when 'failed'    then ${PESO.failed}
             end, 0)
  `
}

/**
 * A ORDEM DOS ESTADOS, EM NÚMEROS.
 *
 * O `failed` leva o peso mais alto de propósito: uma mensagem que a
 * Meta declara falhada é o fim da linha, e nada que chegue depois deve
 * apagar essa informação. É o estado que alguém tem de ver.
 */
const PESO = {
  queued: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 5,
} as const

type Estado = keyof typeof PESO

function traduzir(status: string | undefined): Estado | null {
  switch (status) {
    case 'sent':
      return 'sent'
    case 'delivered':
      return 'delivered'
    case 'read':
      return 'read'
    case 'failed':
      return 'failed'
    /*
     * A Meta manda também `deleted` (a cliente apagou a mensagem para
     * todos). Não é um estado de entrega — a mensagem chegou e foi
     * lida — e sobrescrevê-lo perdia essa informação.
     */
    default:
      return null
  }
}

/**
 * A ASSINATURA.
 *
 * HMAC-SHA256 do corpo cru com o segredo da aplicação. Sem isto,
 * qualquer pessoa que descubra o endereço pode declarar mensagens
 * entregues, lidas, ou falhadas — e uma falhada devolve a marcação à
 * fila do balcão. Uma porta aberta aqui é uma forma de mentir ao
 * balcão sobre o que a cliente recebeu.
 */
function assinaturaValida(
  cru: string,
  cabecalho: string | null,
  segredo: string,
): boolean {
  if (!cabecalho?.startsWith('sha256=')) return false
  const trazida = cabecalho.slice('sha256='.length)
  const nossa = createHmac('sha256', segredo).update(cru, 'utf8').digest('hex')
  return seguro(trazida, nossa)
}

/** Comparação em tempo constante — ver a mesma no relógio. */
function seguro(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

type MetaStatus = {
  id?: string
  status?: string
  timestamp?: string
  errors?: { title?: string; error_data?: { details?: string } }[]
}

type MetaWebhook = {
  entry?: {
    changes?: { value?: { statuses?: MetaStatus[] } }[]
  }[]
}
