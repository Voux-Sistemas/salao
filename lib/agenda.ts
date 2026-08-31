import 'server-only'
import { sql } from '@/lib/db'
import type { Unit } from '@/lib/org'
import { openingWindows } from '@/lib/hours'
import { merge, type Interval } from '@/lib/intervals'
import {
  addDays,
  dayStart,
  daysBetween,
  formatMinutes,
  isoDay,
  minutesOfDay,
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
  /**
   * Não trabalha hoje e não tem nada marcado: entrou na grelha só
   * porque se pediu a equipa toda. Quem desenha usa isto para lhe dar
   * menos espaço — ver `folgas` em `loadAgendaDay`.
   */
  offDuty: boolean
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
  serviceId: string
  serviceName: string
  priceCents: number
  clientId: string
  clientName: string
  /** Nulo quando a cliente marcou sem deixar número. */
  clientPhone: string | null
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
  /**
   * PARA QUEM SE PODE PASSAR CADA MARCAÇÃO.
   *
   * Vem com o dia e não a pedido: a lista precisa disto em cada linha, e
   * perguntá-lo linha a linha seriam catorze idas à base para desenhar
   * um ecrã. Tudo o que é preciso já cá está — a escala de cada uma, os
   * blocos de todas — e só falta uma consulta: quem sabe fazer o quê.
   */
  handover: Record<string, Candidate[]>
}

