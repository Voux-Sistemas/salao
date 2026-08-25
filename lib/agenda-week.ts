import 'server-only'
import { sql } from '@/lib/db'
import type { Unit } from '@/lib/org'
import { openingWindowsRange } from '@/lib/hours'
import { addDays, dayStart, isoRange, weekdayOf, type IsoDay } from '@/lib/time'

/**
 * O PANORAMA DA SEMANA — a casa vista de longe.
 *
 * A agenda do dia responde a «o que é que acontece hoje». Esta responde
 * a outra pergunta, que se faz com o telefone na mão e o dia inteiro
 * pela frente: como está a semana. Onde está cheio, onde há espaço,
 * quem lá anda.
 *
 * NÃO SE CARREGAM SETE AGENDAS. Seria sete vezes o trabalho — cada
 * marcação com o nome da cliente, o preço, os serviços — para desenhar
 * barras. O que se traz é o que se mostra: quanto tempo está ocupado em
 * cada dia, por quem, e quantas marcações são. O detalhe está a um
 * toque de distância, no dia.
 *
 * Por isso o número que manda aqui é o MINUTO OCUPADO, não a marcação:
 * um dia com duas madeixas de duas horas está mais cheio do que um dia
 * com quatro franjas de meia hora, e contar marcações dizia o
 * contrário.
 */

/** Um dia, visto de longe. */
export type WeekDay = {
  day: IsoDay
  /** Minutos de escala somados de toda a equipa. Zero = casa fechada. */
  capacityMin: number
  /** Desses, quantos estão ocupados por trabalho marcado. */
  bookedMin: number
  /** Quantas marcações (não itens: uma cliente com três serviços é uma). */
  appointments: number
  /** Quem faz turno neste dia, por ordem de entrada. */
  staffIds: string[]
  /** A casa abre neste dia? Um feriado fechado não é um dia vazio. */
  open: boolean
}

export type AgendaWeek = {
  unit: Unit
  /** Segunda-feira desta semana. */
  from: IsoDay
  /** Domingo. */
  to: IsoDay
  days: WeekDay[]
  /** Quem aparece na semana, com o nome já resolvido. */
  staff: { staffId: string; name: string }[]
  /** Somatórios da semana, para não os recontar em cada sítio. */
  totals: { capacityMin: number; bookedMin: number; appointments: number }
}

/**
 * A SEGUNDA-FEIRA DE UM DIA QUALQUER.
 *
 * `weekdayOf` devolve a convenção do Postgres (0 = domingo), e uma
 * semana de trabalho que começa ao domingo não é a semana que ninguém
 * tem na cabeça. Aqui roda-se para segunda = 0, e o domingo passa a ser
 * o sétimo dia, que é onde ele está no calendário da parede.
 */
export function mondayOf(day: IsoDay): IsoDay {
  const dow = weekdayOf(day)
  return addDays(day, -((dow + 6) % 7))
}

