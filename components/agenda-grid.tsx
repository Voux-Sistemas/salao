import Link from 'next/link'
import clsx from 'clsx'
import type { AgendaBlock, AgendaDay } from '@/lib/agenda'
import type { Status } from '@/lib/booking'
import { formatMinutes } from '@/lib/time'
import { STATUS_LABEL, type Tone } from '@/lib/status'
import { initial, shortName } from '@/lib/text'
import { Badge, Empty } from '@/components/ui'
import { Monogram } from '@/components/brand'
import { IconCheck } from '@/components/desk-icons'

/**
 * A GRELHA DO DIA: uma coluna por profissional, hora à esquerda.
 *
 * Desenha-se em minutos: um minuto vale `SCALE` píxeis. O bloco de
 * ocupação (folgas incluídas) é o rectângulo desenhado; o horário do
 * serviço é o que se escreve lá dentro. A régua das horas fica presa à
 * esquerda e o cabeçalho das colunas ao topo — a grelha desliza por
 * baixo dos dois.
 */

/** Píxeis por minuto. 1.1 dá 66px por hora — cabe uma linha de texto. */
const SCALE = 1.1
/** Largura da régua das horas (w-14). */
const RAIL = 'w-14'
/**
 * Largura de cada coluna. Com poucas profissionais esticam para encher
 * o dia — uma agenda que não chega à margem lê-se como inacabada; com
 * muitas encolhem até ao mínimo e a grelha passa a deslizar na
 * horizontal.
 */
const COLUMN = 'min-w-[13.5rem] flex-1 basis-[13.5rem]'

/**
 * O tom de cada estado, como a casa o lê na agenda: neutro enquanto só
 * está marcada, accent quando há palavra dada (confirmada, em serviço),
 * warn quando a cliente espera, ok quando está feito, bad quando falhou.
 */
export const AGENDA_TONE: Record<Status, Tone> = {
  booked: 'neutral',
  confirmed: 'accent',
  checked_in: 'warn',
  in_service: 'accent',
  completed: 'ok',
  cancelled_by_client: 'bad',
  cancelled_by_salon: 'bad',
  no_show: 'bad',
}

const TONE_STYLE: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-raised)] border-[var(--line)] text-[var(--ink)]',
  accent:
    'bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface-raised))] border-[color-mix(in_srgb,var(--accent)_50%,transparent)] text-[var(--ink)]',
  ok: 'bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface-raised))] border-[color-mix(in_srgb,var(--ok)_40%,transparent)] text-[var(--ink)]',
  warn: 'bg-[color-mix(in_srgb,var(--warn)_13%,var(--surface-raised))] border-[color-mix(in_srgb,var(--warn)_50%,transparent)] text-[var(--ink)]',
  bad: 'bg-[color-mix(in_srgb,var(--bad)_8%,var(--surface-raised))] border-[color-mix(in_srgb,var(--bad)_35%,transparent)] text-[var(--ink-muted)] line-through decoration-[var(--ink-faint)]',
}

/** A cor de fio que cada tom usa fora dos blocos (barras, marcas). */
const TONE_BAR: Record<Tone, string> = {
  neutral: 'var(--line)',
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
}

