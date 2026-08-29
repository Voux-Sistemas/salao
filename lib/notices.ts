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

/** Quem atende nesta marcação. É por aqui que a fila se reparte. */
export type StaffRef = { id: string; name: string }

export type NoticeRow = {
  appointment_id: string
  client_id: string
  client_name: string
  client_phone: string
  language: Language
  starts_at: Date
  status: Status
  services: string | null
  staff: StaffRef[]
}

/** Uma fila é para despachar à mão. Se passar disto, há outro problema. */
const LIMIT = 200

/** Quantos dias para trás se anda à procura de quem faltou. */
const WINBACK_DAYS = 30

export type Queues = Record<Routine, NoticeRow[]>

/**
 * QUANTOS AVISOS ESTÃO À ESPERA — UM NÚMERO SÓ, PARA O SINO.
 *
 * O número aparece na navegação de todas as páginas do balcão, e por
 * isso corre a cada visita a qualquer uma delas. É uma consulta só: as
 * cinco rotinas contadas em cinco subconsultas, na mesma ida à base.
 *
 * CONTA A REDE QUE A PESSOA VÊ. Quem tem uma loja tem o número da loja;
 * quem tem duas tem a soma, e é isso que a dona quer saber quando olha
 * de relance. A profissional conta só o que passou pelas mãos dela — e
 * o domingo, que é da casa toda.
 *
 * ISTO REPETE AS CONDIÇÕES DO `loadQueue`, e é uma dívida assumida: uma
 * contagem que abrisse as cinco filas de verdade eram cinco consultas
 * por loja em cada página do balcão. QUEM MEXER NUMA DAS DUAS TEM DE
 * MEXER NA OUTRA — as condições estão pela mesma ordem nas duas, de
 * propósito, para se poderem ler lado a lado.
 *
 * O tecto do `loadQueue` (duzentos por fila) não se aplica aqui: um
 * número é um número, e se um dia forem trezentos é isso que tem de
 * aparecer.
 */
export async function countNotices(input: {
  orgId: string
  /** Nulo quando a pessoa vê a rede toda. */
  unitIds: string[] | null
  staffId: string | null
}): Promise<number> {
  const { orgId, unitIds, staffId } = input
  if (unitIds !== null && unitIds.length === 0) return 0

  const rows = await sql<{ total: number }[]>`
    with vista as (
      select a.id, a.client_id, a.status, a.starts_at,
             (a.starts_at at time zone u.timezone)::date as dia,
             (now() at time zone u.timezone)::date as hoje
        from appointment a
        join unit u on u.id = a.unit_id
       where a.org_id = ${orgId}
         and (${unitIds}::uuid[] is null
              or a.unit_id = any(${unitIds}::uuid[]))
         and (
           ${staffId}::uuid is null
           -- Ao domingo a fila é de todas. A razão está no base().
           or extract(dow from (a.starts_at at time zone u.timezone)) = 0
           or exists (
             select 1 from appointment_item i
              where i.appointment_id = a.id and i.staff_id = ${staffId}::uuid
           )
         )
    )
    select (
        (select count(*) from vista v
          where v.status in ('booked', 'confirmed')
            and v.starts_at >= now()
            and not exists (select 1 from notification_log n
                             where n.appointment_id = v.id
                               and n.routine = 'confirm'))
      + (select count(*) from vista v
          where v.status in ('booked', 'confirmed')
            and v.dia = v.hoje + 1
            and not exists (select 1 from notification_log n
                             where n.appointment_id = v.id
                               and n.routine = 'reminder_eve'))
      + (select count(*) from vista v
          where v.status in ('booked', 'confirmed')
            and v.dia = v.hoje
            and v.starts_at >= now()
            and not exists (select 1 from notification_log n
                             where n.appointment_id = v.id
                               and n.routine = 'reminder_today'))
      + (select count(*) from vista v
          where v.status = 'completed'
            and v.dia = v.hoje - 1
            and not exists (select 1 from notification_log n
                             where n.appointment_id = v.id
                               and n.routine = 'review'))
      + (select count(*) from vista v
          where v.status in ('no_show', 'cancelled_by_client')
            and v.starts_at < now()
            and v.dia >= v.hoje - ${WINBACK_DAYS}
            and not exists (select 1 from notification_log n
                             where n.appointment_id = v.id
                               and n.routine = 'winback')
            and not exists (
                  select 1 from appointment f
                   where f.client_id = v.client_id
                     and f.starts_at >= now()
                     and f.status in ('booked', 'confirmed',
                                      'checked_in', 'in_service')))
    )::int as total
  `

  return rows[0]?.total ?? 0
}