export async function loadAgendaWeek(
  unit: Unit,
  anyDayOfWeek: IsoDay,
  options: { onlyStaffId?: string | null } = {},
): Promise<AgendaWeek> {
  const tz = unit.timezone
  const only = options.onlyStaffId ?? null
  const from = mondayOf(anyDayOfWeek)
  const days = isoRange(from, 7)
  const to = days[6]!

  const windowStart = dayStart(from, tz)
  const windowEnd = dayStart(addDays(to, 1), tz)

  const [opening, scheduleRows, bookedRows, staffRows] = await Promise.all([
    openingWindowsRange(unit.id, from, 7),

    /*
      A escala de sete dias de uma vez. A do dia filtra por um `weekday`
      só; aqui geram-se os sete dias e cruza-se cada um com a escala que
      lhe corresponde — a vigência (`valid_from`/`valid_to`) tem de ser
      testada dia a dia, porque uma escala pode começar a meio da semana.
    */
    sql<{ day: IsoDay; staff_id: string; minutes: number }[]>`
      with dias as (
        select d::date as on_date, extract(dow from d)::int as weekday
          from generate_series(${from}::date, ${to}::date, interval '1 day') d
      )
      select to_char(dias.on_date, 'YYYY-MM-DD') as day,
             ss.staff_id,
             sum(ss.ends_min - ss.starts_min)::int as minutes
        from dias
        join staff_schedule ss
          on ss.unit_id = ${unit.id}
         and ss.weekday = dias.weekday
         and ss.valid_from <= dias.on_date
         and (ss.valid_to is null or ss.valid_to >= dias.on_date)
       where (${only}::uuid is null or ss.staff_id = ${only}::uuid)
       group by day, ss.staff_id
    `,

    /*
      O trabalho marcado, contado em minutos de BLOCO — que é o que
      ocupa a agenda de verdade, folgas de tinta incluídas. É o mesmo
      critério da grelha do dia, para os dois números não se
      contradizerem quando se toca no dia.

      Um bloco que atravessa a meia-noite conta no dia em que começa:
      cortá-lo pelos dois dias dava meias marcações, e ninguém pensa
      assim num serviço que acaba às 20:15.

      Não se filtra por estado. Cancelar uma marcação APAGA os blocos
      (`freeBlocks`, em `lib/booking.ts`), portanto o que está aqui é o
      que ainda ocupa a agenda — o mesmo critério da grelha do dia, que
      também não filtra. Acrescentar um filtro de estado seria inventar
      uma diferença entre a semana e o dia.
    */
    sql<
      { day: IsoDay; staff_id: string; minutes: number; marcacoes: number }[]
    >`
      select to_char(lower(sb.during) at time zone ${tz}, 'YYYY-MM-DD') as day,
             ai.staff_id,
             sum(
               extract(epoch from (upper(sb.during) - lower(sb.during))) / 60
             )::int as minutes,
             count(distinct ai.appointment_id)::int as marcacoes
        from staff_block sb
        join appointment_item ai on ai.id = sb.appointment_item_id
       where sb.unit_id = ${unit.id}
         and lower(sb.during) >= ${windowStart}
         and lower(sb.during) < ${windowEnd}
         and (${only}::uuid is null or ai.staff_id = ${only}::uuid)
       group by day, ai.staff_id
    `,

    sql<{ id: string; name: string; public_alias: string | null }[]>`
      select s.id, s.name, s.public_alias
        from staff s
        join staff_unit su on su.staff_id = s.id
       where su.unit_id = ${unit.id}
         and s.is_active
         and (${only}::uuid is null or s.id = ${only}::uuid)
       order by s.sort_order, s.name
    `,
  ])

  const nomes = new Map(staffRows.map((s) => [s.id, s.name]))

  const porDia = new Map<IsoDay, WeekDay>(
    days.map((day) => [
      day,
      {
        day,
        capacityMin: 0,
        bookedMin: 0,
        appointments: 0,
        staffIds: [],
        open: (opening.get(day) ?? []).length > 0,
      },
    ]),
  )

  for (const row of scheduleRows) {
    const d = porDia.get(row.day)
    if (!d || !nomes.has(row.staff_id)) continue
    d.capacityMin += row.minutes
    if (!d.staffIds.includes(row.staff_id)) d.staffIds.push(row.staff_id)
  }

  for (const row of bookedRows) {
    const d = porDia.get(row.day)
    if (!d) continue
    d.bookedMin += row.minutes
    d.appointments += row.marcacoes
    /*
      Um encaixe fora da escala não pode desaparecer do panorama: quem o
      fez trabalhou nesse dia, esteja ou não na escala. É a mesma regra
      da grelha, onde uma coluna nasce de ter trabalho marcado.
    */
    if (nomes.has(row.staff_id) && !d.staffIds.includes(row.staff_id)) {
      d.staffIds.push(row.staff_id)
    }
  }

  const lista = days.map((day) => porDia.get(day)!)
  const presentes = new Set(lista.flatMap((d) => d.staffIds))

  return {
    unit,
    from,
    to,
    days: lista,
    staff: staffRows
      .filter((s) => presentes.has(s.id))
      .map((s) => ({ staffId: s.id, name: s.name })),
    totals: {
      capacityMin: lista.reduce((n, d) => n + d.capacityMin, 0),
      bookedMin: lista.reduce((n, d) => n + d.bookedMin, 0),
      appointments: lista.reduce((n, d) => n + d.appointments, 0),
    },
  }
}
