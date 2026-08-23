import 'server-only'
import { sql } from '@/lib/db'
import type { Status } from '@/lib/booking'
import type { Language } from '@/lib/i18n/config'
import type { Unit } from '@/lib/org'
import { addDays, today } from '@/lib/time'
import { ROUTINES, type Routine } from '@/lib/whatsapp'

/**
 * A FILA DE AVISOS É UMA CONSULTA, não uma tabela de tarefas: "quem se
 * enquadra nesta rotina e ainda não tem registo de envio".
 *
 * Não há agendador nem trabalhador de fundo. Enviar é gravar; gravar é
 * sair da fila — e é o registo, e só ele, que impede o aviso repetido.
 */

export type NoticeRow = {
  appointment_id: string
  client_id: string
  client_name: string
  client_phone: string
  language: Language
  starts_at: Date
  status: Status
  services: string | null
  staff_names: string | null
}

/** Uma fila é para despachar à mão. Se passar disto, há outro problema. */
const LIMIT = 200

/** Quantos dias para trás se anda à procura de quem faltou. */
const WINBACK_DAYS = 30

export type Queues = Record<Routine, NoticeRow[]>

export async function loadQueues(unit: Unit, now = new Date()): Promise<Queues> {
  const lists = await Promise.all(
    ROUTINES.map((routine) => loadQueue(unit, routine, now)),
  )
  const queues = {} as Queues
  ROUTINES.forEach((routine, index) => {
    queues[routine] = lists[index] ?? []
  })
  return queues
}

export async function loadQueue(
  unit: Unit,
  routine: Routine,
  now = new Date(),
): Promise<NoticeRow[]> {
  const tz = unit.timezone
  const day = today(tz, now)
  const tomorrow = addDays(day, 1)
  const yesterday = addDays(day, -1)

  // Todas as consultas partilham a mesma espinha: a marcação, a ficha da
  // cliente, o que vai fazer — e a ausência de registo de envio.
  switch (routine) {
    case 'confirm':
      return sql<NoticeRow[]>`
        ${base(unit, routine)}
          and a.status in ('booked', 'confirmed')
          and a.starts_at >= ${now}
        order by a.starts_at
        limit ${LIMIT}
      `

    case 'reminder_eve':
      return sql<NoticeRow[]>`
        ${base(unit, routine)}
          and a.status in ('booked', 'confirmed')
          and (a.starts_at at time zone ${tz})::date = ${tomorrow}::date
        order by a.starts_at
        limit ${LIMIT}
      `

    case 'reminder_today':
      return sql<NoticeRow[]>`
        ${base(unit, routine)}
          and a.status in ('booked', 'confirmed')
          and (a.starts_at at time zone ${tz})::date = ${day}::date
          and a.starts_at >= ${now}
        order by a.starts_at
        limit ${LIMIT}
      `

    case 'review':
      return sql<NoticeRow[]>`
        ${base(unit, routine)}
          and a.status = 'completed'
          and (a.starts_at at time zone ${tz})::date = ${yesterday}::date
        order by a.starts_at
        limit ${LIMIT}
      `

    case 'winback':
      // Quem faltou ou cancelou e ainda não voltou a marcar nada.
      return sql<NoticeRow[]>`
        ${base(unit, routine)}
          and a.status in ('no_show', 'cancelled_by_client')
          and a.starts_at < ${now}
          and (a.starts_at at time zone ${tz})::date >= ${addDays(day, -WINBACK_DAYS)}::date
          and not exists (
            select 1 from appointment f
             where f.client_id = a.client_id
               and f.starts_at >= ${now}
               and f.status in ('booked', 'confirmed', 'checked_in', 'in_service')
          )
        order by a.starts_at desc
        limit ${LIMIT}
      `
  }
}

/**
 * A mensagem sai na língua em que ela marcou — é o que `a.language`
 * guarda, e é por isso que os modelos de `whatsapp.ts` existem em três.
 *
 * O nome do serviço tem de seguir a mesma língua: não vale a pena
 * escrever «Your appointment is booked» e a seguir «Coloração raiz».
 * Em português sai o nome congelado na marcação — o que a casa disse
 * na altura — e nas outras sai a tradução da ficha, com o congelado
 * como rede quando ainda ninguém a escreveu.
 */
function base(unit: Unit, routine: Routine) {
  return sql`
    select a.id as appointment_id, a.client_id,
           c.name as client_name, c.phone as client_phone,
           a.language, a.starts_at, a.status,
           (select string_agg(
                     case when a.language = 'pt' then i.service_name
                          else name_in(a.language, i.service_name,
                                       sv.name_en, sv.name_es) end,
                     ' + ' order by i.sort_order)
              from appointment_item i
              join service sv on sv.id = i.service_id
             where i.appointment_id = a.id) as services,
           (select string_agg(distinct s.name, ', ' order by s.name)
              from appointment_item i
              join staff s on s.id = i.staff_id
             where i.appointment_id = a.id) as staff_names
      from appointment a
      join client c on c.id = a.client_id
     where a.unit_id = ${unit.id}
       and not exists (
         select 1 from notification_log n
          where n.appointment_id = a.id and n.routine = ${routine}
       )
  `
}
