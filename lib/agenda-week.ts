import 'server-only'
import { sql } from '@/lib/db'
import type { Unit } from '@/lib/org'
import { openingWindowsRange } from '@/lib/hours'
import { merge, type Interval } from '@/lib/intervals'
import {
  addDays,
  dayStart,
  daysBetween,
  isoDay,
  isoRange,
  minutesOfDay,
  weekdayOf,
  type IsoDay,
} from '@/lib/time'

/**
 * O PANORAMA DA SEMANA — a casa vista de longe, mas com as horas.
 *
 * A primeira versão disto trazia somatórios: minutos de escala, minutos
 * ocupados, uma percentagem por dia. A dona olhou e não viu nada — e
 * tinha razão, porque a pergunta dela não é «quão cheio está o dia», é
 * «QUEM tem O QUÊ, e A QUE HORAS». Uma percentagem esconde exactamente
 * as duas coisas que ela quer ver.
 *
 * Por isso o que se traz agora é o desenho inteiro, só que de longe:
 * por cada dia, uma pista por profissional; na pista, o turno dela e
 * cada marcação na posição real da hora. Os buracos livres não se
 * calculam — aparecem sozinhos, que é como os buracos aparecem numa
 * agenda de papel.
 *
 * O que NÃO se traz é o resto da ficha: preço, telefone, estado,
 * marcação. Isso é do dia, e o dia está a um toque.
 */

/** Uma marcação vista de longe: onde está e de quem é. */
export type WeekBlock = {
  appointmentId: string
  /** O bloco de ocupação (folgas de tinta incluídas), em minutos locais. */
  startMin: number
  endMin: number
  clientName: string
  serviceName: string
}

/** A pista de uma profissional num dia. */
export type WeekLane = {
  staffId: string
  /** Turnos do dia, em minutos locais, já fundidos. */
  shifts: Interval[]
  blocks: WeekBlock[]
}

export type WeekDay = {
  day: IsoDay
  /** A casa abre neste dia? Um feriado fechado não é um dia vazio. */
  open: boolean
  /**
   * Quem tem dia: turno na escala ou trabalho marcado. Pela ordem da
   * equipa, para a mesma pessoa estar sempre na mesma altura da lista.
   */
  lanes: WeekLane[]
  /** Marcações distintas do dia (uma cliente com três serviços é uma). */
  appointments: number
}

