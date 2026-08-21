import Link from 'next/link'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import type { AgendaDay } from '@/lib/agenda'
import { formatMinutes } from '@/lib/time'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/status'
import { initial, shortName } from '@/lib/text'
import { Empty } from '@/components/ui'

/**
 * A GRELHA DO DIA: uma coluna por profissional, hora à esquerda.
 *
 * Desenha-se em minutos: um minuto vale `SCALE` píxeis. O bloco de
 * ocupação (folgas incluídas) é o rectângulo desenhado; o horário do
 * serviço é o que se escreve lá dentro.
 */

/** Píxeis por minuto. 1.1 dá 66px por hora — cabe uma linha de texto. */
const SCALE = 1.1
const RAIL = 52

const TONE_STYLE: Record<string, string> = {
  neutral:
    'bg-[var(--surface-raised)] border-[var(--line)] text-[var(--ink)]',
  accent:
    'bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface-raised))] border-[var(--accent)] text-[var(--ink)]',
  ok: 'bg-[color-mix(in_srgb,var(--ok)_12%,var(--surface-raised))] border-[color-mix(in_srgb,var(--ok)_45%,transparent)] text-[var(--ink)]',
  warn: 'bg-[color-mix(in_srgb,var(--warn)_14%,var(--surface-raised))] border-[color-mix(in_srgb,var(--warn)_55%,transparent)] text-[var(--ink)]',
  bad: 'bg-[color-mix(in_srgb,var(--bad)_10%,var(--surface-raised))] border-[color-mix(in_srgb,var(--bad)_40%,transparent)] text-[var(--ink-muted)] line-through decoration-[var(--ink-faint)]',
}

export function AgendaGrid({
  agenda,
  selectedId,
  hrefFor,
  nowMin,
}: {
  agenda: AgendaDay
  selectedId: string | null
  /** Como se abre o painel lateral de uma marcação. */
  hrefFor: (appointmentId: string | null) => string
  /** Minutos locais de agora, ou null se o dia mostrado não for hoje. */
  nowMin: number | null
}) {
  const { fromMin, toMin, columns, blocks, opening } = agenda

  if (columns.length === 0) {
    return (
      <Empty
        title="Ninguém escalado neste dia"
        hint="A escala define-se em Gestão · Equipa, e tem vigência: trocar de escala é fechar a antiga e abrir uma nova."
      />
    )
  }

  const height = (toMin - fromMin) * SCALE
  const hours: number[] = []
  for (let m = Math.ceil(fromMin / 60) * 60; m <= toMin; m += 60) hours.push(m)

  const top = (min: number) => (min - fromMin) * SCALE

  return (
    <div className="overflow-x-auto">
      <div
        className="relative min-w-max"
        style={{ paddingLeft: RAIL }}
      >
        {/* cabeçalho das colunas ---------------------------------- */}
        <div
          className="sticky top-14 z-20 flex border-b border-[var(--line)] bg-[var(--surface)]"
          style={{ marginLeft: -RAIL, paddingLeft: RAIL }}
        >
          {columns.map((column) => (
            <div
              key={column.staffId}
              className="w-[13.5rem] shrink-0 border-l border-[var(--line-soft)] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="display flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[0.6875rem] text-[var(--ink-muted)]"
                >
                  {initial(column.name)}
                </span>
                <span className="truncate text-[0.8125rem] text-[var(--ink)]">
                  {shortName(column.name)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* corpo -------------------------------------------------- */}
        <div className="relative" style={{ height }}>
          {/* linhas das horas */}
          {hours.map((m) => (
            <div
              key={m}
              className="pointer-events-none absolute inset-x-0 border-t border-[var(--line-soft)]"
              style={{ top: top(m), marginLeft: -RAIL }}
            >
              <span className="tabular absolute -top-2 left-0 w-[44px] pr-2 text-right text-[0.6875rem] text-[var(--ink-faint)]">
                {formatMinutes(m)}
              </span>
            </div>
          ))}

          {/* agora */}
          {nowMin !== null && nowMin >= fromMin && nowMin <= toMin ? (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-[var(--accent)]"
              style={{ top: top(nowMin) }}
            >
              <span className="absolute -left-1 -top-[3px] block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </div>
          ) : null}

          <div className="flex h-full">
            {columns.map((column) => (
              <div
                key={column.staffId}
                className="relative h-full w-[13.5rem] shrink-0 border-l border-[var(--line-soft)]"
              >
                {/* fora da escala fica sombreado */}
                <Shade
                  schedule={column.schedule}
                  fromMin={fromMin}
                  toMin={toMin}
                  top={top}
                />

                {column.absences.map((absence, index) => (
                  <div
                    key={index}
                    className="absolute inset-x-0 z-[1] bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--line)_5px,var(--line)_6px)]"
                    style={{
                      top: top(Math.max(absence.start, fromMin)),
                      height:
                        (Math.min(absence.end, toMin) -
                          Math.max(absence.start, fromMin)) *
                        SCALE,
                    }}
                    title={absence.reason ?? absence.kind}
                  />
                ))}

                {blocks
                  .filter((b) => b.staffId === column.staffId)
                  .map((block) => (
                    <Link
                      key={block.itemId}
                      href={hrefFor(block.appointmentId)}
                      scroll={false}
                      className={clsx(
                        'absolute inset-x-1 z-[2] overflow-hidden rounded-[2px] border px-2 py-1 transition-shadow',
                        TONE_STYLE[STATUS_TONE[block.status]],
                        selectedId === block.appointmentId &&
                          'ring-1 ring-[var(--accent)]',
                      )}
                      style={{
                        top: top(block.blockStartMin),
                        height: Math.max(
                          20,
                          (block.blockEndMin - block.blockStartMin) * SCALE - 2,
                        ),
                      }}
                      title={`${formatMinutes(block.startMin)}–${formatMinutes(block.endMin)} · ${block.clientName} · ${block.serviceName} · ${STATUS_LABEL[block.status]}`}
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span className="tabular text-[0.6875rem] text-[var(--ink-muted)]">
                          {formatMinutes(block.startMin)}
                        </span>
                        <span className="truncate text-[0.75rem] font-medium">
                          {block.clientName}
                        </span>
                        {block.confirmSent ? (
                          <Check
                            aria-label="confirmação enviada"
                            className="ml-auto h-3 w-3 shrink-0 text-[var(--ink-faint)]"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-[0.6875rem] text-[var(--ink-muted)]">
                        {block.serviceName}
                        {block.itemCount > 1 ? ` +${block.itemCount - 1}` : ''}
                      </span>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        </div>

        {opening.length === 0 ? (
          <p className="py-3 text-center text-[0.75rem] text-[var(--ink-faint)]">
            A loja está fechada neste dia.
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Sombreia o que está fora da escala desta profissional. */
function Shade({
  schedule,
  fromMin,
  toMin,
  top,
}: {
  schedule: { start: number; end: number }[]
  fromMin: number
  toMin: number
  top: (min: number) => number
}) {
  const gaps: { start: number; end: number }[] = []
  let cursor = fromMin
  for (const window of schedule) {
    if (window.start > cursor) gaps.push({ start: cursor, end: window.start })
    cursor = Math.max(cursor, window.end)
  }
  if (cursor < toMin) gaps.push({ start: cursor, end: toMin })

  return (
    <>
      {gaps.map((gap, index) => (
        <div
          key={index}
          className="absolute inset-x-0 bg-[var(--surface-sunken)]"
          style={{
            top: top(gap.start),
            height: (gap.end - gap.start) * SCALE,
          }}
        />
      ))}
    </>
  )
}
