import Link from 'next/link'
import clsx from 'clsx'
import type { AgendaBlock, AgendaDay } from '@/lib/agenda'
import type { Status } from '@/lib/booking'
import { formatMinutes } from '@/lib/time'
import { AGENDA_TONE, TONE_BAR } from '@/components/agenda-grid'

/**
 * O PANORAMA DO DIA — o dia inteiro num palmo de ecrã.
 *
 * A lista conta o dia cartão a cartão, mas obriga a rolar para saber
 * como ele acaba. Isto é o contrário: uma fita por profissional, da
 * abertura ao fecho, onde cada marcação é um traço. Vê-se de relance
 * onde o dia está cheio, onde há buracos para um encaixe, e quanto
 * tempo livre resta a cada pessoa — sem rolar nada.
 *
 * Cada traço leva a cor do ESTADO, a mesma língua do resto da agenda:
 * cinzento marcada, dourado confirmada, âmbar à espera, verde feita.
 * Quem é a pessoa já o diz a linha — com o ponto da cor dela, o mesmo
 * das pastilhas ali em cima. Tocar num traço abre a marcação; a vista
 * micro continua a ser a lista, logo por baixo.
 *
 * Tudo se mede em percentagem do dia (fromMin→toMin): ao contrário da
 * grelha, aqui não há escala em píxeis — a fita estica com o ecrã e o
 * dia cabe sempre inteiro.
 */

const HATCH =
  'repeating-linear-gradient(-45deg, transparent 0 4px, color-mix(in srgb, var(--ink) 10%, transparent) 4px 5px)'

export function AgendaPanorama({
  agenda,
  colors,
  hrefFor,
  nowMin,
}: {
  agenda: AgendaDay
  /** display_color de cada profissional, por staffId. */
  colors: Record<string, string>
  hrefFor: (appointmentId: string | null) => string
  nowMin: number | null
}) {
  const { fromMin, toMin, columns, blocks } = agenda
  if (columns.length === 0 || toMin <= fromMin) return null

  const total = toMin - fromMin
  const pct = (min: number) => ((min - fromMin) / total) * 100
  const nowVisible = nowMin !== null && nowMin >= fromMin && nowMin <= toMin

  // Uma etiqueta de hora a cada duas, para a fita se ler sem régua.
  const marks: number[] = []
  for (let m = Math.ceil(fromMin / 120) * 120; m <= toMin; m += 120) {
    marks.push(m)
  }

  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 pb-2 pt-3">
      <div className="relative">
        <div className="space-y-1.5">
          {columns.map((column) => (
            <Lane
              key={column.staffId}
              column={column}
              blocks={blocks.filter((b) => b.staffId === column.staffId)}
              color={colors[column.staffId] ?? 'var(--accent)'}
              fromMin={fromMin}
              toMin={toMin}
              pct={pct}
              hrefFor={hrefFor}
            />
          ))}
        </div>

        {/* a régua, por baixo das fitas — alinhada com elas */}
        <div className="ml-16 mt-1 h-4">
          <div className="relative h-full">
            {marks.map((m) => (
              <span
                key={m}
                className="tabular absolute top-0 -translate-x-1/2 text-[0.5625rem] text-[var(--ink-faint)]"
                style={{ left: `${pct(m)}%` }}
              >
                {formatMinutes(m).replace(':00', 'h')}
              </span>
            ))}
          </div>
        </div>

        {/* o fio de agora atravessa as fitas todas */}
        {nowVisible ? (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-4 top-0 ml-16 w-0"
            style={{ left: `calc((100% - 4rem) * ${pct(nowMin!) / 100})` }}
          >
            <span className="absolute inset-y-0 left-0 w-[2px] rounded-full bg-[var(--accent)] opacity-90" />
            <span className="absolute -left-[3px] -top-[3px] h-2 w-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-raised)]" />
          </div>
        ) : null}
      </div>
    </div>
  )
}

type Column = AgendaDay['columns'][number]

/** Traços da fita: uma marcação inteira, já com os itens juntos. */
type Stroke = {
  appointmentId: string
  startMin: number
  endMin: number
  clientName: string
  status: Status
}

