import 'server-only'
import { sql } from '@/lib/db'
import type { Language } from '@/lib/i18n/config'
import { formatDayLong, formatTime, isoDay } from '@/lib/time'
import { renderTemplate, type Routine } from '@/lib/whatsapp'
import { isConfigured, isTransient, sendTemplate } from '@/lib/whatsapp/cloud'
import {
  defaultBody,
  isAutomatic,
  META_LANGUAGE,
  metaTemplateName,
  toMetaParameters,
} from '@/lib/whatsapp/template'

/**
 * ENVIAR É GRAVAR; GRAVAR É SAIR DA FILA.
 *
 * A frase é da casa e está escrita na migração dos avisos. O que muda
 * agora é quem carrega no botão — e a frase continua a valer, porque é
 * ela que impede o aviso repetido.
 *
 * A ORDEM AQUI É TUDO: GRAVA-SE PRIMEIRO, ENVIA-SE DEPOIS.
 *
 * Ao contrário do que parece, não é para registar bem — é para não
 * enviar duas vezes. O `unique (appointment_id, routine)` é uma trava
 * da base de dados, e uma trava só trava quem passa por ela ANTES de
 * agir. Enviar primeiro e gravar depois deixa esta janela aberta:
 *
 *     relógio A: fila diz que falta        relógio B: fila diz que falta
 *     relógio A: envia  ← mensagem 1
 *                                          relógio B: envia  ← mensagem 2
 *     relógio A: grava (ok)
 *                                          relógio B: grava (conflito)
 *
 * O conflito é apanhado — tarde. A cliente já recebeu duas.
 *
 * Gravando primeiro, o segundo relógio bate na trava ANTES de falar com
 * a Meta, e não há segunda mensagem. O preço é uma linha gravada para
 * uma mensagem que pode falhar — e esse preço paga-se com a coluna
 * `delivery_state`, que é para isso mesmo.
 */

export type SendOutcome =
  | { ok: true; providerId: string }
  | { ok: false; reason: 'already_sent' }
  | { ok: false; reason: 'opted_out' }
  | { ok: false; reason: 'not_configured' }
  | { ok: false; reason: 'no_phone' }
  | { ok: false; reason: 'not_automatic' }
  | { ok: false; reason: 'send_failed'; detail: string | null; retryable: boolean }

/** O que é preciso saber de uma marcação para lhe mandar um aviso. */
export type Sendable = {
  orgId: string
  unitId: string
  appointmentId: string
  clientId: string
  clientName: string
  clientPhone: string | null
  optedOutAt: Date | null
  language: Language
  unitName: string
  timezone: string
  startsAt: Date
  services: string | null
}

/**
 * MANDA UM AVISO, UMA VEZ SÓ.
 *
 * Devolve porque não mandou, quando não manda — e nenhuma dessas razões
 * é uma excepção. Um aviso que não sai é um facto a registar, e quase
 * sempre um facto normal: já tinha sido enviado, a cliente não quer
 * receber, ainda não há conta da Meta ligada.
 */