/**
 * DE QUEM É A FILA.
 *
 * Quem avisa a cliente é quem lhe pega no cabelo. A profissional trata
 * dos avisos de quem marcou com ela — conhece a conversa, sabe o que
 * ficou combinado — e não vê os avisos das colegas. Com `staffId`, a
 * fila só traz as marcações onde ela é quem atende.
 *
 * Sem `staffId` vem a casa toda: é o que a dona e a gerente veem, e é
 * também a rede de segurança de quem faltou ao aviso.
 *
 * AO DOMINGO NÃO HÁ «DELA». O trabalho de domingo é da casa: entra em
 * nome de quem o motor escolheu, mas quem o pega decide-se no salão.
 * Por isso as marcações de domingo entram na fila de toda a gente,
 * mesmo com `staffId` — a excepção está escrita no `base()`.
 */
export type Scope = {
  staffId?: string | null
  now?: Date
}

export async function loadQueues(unit: Unit, scope: Scope = {}): Promise<Queues> {
  const lists = await Promise.all(
    ROUTINES.map((routine) => loadQueue(unit, routine, scope)),
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
  { staffId = null, now = new Date() }: Scope = {},
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
        ${base(unit, routine, staffId)}
          and a.status in ('booked', 'confirmed')
          and a.starts_at >= ${now}
        order by a.starts_at
        limit ${LIMIT}
      `

    case 'reminder_eve':
      return sql<NoticeRow[]>`
        ${base(unit, routine, staffId)}
          and a.status in ('booked', 'confirmed')
          and (a.starts_at at time zone ${tz})::date = ${tomorrow}::date
        order by a.starts_at
        limit ${LIMIT}
      `

    case 'reminder_today':
      return sql<NoticeRow[]>`
        ${base(unit, routine, staffId)}
          and a.status in ('booked', 'confirmed')
          and (a.starts_at at time zone ${tz})::date = ${day}::date
          and a.starts_at >= ${now}
        order by a.starts_at
        limit ${LIMIT}
      `

    case 'review':
      return sql<NoticeRow[]>`
        ${base(unit, routine, staffId)}
          and a.status = 'completed'
          and (a.starts_at at time zone ${tz})::date = ${yesterday}::date
        order by a.starts_at
        limit ${LIMIT}
      `

    case 'winback':
      // Quem faltou ou cancelou e ainda não voltou a marcar nada.
      return sql<NoticeRow[]>`
        ${base(unit, routine, staffId)}
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
/**
 * A espinha das cinco filas — e o sítio onde a peneira de quem mora.
 *
 * AO DOMINGO A FILA É DE TODAS. O trabalho de domingo não é de ninguém
 * em particular: entra em nome de quem o motor escolheu, mas quem o
 * pega decide-se no salão, entre elas. Quem pega tem de poder avisar, e
 * para avisar tem de ver o aviso na fila.
 *
 * É a mesma regra da grelha do dia — ver `agendaIsPrivateOn` em
 * `lib/sunday.ts`. Aqui a pergunta faz-se em SQL, e não em TypeScript,
 * porque a peneira é da consulta: `extract(dow)` conta de 0 = domingo,
 * a mesma convenção do `weekdayOf` e do `business_hours`. E lê-se no
 * fuso da loja — uma marcação de domingo às 23h em Lisboa já é
 * segunda-feira em UTC.
 */
function base(unit: Unit, routine: Routine, staffId: string | null) {
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
           (select coalesce(
                     jsonb_agg(distinct jsonb_build_object('id', s.id, 'name', s.name)),
                     '[]'::jsonb)
              from appointment_item i
              join staff s on s.id = i.staff_id
             where i.appointment_id = a.id) as staff
      from appointment a
      join client c on c.id = a.client_id
     where a.unit_id = ${unit.id}
       and not exists (
         select 1 from notification_log n
          where n.appointment_id = a.id and n.routine = ${routine}
       )
       and (
         ${staffId}::uuid is null
         -- Ao domingo a fila é de todas: 0 = domingo, no fuso da loja.
         -- A razão está escrita por cima da função.
         or extract(dow from (a.starts_at at time zone ${unit.timezone})) = 0
         or exists (
           select 1 from appointment_item i
            where i.appointment_id = a.id and i.staff_id = ${staffId}
         )
       )
  `
}