function Lane({
  column,
  blocks,
  color,
  fromMin,
  toMin,
  pct,
  hrefFor,
}: {
  column: Column
  blocks: AgendaBlock[]
  color: string
  fromMin: number
  toMin: number
  pct: (min: number) => number
  hrefFor: (appointmentId: string | null) => string
}) {
  const strokes = toStrokes(blocks)
  const free = freeMinutes(column, strokes, fromMin, toMin)

  return (
    <div className="flex items-center gap-2">
      {/* quem é, e quanto lhe sobra */}
      <span className="w-14 shrink-0 leading-tight">
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: color }}
          />
          <span className="truncate text-[0.6875rem] font-medium text-[var(--ink)]">
            {column.name.split(' ')[0]}
          </span>
        </span>
        <span className="tabular block pl-2.5 text-[0.5625rem] text-[var(--ink-faint)]">
          {free > 0 ? `${curto(free)} livre` : 'sem folga'}
        </span>
      </span>

      {/* a fita: papel onde há escala, mesa onde não há */}
      <div className="grelha-fora relative h-7 flex-1 overflow-hidden rounded-[5px] border border-[var(--line-soft)]">
        {column.schedule.map((window, index) => {
          const start = Math.max(window.start, fromMin)
          const end = Math.min(window.end, toMin)
          if (end <= start) return null
          return (
            <span
              key={index}
              aria-hidden
              className="absolute inset-y-0 bg-[var(--surface-raised)]"
              style={{
                left: `${pct(start)}%`,
                width: `${pct(end) - pct(start)}%`,
              }}
            />
          )
        })}

        {column.absences.map((absence, index) => {
          const start = Math.max(absence.start, fromMin)
          const end = Math.min(absence.end, toMin)
          if (end <= start) return null
          return (
            <span
              key={index}
              aria-hidden
              title={absence.reason ?? absence.kind}
              className="absolute inset-y-0"
              style={{
                left: `${pct(start)}%`,
                width: `${pct(end) - pct(start)}%`,
                background: HATCH,
              }}
            />
          )
        })}

        {strokes.map((stroke) => {
          const tone = AGENDA_TONE[stroke.status]
          const falhou =
            stroke.status === 'no_show' || stroke.status.startsWith('cancel')
          return (
            <Link
              key={stroke.appointmentId}
              href={hrefFor(stroke.appointmentId)}
              scroll={false}
              aria-label={`${formatMinutes(stroke.startMin)} · ${stroke.clientName}`}
              title={`${formatMinutes(stroke.startMin)}–${formatMinutes(stroke.endMin)} · ${stroke.clientName}`}
              className={clsx(
                'absolute inset-y-[3px] min-w-[5px] rounded-[3px]',
                falhou && 'opacity-35',
              )}
              style={{
                left: `calc(${pct(stroke.startMin)}% + 1px)`,
                width: `calc(${pct(stroke.endMin) - pct(stroke.startMin)}% - 2px)`,
                background: TONE_BAR[tone],
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/** "2h05" / "45m" — a duração no corpo mais curto que ela tem. */
function curto(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

/** Os itens da mesma marcação fundem-se num traço só. */
function toStrokes(blocks: AgendaBlock[]): Stroke[] {
  const byAppointment = new Map<string, Stroke>()
  for (const block of blocks) {
    const found = byAppointment.get(block.appointmentId)
    if (!found) {
      byAppointment.set(block.appointmentId, {
        appointmentId: block.appointmentId,
        startMin: block.blockStartMin,
        endMin: block.blockEndMin,
        clientName: block.clientName,
        status: block.status,
      })
    } else {
      found.startMin = Math.min(found.startMin, block.blockStartMin)
      found.endMin = Math.max(found.endMin, block.blockEndMin)
    }
  }
  return [...byAppointment.values()].sort((a, b) => a.startMin - b.startMin)
}

/**
 * O que sobra de escala depois de tirar marcações e ausências. As
 * canceladas e as faltas não ocupam a cadeira — não contam.
 */
function freeMinutes(
  column: Column,
  strokes: Stroke[],
  fromMin: number,
  toMin: number,
): number {
  const busy = [
    ...strokes
      .filter(
        (s) => s.status !== 'no_show' && !s.status.startsWith('cancel'),
      )
      .map((s) => ({ start: s.startMin, end: s.endMin })),
    ...column.absences,
  ].sort((a, b) => a.start - b.start)

  let free = 0
  for (const window of column.schedule) {
    const start = Math.max(window.start, fromMin)
    const end = Math.min(window.end, toMin)
    let cursor = start
    for (const b of busy) {
      if (b.end <= cursor || b.start >= end) continue
      free += Math.max(0, b.start - cursor)
      cursor = Math.max(cursor, b.end)
    }
    free += Math.max(0, end - cursor)
  }
  return free
}
