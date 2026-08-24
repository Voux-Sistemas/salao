import 'server-only'
import { sql } from '@/lib/db'
import type { Unit } from '@/lib/org'
import { openingWindows } from '@/lib/hours'
import { merge, type Interval } from '@/lib/intervals'
import {
  addDays,
  dayStart,
  weekdayOf,
  type IsoDay,
} from '@/lib/time'
import type { Source, Status } from '@/lib/booking'

/**
 * A GRELHA DO DIA: uma coluna por profissional, hora à esquerda.
 *
 * Tudo o que sai daqui está em minutos desde a meia-noite LOCAL DA
 * LOJA — é assim que se desenha. A conversão faz-se uma vez, aqui na
 * borda, e nunca no componente.
 *
 * O que ocupa a agenda é o bloco (folgas incluídas); o que se mostra à
 * cliente é o horário do serviço. Guardam-se os dois.
 */

export type AgendaColumn = {
  staffId: string
  name: string
  avatarUrl: string | null
  /** Escala do dia, em minutos locais. Vazio = não está escalada. */
  schedule: Interval[]
  /** Ausências que tocam este dia, em minutos locais. */
  absences: (Interval & { kind: string; reason: string | null })[]
}

export type AgendaBlock = {
  itemId: string
  appointmentId: string
  staffId: string
  /** Horário do serviço. */
  startMin: number
  endMin: number
  /** Bloco de ocupação, folgas incluídas. */
  blockStartMin: number
  blockEndMin: number
  serviceName: string
  priceCents: number
  clientId: string
  clientName: string
  clientPhone: string
  status: Status
  source: Source
  closedAt: Date | null
  /** A confirmação já saiu por escrito? Não é o mesmo que estar confirmada. */
  confirmSent: boolean
  /** Quantos serviços tem a marcação a que este item pertence. */
  itemCount: number
  sortOrder: number
}

export type AgendaDay = {
  unit: Unit
  day: IsoDay
  /** Faixas de abertura, em minutos locais. */
  opening: Interval[]
  /** Extremos desenhados na grelha. */
  fromMin: number
  toMin: number
  columns: AgendaColumn[]
  blocks: AgendaBlock[]
}

type ScheduleRow = { staff_id: string; starts_min: number; ends_min: number }

type StaffRow = {
  id: string
  name: string
  avatar_url: string | null
  sort_order: number
}

type AbsenceRow = {
  staff_id: string
  kind: string
  reason: string | null
  starts_at: Date
  ends_at: Date
}

type BlockRow = {
  item_id: string
  appointment_id: string
  staff_id: string
  starts_at: Date
  ends_at: Date
  block_starts_at: Date
  block_ends_at: Date
  service_name: string
  price_cents: number
  sort_order: number
  item_count: number
  client_id: string
  client_name: string
  client_phone: string
  status: Status
  source: Source
  closed_at: Date | null
  confirm_sent: boolean
}

/**
 * Meia hora de folga antes e depois, para a grelha respirar.
 *
 * Era uma hora inteira, e o arredondamento à hora certa lá em baixo
 * transformava-a muitas vezes em duas: uma loja que abre às nove
 * começava a grelha às oito, e o topo do ecrã do telemóvel ia todo em
 * banda cinzenta antes de se ver a primeira marcação. Meia hora chega
 * para caber um encaixe antes da abertura e não come o ecrã.
 */
const PADDING = 30
const DEFAULT_FROM = 9 * 60
const DEFAULT_TO = 20 * 60