export function AgendaGrid({
  agenda,
  colors,
  selectedId,
  hrefFor,
  nowMin,
}: {
  agenda: AgendaDay
  /** display_color de cada profissional, por staffId. */
  colors: Record<string, string>
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
  const nowVisible = nowMin !== null && nowMin >= fromMin && nowMin <= toMin
  // A hora "agora" na régua só se escreve longe das horas certas.
  const nowLabel = nowVisible && nowMin! % 60 >= 12 && nowMin! % 60 <= 48

  return (
    // Enche a largura disponível, mas nunca encolhe abaixo do mínimo das
    // colunas — é aí que a grelha passa a deslizar na horizontal. Com uma
    // coluna só (o dia da profissional) o esticar deixa de fazer sentido:
    // um bloco de hora e meia com 1100 px de largo e duas palavras no
    // canto não é uma agenda, é um campo vazio. Estreita-se, centra-se e
    // fecha-se dos lados: passa a ler-se como a folha do dia, e não como
    // uma grelha que ficou por acabar a meio do ecrã.
    <div
      className={clsx(
        'w-full min-w-min',
        columns.length === 1 &&
          'mx-auto max-w-3xl border-x border-[var(--line-soft)]',
      )}
    >
      {/* cabeçalho das colunas ------------------------------------ */}
      <div className="sticky top-0 z-30 flex border-b border-[var(--line)] bg-[var(--surface-raised)]">
        <div
          className={clsx(
            'sticky left-0 z-10 shrink-0 border-r border-[var(--line-soft)] bg-[var(--surface-raised)]',
            RAIL,
          )}
        />
        {columns.map((column) => (
          <div
            key={column.staffId}
            className={clsx(
              'flex items-center gap-2.5 border-l border-[var(--line-soft)] px-3 py-2.5 first:border-l-0',
              COLUMN,
            )}
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
              style={{
                color: colors[column.staffId] ?? 'var(--accent)',
                borderColor: `color-mix(in srgb, ${colors[column.staffId] ?? 'var(--accent)'} 55%, transparent)`,
                background: `color-mix(in srgb, ${colors[column.staffId] ?? 'var(--accent)'} 12%, var(--surface-raised))`,
              }}
            >
              <Monogram
                initials={initial(column.name)}
                className="text-[0.8125rem]"
              />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[0.8125rem] font-medium text-[var(--ink)]">
                {shortName(column.name)}
              </p>
              <p className="tabular truncate text-[0.625rem] text-[var(--ink-faint)]">
                {scheduleLabel(column.schedule)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* corpo ---------------------------------------------------- */}
      <div className="flex">
        {/* a régua das horas, presa à esquerda */}
        <div
          className={clsx(
            'sticky left-0 z-20 shrink-0 border-r border-[var(--line-soft)] bg-[var(--surface)]',
            RAIL,
          )}
          style={{ height }}
        >
          {hours.map((m) => (
            <span
              key={m}
              className="tabular absolute right-2 text-[0.6875rem] text-[var(--ink-faint)]"
              // A etiqueta centra-se no fio, menos a primeira: essa
              // subia para fora da caixa e ficava cortada ao meio pelo
              // cabeçalho das colunas.
              style={{ top: Math.max(top(m) - 7, 2) }}
            >
              {formatMinutes(m)}
            </span>
          ))}
          {nowLabel ? (
            <span
              className="tabular absolute right-2 text-[0.625rem] font-medium text-[var(--accent)]"
              style={{ top: top(nowMin!) - 6 }}
            >
              {formatMinutes(nowMin!)}
            </span>
          ) : null}
        </div>

        {/* a tela onde tudo se desenha */}
        <div className="relative flex-1" style={{ height }}>
          {/* linhas de hora e meia-hora */}
          {hours.map((m) => (
            <div key={m}>
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-[var(--line-soft)]"
                style={{ top: top(m) }}
              />
              {m + 30 <= toMin ? (
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-[var(--line-soft)] opacity-50"
                  style={{ top: top(m + 30) }}
                />
              ) : null}
            </div>
          ))}

          <div className="flex h-full">
            {columns.map((column) => (
              <div
                key={column.staffId}
                className={clsx(
                  'relative h-full border-l border-[var(--line-soft)] first:border-l-0',
                  COLUMN,
                )}
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
                    <Block
                      key={block.itemId}
                      block={block}
                      color={colors[block.staffId] ?? 'var(--gold)'}
                      selected={selectedId === block.appointmentId}
                      href={hrefFor(block.appointmentId)}
                      top={top}
                    />
                  ))}
              </div>
            ))}
          </div>

          {/* a linha de agora — um fio dourado a atravessar o dia */}
          {nowVisible ? (
            <div
              className="pointer-events-none absolute inset-x-0 z-10"
              style={{ top: top(nowMin!) }}
            >
              {/* Em bronze, não em dourado: a --gold a 1px sobre
                  porcelana era indistinguível de um fio de hora e a
                  única coisa que tem de se encontrar num relance
                  passava despercebida. */}
              <div className="border-t border-[var(--accent)]" />
              <span className="absolute -left-[3px] -top-[3.5px] block h-1.5 w-1.5 rotate-45 bg-[var(--accent)]" />
            </div>
          ) : null}
        </div>
      </div>

      {opening.length === 0 ? (
        <p className="py-3 text-center text-[0.75rem] text-[var(--ink-faint)]">
          A loja está fechada neste dia.
        </p>
      ) : null}
    </div>
  )
}

function Block({
  block,
  color,
  selected,
  href,
  top,
}: {
  block: AgendaBlock
  color: string
  selected: boolean
  href: string
  top: (min: number) => number
}) {
  const height = Math.max(
    22,
    (block.blockEndMin - block.blockStartMin) * SCALE - 2,
  )
  const compact = height < 42

  return (
    <Link
      href={href}
      scroll={false}
      className={clsx(
        'absolute inset-x-1.5 z-[2] block overflow-hidden rounded-[var(--radius)] border py-0.5 pl-2.5 pr-1.5',
        'transition-shadow duration-200 hover:z-[5] hover:shadow-[var(--shadow-soft)]',
        TONE_STYLE[AGENDA_TONE[block.status]],
        selected && 'z-[6] shadow-[var(--shadow-soft)] ring-1 ring-[var(--accent)]',
      )}
      style={{ top: top(block.blockStartMin), height }}
      title={`${formatMinutes(block.startMin)}–${formatMinutes(block.endMin)} · ${block.clientName} · ${block.serviceName} · ${STATUS_LABEL[block.status]}`}
    >
      {/* a cor da profissional, num fio à esquerda */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-[2px]"
        style={{ background: color }}
      />
      <span className="flex items-baseline gap-1.5">
        <span className="tabular text-[0.6875rem] text-[var(--ink-muted)]">
          {formatMinutes(block.startMin)}
        </span>
        <span className="truncate text-[0.75rem] font-medium">
          {block.clientName}
        </span>
        {block.confirmSent ? (
          <IconCheck className="ml-auto h-3 w-3 shrink-0 self-center text-[var(--ink-faint)]" />
        ) : null}
      </span>
      {!compact ? (
        <span className="block truncate text-[0.6875rem] text-[var(--ink-muted)]">
          {block.serviceName}
          {block.itemCount > 1 ? ` +${block.itemCount - 1}` : ''}
        </span>
      ) : null}
    </Link>
  )
}

/** "10:00–19:00", ou «Fora de escala» quando não está escalada. */
function scheduleLabel(schedule: { start: number; end: number }[]): string {
  if (schedule.length === 0) return 'Fora de escala'
  return schedule
    .map((w) => `${formatMinutes(w.start)}–${formatMinutes(w.end)}`)
    .join(' · ')
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

// ---------------------------------------------------------------------
// A LISTA DO DIA — a vista da profissional no telemóvel: o dia dela,
// cartão a cartão, com a hora grande à esquerda.
// ---------------------------------------------------------------------

type DayCard = {
  appointmentId: string
  startMin: number
  endMin: number
  clientName: string
  services: string
  status: Status
  confirmSent: boolean
}

export function AgendaList({
  agenda,
  hrefFor,
  nowMin,
}: {
  agenda: AgendaDay
  hrefFor: (appointmentId: string | null) => string
  nowMin: number | null
}) {
  const cards = toCards(agenda.blocks)

  if (cards.length === 0) {
    return (
      <Empty
        title="Dia livre"
        hint="Não há nenhuma marcação neste dia."
      />
    )
  }

  // O fio de «agora» entra entre o que já passou e o que vem a seguir.
  const nowIndex =
    nowMin === null ? -1 : cards.findIndex((c) => c.startMin >= nowMin)

  return (
    <ol>
      {cards.map((card, index) => (
        <li key={card.appointmentId} className="border-b border-[var(--line-soft)]">
          {index === nowIndex ? <NowRule nowMin={nowMin!} /> : null}
          <Link
            href={hrefFor(card.appointmentId)}
            scroll={false}
            className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-[var(--surface-sunken)]"
          >
            <span className="w-[4.25rem] shrink-0 text-right">
              <span className="tabular display block text-[1.625rem] leading-none text-[var(--ink)]">
                {formatMinutes(card.startMin)}
              </span>
              <span className="tabular mt-1 block text-[0.6875rem] text-[var(--ink-faint)]">
                até {formatMinutes(card.endMin)}
              </span>
            </span>

            <span className="relative min-w-0 flex-1 pl-3">
              <span
                aria-hidden
                className="absolute bottom-0.5 left-0 top-0.5 w-[2px]"
                style={{ background: TONE_BAR[AGENDA_TONE[card.status]] }}
              />
              <span className="block truncate text-[0.9375rem] font-medium text-[var(--ink)]">
                {card.clientName}
              </span>
              <span className="mt-0.5 line-clamp-2 text-[0.8125rem] text-[var(--ink-muted)]">
                {card.services}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={AGENDA_TONE[card.status]}>
                  {STATUS_LABEL[card.status]}
                </Badge>
                {card.confirmSent ? (
                  <span
                    title="Confirmação enviada"
                    className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]"
                  >
                    <IconCheck className="h-3 w-3" />
                    enviada
                  </span>
                ) : null}
              </span>
            </span>
          </Link>
        </li>
      ))}
      {nowIndex === -1 && nowMin !== null ? (
        <li>
          <NowRule nowMin={nowMin} />
          {/* Já passou tudo: vale a pena dizê-lo, em vez de deixar o
              ecrã a acabar num fio solto. */}
          <p className="px-4 pt-5 pb-8 text-center text-[0.8125rem] text-[var(--ink-faint)]">
            Nada mais para hoje.
          </p>
        </li>
      ) : null}
    </ol>
  )
}

function NowRule({ nowMin }: { nowMin: number }) {
  return (
    <div aria-hidden className="flex items-center gap-2 px-4 py-1">
      <span className="block h-1 w-1 rotate-45 bg-[var(--accent)]" />
      <span className="h-px flex-1 bg-[var(--accent)]" />
      <span className="tabular text-[0.625rem] font-medium uppercase tracking-[0.05em] text-[var(--accent)]">
        agora · {formatMinutes(nowMin)}
      </span>
    </div>
  )
}

/** Junta os itens da mesma marcação num cartão só. */
function toCards(blocks: AgendaBlock[]): DayCard[] {
  const byAppointment = new Map<string, DayCard>()

  for (const block of [...blocks].sort((a, b) => a.startMin - b.startMin)) {
    const found = byAppointment.get(block.appointmentId)
    if (!found) {
      byAppointment.set(block.appointmentId, {
        appointmentId: block.appointmentId,
        startMin: block.startMin,
        endMin: block.endMin,
        clientName: block.clientName,
        services: block.serviceName,
        status: block.status,
        confirmSent: block.confirmSent,
      })
    } else {
      found.endMin = Math.max(found.endMin, block.endMin)
      found.services = `${found.services} + ${block.serviceName}`
    }
  }

  return [...byAppointment.values()].sort((a, b) => a.startMin - b.startMin)
}
