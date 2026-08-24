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

/**
 * PÍXEIS POR MINUTO — E QUEM OS DECIDE É O CSS, NÃO ESTE FICHEIRO.
 *
 * A escala vive na variável `--esc`, posta na folha de estilo pela
 * classe `grelha-dia`: 0,9 no telemóvel e 1,1 daí para cima. É a
 * diferença entre ver o dia inteiro de uma vez e ter de rolar oito
 * horas para chegar à tarde — num ecrã de 844px de alto, 1,1 mostra
 * pouco mais de meia jornada.
 *
 * Por isso tudo aqui se escreve em `calc()` a partir de minutos, e não
 * em píxeis já contados do lado do servidor: o servidor não sabe a
 * largura do ecrã, e não tem de saber.
 */
/** Largura da régua das horas (w-12/w-14). */
const RAIL = 'w-12 sm:w-14'
/**
 * Largura de cada coluna. Com poucas profissionais esticam para encher
 * o dia — uma agenda que não chega à margem lê-se como inacabada; com
 * muitas encolhem até ao mínimo e a grelha passa a deslizar na
 * horizontal.
 *
 * O mínimo é mais apertado no telemóvel: 13,5rem numa tela de 390px
 * deixava a segunda coluna quase toda fora do ecrã, e quem olha para a
 * agenda com o telefone na mão precisa de ver que ela existe.
 */
const COLUMN = 'min-w-[8.75rem] flex-1 basis-[8.75rem] sm:min-w-[13.5rem] sm:basis-[13.5rem]'

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

  const hours: number[] = []
  for (let m = Math.ceil(fromMin / 60) * 60; m <= toMin; m += 60) hours.push(m)

  /** Quantos píxeis vale um punhado de minutos, na escala do ecrã. */
  const span = (minutes: number) => `calc(${minutes} * var(--esc) * 1px)`
  /** A que altura da tela cai um minuto do dia. */
  const top = (min: number) => span(min - fromMin)
  const height = span(toMin - fromMin)
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
        'grelha-dia w-full min-w-min',
        columns.length === 1 &&
          'mx-auto max-w-3xl border-x border-[var(--line-soft)] lg:shadow-[var(--shadow-soft)]',
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
              'flex items-center gap-2 border-l border-[var(--line-soft)] px-2.5 py-1.5 first:border-l-0 sm:gap-2.5 sm:px-3 sm:py-2.5',
              COLUMN,
            )}
          >
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border sm:h-8 sm:w-8"
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
              style={{ top: `max(calc(${top(m)} - 7px), 2px)` }}
            >
              {formatMinutes(m)}
            </span>
          ))}
          {nowLabel ? (
            <span
              className="tabular absolute right-2 text-[0.625rem] font-medium text-[var(--accent)]"
              style={{ top: `calc(${top(nowMin!)} - 6px)` }}
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
                  span={span}
                />

                {column.absences.map((absence, index) => (
                  <div
                    key={index}
                    className="absolute inset-x-0 z-[1] bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--line)_5px,var(--line)_6px)]"
                    style={{
                      top: top(Math.max(absence.start, fromMin)),
                      height: span(
                        Math.min(absence.end, toMin) -
                          Math.max(absence.start, fromMin),
                      ),
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
                      span={span}
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
  span,
}: {
  block: AgendaBlock
  color: string
  selected: boolean
  href: string
  top: (min: number) => string
  span: (minutes: number) => string
}) {
  const minutes = block.blockEndMin - block.blockStartMin
  /*
    O SEGUNDO ANDAR DO BLOCO MEDE-SE EM MINUTOS, NÃO EM PÍXEIS.
    A altura já não se sabe daqui — depende da escala que o CSS
    escolher para o ecrã que estiver a ler. O que se sabe é a duração,
    e uma marcação de menos de quarenta minutos não tem chão para duas
    linhas de texto em escala nenhuma.
  */
  const compact = minutes < 40

  return (
    <Link
      href={href}
      scroll={false}
      className={clsx(
        'absolute inset-x-1 z-[2] block min-h-[22px] overflow-hidden rounded-[var(--radius)] border py-0.5 pl-2 pr-1 sm:inset-x-1.5 sm:pl-2.5 sm:pr-1.5',
        'transition-shadow duration-200 hover:z-[5] hover:shadow-[var(--shadow-soft)]',
        TONE_STYLE[AGENDA_TONE[block.status]],
        selected && 'z-[6] shadow-[var(--shadow-soft)] ring-1 ring-[var(--accent)]',
      )}
      // Os dois píxeis a menos são a greta entre um bloco e o seguinte:
      // sem ela, duas marcações encostadas leem-se como uma só.
      style={{
        top: top(block.blockStartMin),
        height: `calc(${span(minutes)} - 2px)`,
      }}
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
  span,
}: {
  schedule: { start: number; end: number }[]
  fromMin: number
  toMin: number
  top: (min: number) => string
  span: (minutes: number) => string
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
            height: span(gap.end - gap.start),
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