export async function loadAgendaDay(
  unit: Unit,
  day: IsoDay,
  options: { onlyStaffId?: string | null } = {},
): Promise<AgendaDay> {
  const tz = unit.timezone
  const only = options.onlyStaffId ?? null

  // A janela é o dia local, de meia-noite a meia-noite. O teste é de
  // sobreposição, não de início: um bloco que atravessa a meia-noite
  // aparece nos dois dias, e nenhum bloco de outro dia entra aqui.
  const windowStart = dayStart(day, tz)
  const windowEnd = dayStart(addDays(day, 1), tz)

  const [opening, scheduleRows, blockRows] = await Promise.all([
    openingWindows(unit.id, day),

    sql<ScheduleRow[]>`
      select staff_id, starts_min, ends_min
        from staff_schedule
       where unit_id = ${unit.id}
         and weekday = ${weekdayOf(day)}
         and valid_from <= ${day}::date
         and (valid_to is null or valid_to >= ${day}::date)
         and (${only}::uuid is null or staff_id = ${only}::uuid)
    `,

    sql<BlockRow[]>`
      select
        ai.id                as item_id,
        ai.appointment_id,
        ai.staff_id,
        ai.starts_at,
        ai.ends_at,
        lower(sb.during)     as block_starts_at,
        upper(sb.during)     as block_ends_at,
        ai.service_name,
        ai.price_cents,
        ai.sort_order,
        (
          select count(*)::int from appointment_item x
           where x.appointment_id = ai.appointment_id
        )                    as item_count,
        c.id                 as client_id,
        c.name               as client_name,
        c.phone              as client_phone,
        a.status,
        a.source,
        a.closed_at,
        exists (
          select 1 from notification_log n
           where n.appointment_id = a.id and n.routine = 'confirm'
        )                    as confirm_sent
      from staff_block sb
      join appointment_item ai on ai.id = sb.appointment_item_id
      join appointment a       on a.id = ai.appointment_id
      join client c            on c.id = a.client_id
      where sb.unit_id = ${unit.id}
        and sb.during && tstzrange(${windowStart}, ${windowEnd})
        and (${only}::uuid is null or ai.staff_id = ${only}::uuid)
      order by ai.starts_at
    `,
  ])

  // As colunas são quem está escalada, mais quem tem trabalho marcado
  // sem estar escalada — um encaixe não pode ficar invisível.
  const columnIds = new Set<string>([
    ...scheduleRows.map((r) => r.staff_id),
    ...blockRows.map((r) => r.staff_id),
  ])
  const ids = [...columnIds]

  const [staffRows, absenceRows] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([] as StaffRow[])
      : sql<StaffRow[]>`
          select id, name, avatar_url, sort_order
            from staff
           where id = any(${ids}::uuid[])
           order by sort_order, name
        `,
    ids.length === 0
      ? Promise.resolve([] as AbsenceRow[])
      : sql<AbsenceRow[]>`
          select staff_id, kind, reason, starts_at, ends_at
            from staff_absence
           where staff_id = any(${ids}::uuid[])
             and starts_at < ${windowEnd} and ends_at > ${windowStart}
        `,
  ])

  const scheduleByStaff = new Map<string, Interval[]>()
  for (const row of scheduleRows) {
    const list = scheduleByStaff.get(row.staff_id) ?? []
    list.push({ start: row.starts_min, end: row.ends_min })
    scheduleByStaff.set(row.staff_id, list)
  }

  const absencesByStaff = new Map<string, AgendaColumn['absences']>()
  for (const row of absenceRows) {
    const list = absencesByStaff.get(row.staff_id) ?? []
    list.push({
      start: localMinutes(row.starts_at, day, tz),
      end: localMinutes(row.ends_at, day, tz),
      kind: row.kind,
      reason: row.reason,
    })
    absencesByStaff.set(row.staff_id, list)
  }

  const columns: AgendaColumn[] = staffRows.map((s) => ({
    staffId: s.id,
    name: s.name,
    avatarUrl: s.avatar_url,
    schedule: merge(scheduleByStaff.get(s.id) ?? []),
    absences: absencesByStaff.get(s.id) ?? [],
  }))

  const blocks: AgendaBlock[] = blockRows.map((r) => ({
    itemId: r.item_id,
    appointmentId: r.appointment_id,
    staffId: r.staff_id,
    startMin: localMinutes(r.starts_at, day, tz),
    endMin: localMinutes(r.ends_at, day, tz),
    blockStartMin: localMinutes(r.block_starts_at, day, tz),
    blockEndMin: localMinutes(r.block_ends_at, day, tz),
    serviceName: r.service_name,
    priceCents: r.price_cents,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    status: r.status,
    source: r.source,
    closedAt: r.closed_at,
    confirmSent: r.confirm_sent,
    itemCount: r.item_count,
    sortOrder: r.sort_order,
  }))

  const openingIntervals = opening.map((w) => ({
    start: w.openMin,
    end: w.closeMin,
  }))

  const { fromMin, toMin } = extent(openingIntervals, columns, blocks)

  return { unit, day, opening: openingIntervals, fromMin, toMin, columns, blocks }
}

/**
 * Minutos desde a meia-noite local DESTE dia. Um instante da véspera dá
 * negativo, um do dia seguinte passa de 1440 — é o que permite desenhar
 * um bloco que atravessa a meia-noite sem o partir.
 */
function localMinutes(instant: Date, day: IsoDay, timezone: string): number {
  const base = dayStart(day, timezone).getTime()
  return Math.round((instant.getTime() - base) / 60_000)
}

function extent(
  opening: Interval[],
  columns: AgendaColumn[],
  blocks: AgendaBlock[],
): { fromMin: number; toMin: number } {
  const starts: number[] = []
  const ends: number[] = []

  for (const w of opening) {
    starts.push(w.start)
    ends.push(w.end)
  }
  for (const c of columns) {
    for (const w of c.schedule) {
      starts.push(w.start)
      ends.push(w.end)
    }
  }
  for (const b of blocks) {
    starts.push(b.blockStartMin)
    ends.push(b.blockEndMin)
  }

  if (starts.length === 0) return { fromMin: DEFAULT_FROM, toMin: DEFAULT_TO }

  // Arredonda-se à meia hora, não à hora certa: com o arredondamento à
  // hora, a meia hora de folga virava sempre uma hora inteira de banda
  // cinzenta antes de a casa abrir.
  const from = Math.floor((Math.min(...starts) - PADDING) / 30) * 30
  const to = Math.ceil((Math.max(...ends) + PADDING) / 30) * 30
  return { fromMin: from, toMin: Math.max(to, from + 120) }
}