/** Uma pessoa a quem se pode (ou não) passar uma marcação. */
export type Candidate = {
  staffId: string
  name: string
  /** Falso: aparece apagada, com a razão à direita. */
  ok: boolean
  /** «agora», «ocupada às 14:00», «não faz coloração», «fora do turno». */
  why: string
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
  service_id: string
  service_name: string
  price_cents: number
  sort_order: number
  item_count: number
  client_id: string
  client_name: string
  client_phone: string | null
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

/**
 * QUEM É QUE FAZ COLUNA.
 *
 * `dia` é o que a agenda sempre fez: quem trabalha hoje, mais quem tem
 * trabalho marcado sem estar escalada. É a vista de quem está a tocar
 * a casa — mostra o dia e nada mais.
 *
 * `equipa` acrescenta a essas quem hoje não vem. A dona pediu-o para
 * ter o panorama da casa inteira num relance: ver de repente que na
 * terça só estão duas pessoas ao balcão é uma decisão de gestão, e não
 * se toma a folhear sete dias um a um. Quem entra por aqui vem marcado
 * com `offDuty` e a grelha dá-lhe uma coluna estreita — está lá, sabe-se
 * que está de folga, e não rouba o espaço a quem está a trabalhar.
 */
export type AgendaScope = 'dia' | 'equipa'

export async function loadAgendaDay(
  unit: Unit,
  day: IsoDay,
  options: { onlyStaffId?: string | null; scope?: AgendaScope } = {},
): Promise<AgendaDay> {
  const tz = unit.timezone
  const only = options.onlyStaffId ?? null
  /* Uma profissional vê a agenda dela: a equipa toda não lhe diz respeito. */
  const scope: AgendaScope = only ? 'dia' : (options.scope ?? 'dia')

  // A janela é o dia local, de meia-noite a meia-noite. O teste é de
  // sobreposição, não de início: um bloco que atravessa a meia-noite
  // aparece nos dois dias, e nenhum bloco de outro dia entra aqui.
  const windowStart = dayStart(day, tz)
  const windowEnd = dayStart(addDays(day, 1), tz)

  const [opening, scheduleRows, blockRows] = await Promise.all([
    openingWindows(unit.id, day),

    /* Semana + turnos extra: a grelha tem de mostrar a coluna de quem
       veio fazer um sábado avulso, senão o trabalho dela não tem onde
       assentar. */
    sql<ScheduleRow[]>`
      select staff_id, starts_min, ends_min
        from staff_schedule
       where unit_id = ${unit.id}
         and weekday = ${weekdayOf(day)}
         and valid_from <= ${day}::date
         and (valid_to is null or valid_to >= ${day}::date)
         and (${only}::uuid is null or staff_id = ${only}::uuid)
      union all
      select staff_id, starts_min, ends_min
        from staff_shift
       where unit_id = ${unit.id}
         and day = ${day}::date
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
        ai.service_id,
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
  const dutyIds = new Set<string>([
    ...scheduleRows.map((r) => r.staff_id),
    ...blockRows.map((r) => r.staff_id),
  ])

  /*
    A EQUIPA TODA, QUANDO SE PEDE.

    Só quem está activa e atribuída a ESTA loja: a agenda de Valongo não
    é sítio para quem só atende na Maia, e uma ficha desactivada saiu da
    casa — mostrá-la seria ressuscitar na grelha quem já não lá está.

    Quem não faz turno em loja nenhuma (a conta da Voux, uma ficha só de
    balcão) também fica de fora: não tem agenda para mostrar.
  */
  const rosterIds =
    scope === 'equipa'
      ? (
          await sql<{ id: string }[]>`
            select s.id
              from staff s
              join staff_unit su on su.staff_id = s.id and su.unit_id = ${unit.id}
             where s.org_id = ${unit.org_id}
               and s.is_active
          `
        ).map((r) => r.id)
      : []

  const ids = [...new Set<string>([...dutyIds, ...rosterIds])]

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
    /*
      De folga é quem entrou por ser da casa e não por ter dia: sem
      escala E sem trabalho marcado. Quem tem um encaixe fora de escala
      trabalha hoje — a coluna é inteira, como sempre foi.
    */
    offDuty: !dutyIds.has(s.id),
  }))

  const blocks: AgendaBlock[] = blockRows.map((r) => ({
    itemId: r.item_id,
    appointmentId: r.appointment_id,
    staffId: r.staff_id,
    startMin: localMinutes(r.starts_at, day, tz),
    endMin: localMinutes(r.ends_at, day, tz),
    blockStartMin: localMinutes(r.block_starts_at, day, tz),
    blockEndMin: localMinutes(r.block_ends_at, day, tz),
    serviceId: r.service_id,
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
  const handover = await quemPodePegar(columns, blocks)

  return {
    unit,
    day,
    opening: openingIntervals,
    fromMin,
    toMin,
    columns,
    blocks,
    handover,
  }
}

/**
 * PARA QUEM SE PODE PASSAR CADA MARCAÇÃO DESTE DIA.
 *
 * Três condições, e são as mesmas que o motor usa para deixar marcar —
 * não se inventa aqui uma regra nova:
 *
 *   · sabe fazer TODOS os serviços daquela marcação;
 *   · a escala dela cobre a marcação inteira, do princípio ao fim;
 *   · não tem nada seu naquelas horas.
 *
 * QUEM NÃO PODE APARECE À MESMA, apagada e com a razão escrita. Uma
 * lista curta sem explicação parece uma avaria — quem a lê fica sem
 * saber se o sistema se enganou ou se a colega está mesmo ocupada.
 *
 * Uma consulta só, e para o dia inteiro: perguntar por linha seriam
 * catorze idas à base para desenhar um ecrã.
 */
async function quemPodePegar(
  columns: AgendaColumn[],
  blocks: AgendaBlock[],
): Promise<Record<string, Candidate[]>> {
  if (blocks.length === 0 || columns.length === 0) return {}

  /* A marcação é o conjunto dos seus itens: os serviços todos, e o
     intervalo do primeiro ao último — folgas incluídas, que é o que
     ocupa a agenda de verdade. */
  type Junta = { services: Set<string>; start: number; end: number }
  const marcacoes = new Map<string, Junta>()
  for (const b of blocks) {
    const j = marcacoes.get(b.appointmentId)
    if (j) {
      j.services.add(b.serviceId)
      j.start = Math.min(j.start, b.blockStartMin)
      j.end = Math.max(j.end, b.blockEndMin)
    } else {
      marcacoes.set(b.appointmentId, {
        services: new Set([b.serviceId]),
        start: b.blockStartMin,
        end: b.blockEndMin,
      })
    }
  }

  const staffIds = columns.map((c) => c.staffId)
  const serviceIds = [...new Set(blocks.map((b) => b.serviceId))]
  const skillRows = await sql<{ staff_id: string; service_id: string }[]>`
    select staff_id, service_id
      from staff_skill
     where staff_id = any(${staffIds}::uuid[])
       and service_id = any(${serviceIds}::uuid[])
  `
  const sabe = new Map<string, Set<string>>()
  for (const r of skillRows) {
    const set = sabe.get(r.staff_id) ?? new Set<string>()
    set.add(r.service_id)
    sabe.set(r.staff_id, set)
  }

  /* O que cada uma já tem em cima, para saber quem está livre. */
  const ocupada = new Map<string, Interval[]>()
  for (const b of blocks) {
    const list = ocupada.get(b.staffId) ?? []
    list.push({ start: b.blockStartMin, end: b.blockEndMin })
    ocupada.set(b.staffId, list)
  }


  const saidas: Record<string, Candidate[]> = {}
  for (const [appointmentId, j] of marcacoes) {
    const dono = blocks.find((b) => b.appointmentId === appointmentId)?.staffId
    saidas[appointmentId] = columns.map((col) => {
      if (col.staffId === dono) {
        return { staffId: col.staffId, name: col.name, ok: false, why: 'agora' }
      }

      const dela = sabe.get(col.staffId) ?? new Set<string>()
      const faltam = [...j.services].filter((s) => !dela.has(s))
      if (faltam.length > 0) {
        return {
          staffId: col.staffId,
          name: col.name,
          ok: false,
          why: 'não faz',
        }
      }

      const cobre = col.schedule.some(
        (w) => w.start <= j.start && j.end <= w.end,
      )
      if (!cobre) {
        return {
          staffId: col.staffId,
          name: col.name,
          ok: false,
          why: 'fora do turno',
        }
      }

      /* O que ela já tem em cima naquelas horas. */
      const seus = ocupada.get(col.staffId) ?? []
      const choca = seus.some((o) => o.start < j.end && j.start < o.end)
      if (choca) {
        return {
          staffId: col.staffId,
          name: col.name,
          ok: false,
          why: `ocupada às ${formatMinutes(j.start)}`,
        }
      }

      const ausente = col.absences.some(
        (a) => a.start < j.end && j.start < a.end,
      )
      if (ausente) {
        return {
          staffId: col.staffId,
          name: col.name,
          ok: false,
          why: 'ausente',
        }
      }

      return { staffId: col.staffId, name: col.name, ok: true, why: 'livre' }
    })
  }
  return saidas
}

/**
 * Minutos desde a meia-noite local DESTE dia. Um instante da véspera dá
 * negativo, um do dia seguinte passa de 1440 — é o que permite desenhar
 * um bloco que atravessa a meia-noite sem o partir.
 */
function localMinutes(instant: Date, day: IsoDay, timezone: string): number {
  // Relógio de parede, não milissegundos decorridos: as escalas, as
  // faixas de abertura e a régua das horas estão todas em minutos de
  // relógio, e nos dias de mudança de hora — que caem sempre ao domingo,
  // dia em que esta casa abre — as duas contagens divergem 60 minutos e
  // os blocos desenhavam-se uma linha acima ou abaixo do sítio.
  const wall = minutesOfDay(instant, timezone)
  return wall + 1440 * daysBetween(day, isoDay(instant, timezone))
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