export async function sendNotice(
  target: Sendable,
  routine: Routine,
): Promise<SendOutcome> {
  /*
   * As três perguntas baratas primeiro, por ordem crescente de custo.
   * Nenhuma delas toca na base nem na rede.
   */
  if (!isAutomatic(routine)) return { ok: false, reason: 'not_automatic' }
  if (target.optedOutAt) return { ok: false, reason: 'opted_out' }
  if (!target.clientPhone) return { ok: false, reason: 'no_phone' }

  /*
   * E a quarta: há conta ligada? Perguntar isto ANTES de gravar é
   * deliberado. Se gravássemos primeiro, um sistema sem configuração
   * enchia o `notification_log` de linhas de avisos que nunca saíram —
   * e cada uma dessas linhas TIRAVA A MARCAÇÃO DA FILA de quem a
   * despacha à mão. O balcão deixava de ver o que tinha para fazer.
   *
   * É esta ordem que garante a promessa da fase 1: sem as variáveis de
   * ambiente, o sistema é exactamente o de ontem.
   */
  if (!isConfigured()) return { ok: false, reason: 'not_configured' }

  const body = await loadBody(target.orgId, routine, target.language)
  const text = fill(body, target)

  /*
   * A GRAVAÇÃO É A TRAVA. Se outra execução já gravou esta linha, o
   * `on conflict do nothing` não devolve nada — e é aí que se sai, sem
   * ter falado com a Meta.
   *
   * O `delivery_state` nasce 'queued': pedimos, ainda não sabemos. O
   * `sent_by_staff_id` fica nulo, que é como esta casa diz «foi o
   * sistema».
   */
  const claimed = await sql<{ id: string }[]>`
    insert into notification_log
      (org_id, unit_id, appointment_id, client_id, routine,
       message_snapshot, sent_by_staff_id, delivery_state)
    values
      (${target.orgId}, ${target.unitId}, ${target.appointmentId},
       ${target.clientId}, ${routine}, ${text}, null, 'queued')
    on conflict (appointment_id, routine) do nothing
    returning id
  `

  const row = claimed[0]
  if (!row) return { ok: false, reason: 'already_sent' }

  const result = await sendTemplate({
    to: target.clientPhone,
    template: metaTemplateName(routine),
    language: META_LANGUAGE[target.language],
    parameters: toMetaParameters(body, values(target)),
  })

  if (result.ok) {
    await sql`
      update notification_log
         set provider_id = ${result.providerId},
             delivery_state = 'sent'
       where id = ${row.id}
    `
    return { ok: true, providerId: result.providerId }
  }

  /*
   * FALHOU — E AGORA A LINHA TEM DE VOLTAR PARA A FILA.
   *
   * Uma linha que fica gravada é uma linha que saiu da fila, e uma
   * marcação que saiu da fila sem mensagem nenhuma é uma cliente que
   * ninguém avisa e ninguém sabe que não foi avisada. É o pior
   * resultado possível, e é pior do que a mensagem repetida.
   *
   * Por isso apaga-se o registo. A marcação reaparece na fila do
   * balcão, com o botão de sempre ao lado, e uma pessoa despacha-a.
   *
   * O que se perde é o rasto da tentativa falhada. É uma troca
   * consciente: a alternativa — guardar a linha com `failed` e ensinar
   * a fila a ignorar linhas falhadas — punha a lógica da fila a
   * depender do estado de entrega, e a fila é a mesma que a pessoa vê.
   * Uma verdade só.
   */
  await sql`delete from notification_log where id = ${row.id}`

  return {
    ok: false,
    reason: 'send_failed',
    detail: result.detail,
    retryable: isTransient(result.reason),
  }
}

/**
 * O corpo do modelo: o que a casa reescreveu, ou o de origem. É a mesma
 * precedência do `composeMessage` — e tem de ser, porque é este corpo
 * que define a ordem dos `{{n}}` que a Meta aprovou.
 */
async function loadBody(
  orgId: string,
  routine: Routine,
  language: Language,
): Promise<string> {
  const rows = await sql<{ body: string }[]>`
    select body from message_template
     where org_id = ${orgId}
       and routine = ${routine}
       and language = ${language}
     limit 1
  `
  return rows[0]?.body ?? defaultBody(routine, language)
}

/** Os valores dos marcadores, com nome. A ordem faz-se depois. */
function values(target: Sendable) {
  return {
    cliente: firstName(target.clientName),
    loja: target.unitName,
    dia: formatDayLong(
      isoDay(target.startsAt, target.timezone),
      target.timezone,
      target.language,
    ),
    hora: formatTime(target.startsAt, target.timezone, target.language),
    servicos: target.services ?? '',
  }
}

/**
 * O texto guardado no `message_snapshot` — o que a cliente vai ler, tal
 * e qual. É a prova do que se disse, e é o que o balcão mostra quando
 * pergunta «o que é que ela recebeu?».
 */
function fill(body: string, target: Sendable): string {
  return renderTemplate(body, values(target))
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}
