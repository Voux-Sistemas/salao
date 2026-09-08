import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { loadQueue } from '@/lib/notices'
import type { Unit } from '@/lib/org'
import { minutesOfDay } from '@/lib/time'
import { isConfigured } from '@/lib/whatsapp/cloud'
import { avisar } from '@/lib/whatsapp/despachar'

/**
 * O RELÓGIO DA VÉSPERA.
 *
 * A Netlify chama isto de hora a hora, em UTC. Não é público: quem
 * chama tem de trazer o segredo, e sem ele isto responde 401 sem sequer
 * olhar para a base.
 *
 * O QUE ESTA FUNÇÃO NÃO FAZ: decidir quem precisa de lembrete. Essa
 * pergunta já tem uma resposta nesta casa — a fila de avisos — e é a
 * mesma que a pessoa vê no balcão. Duas respostas para a mesma pergunta
 * era o princípio de elas discordarem.
 */

export const dynamic = 'force-dynamic'

/*
 * O prazo da Netlify para uma função agendada é de dez segundos no
 * plano gratuito, mas uma execução destas pode ter de mandar dezenas de
 * mensagens. Declara-se o máximo do Next e trabalha-se dentro de um
 * orçamento próprio (ver `ORCAMENTO_MS`), porque ser interrompido a
 * meio é o único cenário mau: as linhas já gravadas ficam gravadas, e
 * quem não foi enviado apanha a hora seguinte.
 */
export const maxDuration = 60

/** Ao fim disto pára-se por vontade própria, e deixa-se o resto. */
const ORCAMENTO_MS = 45_000

/**
 * A loja inteira, e não só as cinco colunas de que esta função precisa:
 * o `loadQueue` recebe um `Unit` completo, e montar-lhe um objecto pela
 * metade era esperar que ele nunca viesse a ler mais nada.
 */
type Loja = Unit & { reminder_hour: number }

export async function POST(request: Request) {
  const negado = verificarSegredo(request)
  if (negado) return negado

  /*
   * Sem conta da Meta ligada não há nada a fazer, e é aqui que a
   * promessa da fase 1 se cumpre também para o relógio: um sistema por
   * configurar responde depressa e não toca na base.
   */
  if (!isConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'not_configured' })
  }

  const comeco = Date.now()
  const lojas = await sql<Loja[]>`
    select * from unit where is_active
  `

  const relatorio: Record<string, unknown>[] = []

  for (const loja of lojas) {
    /*
     * A PERGUNTA QUE FAZ ISTO FUNCIONAR: já são as sete DESTA LOJA?
     *
     * A função corre em UTC. Em Lisboa, no Verão, as 19:00 locais são
     * as 18:00 UTC; no Inverno são as 19:00 UTC. Uma função que
     * assumisse a hora do relógio onde corre mandava os lembretes uma
     * hora trocada durante metade do ano — e ninguém dava por isso,
     * porque a mensagem chegava na mesma, só que à hora errada.
     *
     * `minutesOfDay` lê a hora no fuso da loja, que é a mesma função
     * que a agenda usa para desenhar a grelha. Uma verdade só.
     */
    const horaLocal = Math.floor(minutesOfDay(new Date(), loja.timezone) / 60)
    if (horaLocal !== loja.reminder_hour) {
      relatorio.push({ loja: loja.slug, saltada: `são ${horaLocal}h lá` })
      continue
    }

    /*
     * A FILA, TAL COMO O BALCÃO A VÊ. Sem `staffId`: o relógio não é
     * ninguém, e vê a casa toda.
     *
     * É a mesma consulta que desenha a página de avisos. Se um dia a
     * regra do lembrete mudar, muda nos dois sítios ao mesmo tempo
     * porque só existe um sítio.
     */
    const fila = await loadQueue(loja, 'reminder_eve')

    let enviados = 0
    let falhados = 0
    let esgotou = false

    for (const linha of fila) {
      if (Date.now() - comeco > ORCAMENTO_MS) {
        esgotou = true
        break
      }

      /*
       * O `avisar` grava antes de enviar, e a gravação é a trava. Duas
       * execuções em simultâneo — a Netlify a repetir uma chamada, ou
       * alguém a carregar no botão ao mesmo tempo — não mandam duas
       * mensagens: a segunda bate no `unique (appointment_id, routine)`
       * e sai com `already_sent`.
       */
      const resultado = await avisar(linha.appointment_id, 'reminder_eve')
      if (resultado.ok) enviados++
      else if (resultado.reason === 'send_failed') falhados++
    }

    relatorio.push({
      loja: loja.slug,
      hora: loja.reminder_hour,
      na_fila: fila.length,
      enviados,
      falhados,
      ...(esgotou ? { interrompido: 'tempo esgotado; segue na próxima hora' } : {}),
    })
  }

  return NextResponse.json({ ok: true, lojas: relatorio })
}

/**
 * O SEGREDO PARTILHADO.
 *
 * Comparado em tempo constante: um `===` sobre um segredo responde mais
 * depressa quando o primeiro caracter está errado, e isso chega para o
 * adivinhar letra a letra. É o mesmo cuidado que a casa já tem noutros
 * sítios.
 *
 * Sem `CRON_SECRET` definido, isto recusa TUDO — e é a escolha certa
 * para um endereço que envia mensagens a clientes. Um segredo em falta
 * é um segredo em falta, não uma autorização.
 */
function verificarSegredo(request: Request): NextResponse | null {
  const esperado = process.env.CRON_SECRET
  if (!esperado) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET não está definido' },
      { status: 503 },
    )
  }

  const trazido =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  const a = Buffer.from(trazido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return null
}
