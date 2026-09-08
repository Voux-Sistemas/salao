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
/**
 * A HORA DA REDE DE SEGURANÇA, na hora da loja.
 *
 * Às 9h a casa está a abrir e quem tem marcação hoje ainda vai a tempo
 * de a mudar. Mais cedo acorda-se gente; mais tarde o aviso chega
 * depois de metade das marcações do dia já terem passado.
 *
 * Fixa, e não uma coluna: a `reminder_hour` é a decisão que a casa toma
 * — a hora a que quer falar com as clientes. Esta é uma rede que só
 * apanha quem escapou, e uma segunda coluna era pedir à casa que
 * decidisse sobre um caso que ela não devia ter de conhecer.
 */
const HORA_DA_REDE = 9

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
     * A PERGUNTA QUE FAZ ISTO FUNCIONAR: já são as horas DESTA LOJA?
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

    /*
     * DUAS RONDAS, A HORAS DIFERENTES, E A SEGUNDA EXISTE POR CAUSA DE
     * UM BURACO NA PRIMEIRA.
     *
     * A da véspera é a que a casa pediu: à hora da loja, avisa quem tem
     * marcação amanhã.
     *
     * A da manhã apanha quem marcou DEPOIS de a véspera já ter passado.
     * Quem marca às 21h para amanhã às 10h nunca entrou na fila das
     * 19h — recebia a confirmação e mais nada, e chegava ao dia sem
     * nunca ter sido lembrado. Num salão, a marcação de última hora não
     * é a excepção.
     *
     * NÃO É UM SEGUNDO LEMBRETE PARA A MESMA PESSOA. A fila
     * `reminder_today` exclui quem já tem linha no `notification_log`,
     * e quem recebeu o da véspera tem-na. Só apanha os que escaparam.
     *
     * A ordem importa: a véspera primeiro. Se as duas horas coincidirem
     * numa loja, quem tem marcação para amanhã é avisado como véspera,
     * e não fica a contar para a ronda de hoje.
     */
    const rondas: { routine: 'reminder_eve' | 'reminder_today'; hora: number }[] = [
      { routine: 'reminder_eve', hora: loja.reminder_hour },
      { routine: 'reminder_today', hora: HORA_DA_REDE },
    ]

    for (const ronda of rondas) {
      if (horaLocal !== ronda.hora) continue

      /*
       * A FILA, TAL COMO O BALCÃO A VÊ. Sem `staffId`: o relógio não é
       * ninguém, e vê a casa toda.
       *
       * É a mesma consulta que desenha a página de avisos. Se um dia a
       * regra do lembrete mudar, muda nos dois sítios ao mesmo tempo
       * porque só existe um sítio.
       *
       * O `reminder_today` traz só marcações que ainda não começaram
       * (`a.starts_at >= now()`), o que é exactamente o que se quer:
       * ninguém é lembrado de uma marcação a que já faltou.
       */
      const fila = await loadQueue(loja, ronda.routine)

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
        const resultado = await avisar(linha.appointment_id, ronda.routine)
        if (resultado.ok) enviados++
        else if (resultado.reason === 'send_failed') falhados++
      }

      relatorio.push({
        loja: loja.slug,
        ronda: ronda.routine,
        hora: ronda.hora,
        na_fila: fila.length,
        enviados,
        falhados,
        ...(esgotou ? { interrompido: 'tempo esgotado; segue na próxima hora' } : {}),
      })
    }
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
