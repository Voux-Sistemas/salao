import 'server-only'
import { sql } from '@/lib/db'
import type { Routine } from '@/lib/whatsapp'
import { isConfigured } from '@/lib/whatsapp/cloud'
import { sendNotice, type Sendable, type SendOutcome } from '@/lib/whatsapp/send'

/**
 * DE UMA MARCAÇÃO PARA UM AVISO ENVIADO.
 *
 * O `send.ts` sabe enviar mas não sabe onde as coisas estão guardadas.
 * Este ficheiro faz a ponte: pega num `appointment_id`, junta o que é
 * preciso da base, e entrega-o.
 *
 * É também o sítio onde se decide NÃO IR À BASE DE TODO. Um sistema sem
 * conta da Meta ligada não tem nada a fazer aqui, e perguntá-lo antes
 * da consulta é a diferença entre uma integração adormecida e uma
 * integração que custa uma ida à base por cada marcação feita.
 */

/** Tudo o que o `sendNotice` precisa, numa consulta só. */
export async function loadSendable(
  appointmentId: string,
): Promise<Sendable | null> {
  const rows = await sql<Sendable[]>`
    select a.org_id      as "orgId",
           a.unit_id     as "unitId",
           a.id          as "appointmentId",
           a.client_id   as "clientId",
           c.name        as "clientName",
           c.phone       as "clientPhone",
           c.whatsapp_opted_out_at as "optedOutAt",
           a.language,
           u.name        as "unitName",
           u.timezone,
           a.starts_at   as "startsAt",
           (select string_agg(
                     case when a.language = 'pt' then i.service_name
                          else name_in(a.language, i.service_name,
                                       sv.name_en, sv.name_es) end,
                     ' + ' order by i.sort_order)
              from appointment_item i
              join service sv on sv.id = i.service_id
             where i.appointment_id = a.id) as services
      from appointment a
      join client c on c.id = a.client_id
      join unit u   on u.id = a.unit_id
     where a.id = ${appointmentId}
     limit 1
  `
  return rows[0] ?? null
}

/**
 * O AVISO QUE SE MANDA SOZINHO, E QUE NUNCA ESTRAGA O QUE VEIO ANTES.
 *
 * Chamado depois de a marcação estar gravada e a transacção fechada.
 * Não devolve nada e NÃO ATIRA NADA: quem o chama já terminou o seu
 * trabalho, e o resultado desta função não pode mudar o dele.
 *
 * UMA MARCAÇÃO PERDIDA POR CAUSA DE UMA MENSAGEM É O PIOR RESULTADO
 * POSSÍVEL. A cliente escolheu a hora, carregou em marcar, e viu o ecrã
 * de confirmação; se a Meta estiver em baixo nesse segundo, o que não
 * pode acontecer é a marcação desaparecer. Por isso o `catch` apanha
 * tudo — e o que corre mal aqui resolve-se da forma que esta casa já
 * resolve: a linha fica na fila e uma pessoa carrega no botão.
 */
export async function avisarSemEstragar(
  appointmentId: string,
  routine: Routine,
): Promise<void> {
  if (!isConfigured()) return

  try {
    const target = await loadSendable(appointmentId)
    if (!target) return
    await sendNotice(target, routine)
  } catch (error) {
    /*
     * Escrever no log do servidor e mais nada. Não há aqui ninguém a
     * quem contar isto: a cliente já foi para o ecrã de confirmação, e
     * o balcão vai ver a marcação na fila de «Confirmar» porque o
     * registo não chegou a ficar gravado.
     */
    console.error(
      `[whatsapp] ${routine} falhou para a marcação ${appointmentId}:`,
      error instanceof Error ? error.message : error,
    )
  }
}

/** Igual, mas devolve o resultado. Para o relógio, que quer contar. */
export async function avisar(
  appointmentId: string,
  routine: Routine,
): Promise<SendOutcome> {
  const target = await loadSendable(appointmentId)
  if (!target) return { ok: false, reason: 'no_phone' }
  return sendNotice(target, routine)
}