export type AgendaWeek = {
  unit: Unit
  /** Segunda-feira desta semana. */
  from: IsoDay
  /** Domingo. */
  to: IsoDay
  days: WeekDay[]
  /** Quem aparece na semana, com nome e cor já resolvidos. */
  staff: { staffId: string; name: string; color: string }[]
  /**
   * A régua das horas, igual para os sete dias — é o que deixa comparar
   * uma quarta com um sábado de relance. Vai da abertura mais cedo ao
   * fecho mais tarde da semana, esticada se algum turno ou encaixe
   * viver fora do horário da casa, e arredondada à hora certa.
   */
  fromMin: number
  toMin: number
  totals: { appointments: number }
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

/** A régua quando não há nada: o dia útil de sempre. */
const DEFAULT_FROM = 9 * 60
const DEFAULT_TO = 20 * 60

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

  const [opening, scheduleRows, blockRows, staffRows] = await Promise.all([
    openingWindowsRange(unit.id, from, 7),

    /*
      A escala de sete dias de uma vez, turno a turno. A vigência
      (`valid_from`/`valid_to`) testa-se dia a dia, porque uma escala
      pode começar a meio da semana — e começa mesmo: as primeiras
      escalas desta casa nasceram numa terça.
    */
    sql<
      {
        day: IsoDay
        staff_id: string
        starts_min: number
        ends_min: number
      }[]
    >`
      with dias as (
        select d::date as on_date, extract(dow from d)::int as weekday
          from generate_series(${from}::date, ${to}::date, interval '1 day') d
      )
      select to_char(dias.on_date, 'YYYY-MM-DD') as day,
             ss.staff_id, ss.starts_min, ss.ends_min
        from dias
        join staff_schedule ss
          on ss.unit_id = ${unit.id}
         and ss.weekday = dias.weekday
         and ss.valid_from <= dias.on_date
         and (ss.valid_to is null or ss.valid_to >= dias.on_date)
       where (${only}::uuid is null or ss.staff_id = ${only}::uuid)
      -- Os turnos extra entram pela data, e não pelo dia da semana.
      union all
      select to_char(sh.day, 'YYYY-MM-DD') as day,
             sh.staff_id, sh.starts_min, sh.ends_min
        from staff_shift sh
       where sh.unit_id = ${unit.id}
         and sh.day between ${from}::date and ${to}::date
         and (${only}::uuid is null or sh.staff_id = ${only}::uuid)
    `,

    /*
      O trabalho marcado, bloco a bloco — que é o que ocupa a agenda de
      verdade, folgas de tinta incluídas. O mesmo critério da grelha do
      dia, para as duas vistas nunca se contradizerem.

      Um bloco que atravessa a meia-noite conta no dia em que começa:
      cortá-lo pelos dois dias dava meias marcações, e ninguém pensa
      assim num serviço que acaba às 20:15.

      Não se filtra por estado. Cancelar uma marcação APAGA os blocos
      (`freeBlocks`, em `lib/booking.ts`), portanto o que está aqui é o
      que ainda ocupa a agenda.
    */
    sql<
      {
        day: IsoDay
        staff_id: string
        appointment_id: string
        starts_at: Date
        ends_at: Date
        client_name: string
        service_name: string
      }[]
    >`
      select to_char(lower(sb.during) at time zone ${tz}, 'YYYY-MM-DD') as day,
             ai.staff_id, ai.appointment_id,
             lower(sb.during) as starts_at,
             upper(sb.during) as ends_at,
             c.name as client_name,
             ai.service_name
        from staff_block sb
        join appointment_item ai on ai.id = sb.appointment_item_id
        join appointment a on a.id = ai.appointment_id
        join client c on c.id = a.client_id
       where sb.unit_id = ${unit.id}
         and lower(sb.during) >= ${windowStart}
         and lower(sb.during) < ${windowEnd}
         and (${only}::uuid is null or ai.staff_id = ${only}::uuid)
       order by starts_at
    `,

    sql<{ id: string; name: string; display_color: string }[]>`
      select s.id, s.name, s.display_color
        from staff s
        join staff_unit su on su.staff_id = s.id
       where su.unit_id = ${unit.id}
         and s.is_active
         and (${only}::uuid is null or s.id = ${only}::uuid)
       order by s.sort_order, s.name
    `,
  ])

  const daZona = new Set(staffRows.map((s) => s.id))

  /** Minutos de RELÓGIO local deste dia, como em lib/agenda — não
      milissegundos decorridos, que nas mudanças de hora andam 60 min
      ao lado da régua. */
  const localMinutes = (instant: Date, day: IsoDay): number =>
    minutesOfDay(instant, tz) + 1440 * daysBetween(day, isoDay(instant, tz))

  const porDia = new Map<
    IsoDay,
    Map<string, { shifts: Interval[]; blocks: WeekBlock[] }>
  >(days.map((day) => [day, new Map()]))

  const pista = (day: IsoDay, staffId: string) => {
    const dia = porDia.get(day)!
    let lane = dia.get(staffId)
    if (!lane) {
      lane = { shifts: [], blocks: [] }
      dia.set(staffId, lane)
    }
    return lane
  }

  for (const row of scheduleRows) {
    if (!porDia.has(row.day) || !daZona.has(row.staff_id)) continue
    pista(row.day, row.staff_id).shifts.push({
      start: row.starts_min,
      end: row.ends_min,
    })
  }

  for (const row of blockRows) {
    /*
      Um encaixe fora da escala não desaparece do panorama: quem o fez
      trabalha nesse dia, esteja ou não na escala. A pista nasce do
      trabalho, como a coluna da grelha do dia.
    */
    if (!porDia.has(row.day) || !daZona.has(row.staff_id)) continue
    pista(row.day, row.staff_id).blocks.push({
      appointmentId: row.appointment_id,
      startMin: localMinutes(row.starts_at, row.day),
      endMin: localMinutes(row.ends_at, row.day),
      clientName: row.client_name,
      serviceName: row.service_name,
    })
  }

  const lista: WeekDay[] = days.map((day) => {
    const dia = porDia.get(day)!
    // A ordem das pistas é a ordem da equipa, sempre a mesma.
    const lanes: WeekLane[] = staffRows
      .filter((s) => dia.has(s.id))
      .map((s) => {
        const lane = dia.get(s.id)!
        return {
          staffId: s.id,
          shifts: merge(lane.shifts),
          blocks: lane.blocks,
        }
      })
    return {
      day,
      open: (opening.get(day) ?? []).length > 0,
      lanes,
      appointments: new Set(
        lanes.flatMap((l) => l.blocks.map((b) => b.appointmentId)),
      ).size,
    }
  })

  // A régua da semana: aberturas da casa, esticada pelo que viva fora
  // delas, arredondada à hora certa.
  const starts: number[] = []
  const ends: number[] = []
  for (const day of days) {
    for (const w of opening.get(day) ?? []) {
      starts.push(w.openMin)
      ends.push(w.closeMin)
    }
  }
  for (const d of lista) {
    for (const lane of d.lanes) {
      for (const s of lane.shifts) {
        starts.push(s.start)
        ends.push(s.end)
      }
      for (const b of lane.blocks) {
        starts.push(b.startMin)
        ends.push(b.endMin)
      }
    }
  }
  const fromMin =
    starts.length === 0
      ? DEFAULT_FROM
      : Math.floor(Math.min(...starts) / 60) * 60
  const toMin =
    ends.length === 0
      ? DEFAULT_TO
      : Math.max(Math.ceil(Math.max(...ends) / 60) * 60, fromMin + 120)

  const presentes = new Set(lista.flatMap((d) => d.lanes.map((l) => l.staffId)))

  return {
    unit,
    from,
    to,
    days: lista,
    staff: staffRows
      .filter((s) => presentes.has(s.id))
      .map((s) => ({ staffId: s.id, name: s.name, color: s.display_color })),
    fromMin,
    toMin,
    totals: {
      appointments: lista.reduce((n, d) => n + d.appointments, 0),
    },
  }
}
