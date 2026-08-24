import Link from 'next/link'
import clsx from 'clsx'
import type { AgendaBlock, AgendaDay } from '@/lib/agenda'
import type { Status } from '@/lib/booking'
import { formatMinutes } from '@/lib/time'
import { formatCents } from '@/lib/money'
import { STATUS_LABEL, type Tone } from '@/lib/status'
import { initial, shortName } from '@/lib/text'
import { Empty } from '@/components/ui'
import { Monogram } from '@/components/brand'
import { IconCheck } from '@/components/desk-icons'

/**
 * A GRELHA DO DIA: uma coluna por profissional, hora à esquerda.
 *
 * Desenha-se em minutos: um minuto vale `--esc` píxeis. O bloco de
 * ocupação (folgas incluídas) é o rectângulo desenhado; o horário do
 * serviço é o que se escreve lá dentro. A régua das horas fica presa à
 * esquerda e o cabeçalho das colunas ao topo — a grelha desliza por
 * baixo dos dois.
 *
 * A GRELHA É UMA FOLHA DE PAPEL POUSADA NA SECRETÁRIA. Onde há escala,
 * é branca; fora da escala vê-se a mesa por baixo. Era ao contrário —
 * o fora-de-escala era a coisa mais escura do ecrã — e o resultado é
 * que a primeira coisa que a vista encontrava numa agenda era o tempo
 * em que ninguém trabalha.
 */

/**
 * PÍXEIS POR MINUTO — E QUEM OS DECIDE É O CSS, NÃO ESTE FICHEIRO.
 *
 * A escala vive na variável `--esc`, posta na folha de estilo pela
 * classe `grelha-dia`. Por isso tudo aqui se escreve em `calc()` a
 * partir de minutos, e não em píxeis já contados do lado do servidor:
 * o servidor não sabe a largura do ecrã, e não tem de saber.
 */
/** Largura da régua das horas (w-12/w-14). */
const RAIL = 'w-12 sm:w-14'
/**
 * Largura de cada coluna. Com poucas profissionais esticam para encher
 * o dia — uma agenda que não chega à margem lê-se como inacabada; com
 * muitas encolhem até ao mínimo e a grelha passa a deslizar na
 * horizontal.
 *
 * A grelha só aparece a partir de `md`: no telemóvel o dia é uma lista.
 * Por isso o mínimo pode ser largo — não há aqui nenhum ecrã de 390px
 * a tentar caber três colunas ao mesmo tempo.
 */
const COLUMN = 'min-w-[11rem] flex-1 basis-[11rem] sm:min-w-[14rem] sm:basis-[14rem]'

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

/**
 * O RECHEIO DO BLOCO É UM SUSSURRO; QUEM GRITA É O FIO DA ESQUERDA.
 *
 * Todos os tons estavam a dez por cento de tinta sobre branco, o que
 * numa agenda cheia dá cinco lavados que ninguém distingue de relance —
 * era essa a queixa. A saída não foi encher os blocos de cor (uma
 * agenda aos quadrados berrantes não é uma agenda de um salão): foi
 * separar os dois trabalhos. O fundo diz o peso — feito, a decorrer,
 * por confirmar. O fio saturado de 4px à esquerda diz o estado, e
 * lê-se ao metro de distância mesmo num bloco de quinze minutos onde
 * não cabe uma palavra.
 *
 * «Concluída» perde a cor de propósito: passa a papel cinzento com o
 * fio verde. O que já aconteceu recua, e a tarde que falta fica a ser
 * a coisa mais viva no ecrã — que é para isso que se olha para a
 * agenda às quatro da tarde.
 */
const TONE_STYLE: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-raised)] border-[var(--line)] text-[var(--ink)]',
  accent:
    'bg-[color-mix(in_srgb,var(--accent)_13%,var(--surface-raised))] border-[color-mix(in_srgb,var(--accent)_32%,transparent)] text-[var(--ink)]',
  ok: 'bg-[color-mix(in_srgb,var(--ok)_7%,var(--surface-2))] border-[color-mix(in_srgb,var(--ok)_22%,transparent)] text-[var(--ink-muted)]',
  warn:
    'bg-[color-mix(in_srgb,var(--warn)_20%,var(--surface-raised))] border-[color-mix(in_srgb,var(--warn)_44%,transparent)] text-[var(--ink)]',
  bad: 'bg-[color-mix(in_srgb,var(--bad)_9%,var(--surface-raised))] border-[color-mix(in_srgb,var(--bad)_30%,transparent)] text-[var(--ink-muted)]',
}

/** A cor de fio que cada tom usa: o fio do bloco, a barra da lista. */
const TONE_BAR: Record<Tone, string> = {
  neutral: 'var(--ink-faint)',
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
}

/** A cor da palavra do estado, escrita em corpo miúdo dentro do bloco. */
const TONE_INK: Record<Tone, string> = {
  neutral: 'text-[var(--ink-faint)]',
  accent: 'text-[var(--accent)]',
  ok: 'text-[var(--ok)]',
  warn: 'text-[var(--warn)]',
  bad: 'text-[var(--bad)]',
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
        'grelha-dia w-full min-w-min bg-[var(--surface-raised)]',
        columns.length === 1 &&
          'mx-auto max-w-3xl border-x border-[var(--line-soft)] lg:shadow-[var(--shadow-soft)]',
      )}
    >
      {/* cabeçalho das colunas ------------------------------------ */}
      <div className="sticky top-0 z-30 flex border-b border-[var(--line)] bg-[var(--surface-raised)]">
        {/* O `sticky` já serve de âncora ao fio de ouro aqui em baixo. */}
        {/*
          O FIO DA CASA POR BAIXO DOS NOMES.
          É o mesmo ouro do monograma no canto do ecrã e do fio que
          fecha os títulos da gestão. Custa um píxel e é o que faz esta
          grelha pertencer a esta casa em vez de ser a tabela genérica
          de qualquer sistema de marcações.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-[linear-gradient(90deg,color-mix(in_srgb,var(--house)_70%,transparent),color-mix(in_srgb,var(--house)_22%,transparent)_45%,transparent)]"
        />
        <div
          className={clsx(
            'sticky left-0 z-10 shrink-0 border-r border-[var(--line)] bg-[var(--surface-raised)]',
            RAIL,
          )}
        />
        {columns.map((column) => (
          <div
            key={column.staffId}
            className={clsx(
              'flex items-center gap-2 border-l border-[var(--line-soft)] px-2.5 py-2 first:border-l-0 sm:gap-2.5 sm:px-3.5 sm:py-3',
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
              <p className="truncate text-[0.8125rem] font-semibold tracking-[0.005em] text-[var(--ink)]">
                {shortName(column.name)}
              </p>
              <p className="tabular truncate text-[0.625rem] tracking-[0.04em] text-[var(--ink-faint)]">
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
            'sticky left-0 z-20 shrink-0 border-r border-[var(--line)] bg-[var(--surface)]',
            RAIL,
          )}
          style={{ height }}
        >
          {hours.map((m) => (
            <span
              key={m}
              className="tabular absolute right-2 text-[0.6875rem] font-medium tracking-[0.02em] text-[var(--ink-faint)]"
              // A etiqueta centra-se no fio, menos a primeira: essa
              // subia para fora da caixa e ficava cortada ao meio pelo
              // cabeçalho das colunas.
              style={{ top: `max(calc(${top(m)} - 7px), 2px)` }}
            >
              {formatMinutes(m)}
            </span>
          ))}
          {/*
            A HORA DE AGORA TAPA A HORA CERTA, EM VEZ DE FUGIR DELA.
            Antes escondia-se sempre que caía perto de uma hora redonda —
            e às 16:58 a única marca que interessa desaparecia. Agora é
            uma pastilha cheia, opaca, por cima: sobrepõe-se ao 17:00 sem
            pedir licença, e encontra-se num relance.
          */}
          {nowVisible ? (
            <span
              className="tabular absolute right-1.5 z-10 rounded-full bg-[var(--accent)] px-1.5 py-px text-[0.625rem] font-semibold text-white shadow-[0_1px_3px_rgba(28,24,21,0.25)]"
              style={{ top: `calc(${top(nowMin!)} - 8px)` }}
            >
              {formatMinutes(nowMin!)}
            </span>
          ) : null}
        </div>

        {/* a tela onde tudo se desenha */}
        <div className="relative flex-1" style={{ height }}>
          {/*
            A BATIDA DO DIA: A HORA É UM FIO, A MEIA HORA É UM PONTEADO.
            Eram os dois o mesmo cinzento claro, um deles a metade da
            opacidade — o que na prática dava um fio a cada trinta
            minutos, todos iguais, e nenhuma maneira de contar as horas
            sem ir ler a régua. Com a meia hora a tracejado a vista
            apanha o compasso sozinha.
          */}
          {hours.map((m) => (
            <div key={m}>
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-[var(--line)]"
                style={{ top: top(m) }}
              />
              {m + 30 <= toMin ? (
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--line-soft)]"
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
                  'relative h-full border-l border-[var(--line)] first:border-l-0',
                  COLUMN,
                )}
              >
                {/* fora da escala vê-se a mesa por baixo do papel */}
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
                      selected={selectedId === block.appointmentId}
                      href={hrefFor(block.appointmentId)}
                      top={top}
                      span={span}
                    />
                  ))}
              </div>
            ))}
          </div>

          {/* a linha de agora — atravessa o dia e não se confunde com uma hora */}
          {nowVisible ? (
            <div
              className="pointer-events-none absolute inset-x-0 z-10"
              style={{ top: top(nowMin!) }}
            >
              <div className="h-[2px] bg-[var(--accent)] opacity-90" />
              <span className="absolute -left-[1px] -top-[3px] block h-2 w-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-raised)]" />
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
  selected,
  href,
  top,
  span,
}: {
  block: AgendaBlock
  selected: boolean
  href: string
  top: (min: number) => string
  span: (minutes: number) => string
}) {
  const minutes = block.blockEndMin - block.blockStartMin
  const tone = AGENDA_TONE[block.status]
  /*
    OS ANDARES DO BLOCO MEDEM-SE EM MINUTOS, NÃO EM PÍXEIS.
    A altura já não se sabe daqui — depende da escala que o CSS escolher
    para o ecrã que estiver a ler. O que se sabe é a duração:

      até 38 min   uma linha, e o serviço fica no `title`
      até 55 min   hora + nome, e o serviço por baixo
      daí para cima  ainda cabe o rodapé com o estado por extenso

    As contas são a 1,25 píxeis por minuto, que é a escala do monitor
    (no telemóvel não há grelha nenhuma). Uma linha de nome mede uns
    dezassete píxeis e a do serviço quinze; com o respiro e o fio da
    borda, o segundo andar precisa de quarenta e sete píxeis para não
    sair cortado a meio das letras, e o terceiro de sessenta e nove.

    Sem o terceiro andar, um bloco de hora e meia num monitor largo era
    seiscentos píxeis de vazio com duas palavras no canto superior
    esquerdo. Não é elegância, é uma folha por preencher.
  */
  const andares = minutes >= 55 ? 3 : minutes >= 38 ? 2 : 1
  /** Está a acontecer agora: é o único que merece um anel à volta. */
  const aDecorrer = block.status === 'in_service'
  const falhou = block.status === 'no_show' || block.status.startsWith('cancel')

  return (
    <Link
      href={href}
      scroll={false}
      className={clsx(
        'group absolute inset-x-1 z-[2] flex min-h-[20px] flex-col overflow-hidden rounded-[9px] border py-1 pl-3 pr-2 sm:inset-x-1.5 sm:pl-3.5 sm:pr-2.5',
        'transition-shadow duration-200 hover:z-[5] hover:shadow-[0_2px_4px_-1px_rgba(46,38,28,0.10),0_12px_24px_-14px_rgba(46,38,28,0.45)]',
        'focus-visible:z-[6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        TONE_STYLE[tone],
        aDecorrer &&
          'ring-1 ring-inset ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]',
        selected && 'z-[6] shadow-[var(--shadow-soft)] ring-2 ring-[var(--accent)]',
      )}
      // Os dois píxeis a menos são a greta entre um bloco e o seguinte:
      // sem ela, duas marcações encostadas leem-se como uma só.
      style={{
        top: top(block.blockStartMin),
        height: `calc(${span(minutes)} - 2px)`,
      }}
      title={`${formatMinutes(block.startMin)}–${formatMinutes(block.endMin)} · ${block.clientName} · ${block.serviceName} · ${STATUS_LABEL[block.status]}`}
    >
      {/*
        O FIO DO ESTADO. Era a cor da profissional — que a coluna já diz
        em cima, com o nome e o monograma ao lado. Repeti-la em cada
        bloco gastava o único sítio da peça onde uma cor saturada se
        pode pôr sem sujar nada.
      */}
      <span
        aria-hidden
        className={clsx('absolute inset-y-0 left-0', aDecorrer ? 'w-[5px]' : 'w-[4px]')}
        style={{ background: TONE_BAR[tone] }}
      />

      <span className="flex items-baseline gap-1.5">
        <span className="tabular shrink-0 text-[0.6875rem] font-medium text-[var(--ink-muted)]">
          {formatMinutes(block.startMin)}
        </span>
        <span
          className={clsx(
            'truncate text-[0.8125rem] font-semibold leading-snug',
            falhou && 'line-through decoration-[var(--ink-faint)]',
          )}
        >
          {block.clientName}
        </span>
        {/* O fim do serviço só se escreve onde há largura para ele. */}
        <span className="tabular ml-auto hidden shrink-0 pl-2 text-[0.625rem] text-[var(--ink-faint)] lg:block">
          {formatMinutes(block.endMin)}
        </span>
        {block.confirmSent ? (
          <IconCheck
            className="ml-auto h-3 w-3 shrink-0 self-center text-[var(--ink-faint)] lg:ml-1"
            aria-label="Confirmação enviada"
          />
        ) : null}
      </span>

      {andares >= 2 ? (
        <span className="mt-px block truncate text-[0.6875rem] leading-snug text-[var(--ink-muted)]">
          {block.serviceName}
          {block.itemCount > 1 ? ` +${block.itemCount - 1}` : ''}
        </span>
      ) : null}

      {andares === 3 ? (
        <span className="mt-auto flex items-baseline gap-2 pt-1">
          <span
            className={clsx(
              'truncate text-[0.5625rem] font-semibold uppercase tracking-[0.11em]',
              TONE_INK[tone],
            )}
          >
            {STATUS_LABEL[block.status]}
          </span>
          <span className="tabular ml-auto shrink-0 text-[0.6875rem] text-[var(--ink-faint)]">
            {formatCents(block.priceCents)}
          </span>
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

/**
 * Fora da escala desta profissional o papel acaba e vê-se a mesa.
 *
 * Era um cinzento cheio, mais escuro do que tudo o resto — o que fazia
 * do tempo em que ninguém trabalha a mancha mais pesada do ecrã. Passa
 * a ser o tom do fundo da casa com um riscado quase invisível: lê-se
 * como «aqui não há folha», recua, e deixa de competir com as marcações.
 */
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
          className="grelha-fora absolute inset-x-0"
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
// A LISTA DO DIA — o dia no telemóvel, cartão a cartão, com a hora
// grande à esquerda.
//
// NO TELEMÓVEL A GRELHA NÃO SE LÊ, E NÃO É SÓ NA VISTA DA PROFISSIONAL.
// Três colunas numa tela de 390px dão cento e quarenta píxeis cada, com
// o nome cortado ao meio e o dia a fugir para fora do ecrã de lado.
// Passa a ser esta lista para toda a gente; quando há mais do que uma
// profissional no ecrã, cada cartão diz de quem é — pelo nome e pela
// cor, a mesma cor da pastilha lá em cima.
// ---------------------------------------------------------------------

type DayCard = {
  appointmentId: string
  staffId: string
  startMin: number
  endMin: number
  clientName: string
  services: string
  priceCents: number
  status: Status
  confirmSent: boolean
}

export function AgendaList({
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
  const cards = toCards(agenda.blocks)
  /** Com uma coluna só, dizer de quem é em cada cartão é dizê-lo 12 vezes. */
  const mostrarQuem = agenda.columns.length > 1
  const nomes = new Map(agenda.columns.map((c) => [c.staffId, c.name]))

  if (cards.length === 0) {
    return <Empty title="Dia livre" hint="Não há nenhuma marcação neste dia." />
  }

  // O fio de «agora» entra entre o que já passou e o que vem a seguir.
  const nowIndex =
    nowMin === null ? -1 : cards.findIndex((c) => c.startMin >= nowMin)

  return (
    <ol className="bg-[var(--surface-raised)]">
      {cards.map((card, index) => {
        const tone = AGENDA_TONE[card.status]
        const falhou =
          card.status === 'no_show' || card.status.startsWith('cancel')
        const passou = nowMin !== null && card.endMin <= nowMin

        return (
          <li
            key={card.appointmentId}
            className="border-b border-[var(--line-soft)]"
          >
            {index === nowIndex ? <NowRule nowMin={nowMin!} /> : null}
            <Link
              href={hrefFor(card.appointmentId)}
              scroll={false}
              className={clsx(
                'flex items-stretch gap-3 px-4 py-3.5 transition-colors active:bg-[var(--surface-2)]',
                // O que já acabou apaga-se um pouco: a lista do dia é
                // sobretudo uma lista do que falta.
                passou && !falhou && 'opacity-65',
              )}
            >
              <span className="w-[3.75rem] shrink-0 pt-0.5 text-right">
                <span className="tabular block text-[1.375rem] font-semibold leading-none tracking-[-0.01em] text-[var(--ink)]">
                  {formatMinutes(card.startMin)}
                </span>
                <span className="tabular mt-1 block text-[0.625rem] text-[var(--ink-faint)]">
                  {formatMinutes(card.endMin)}
                </span>
              </span>

              {/* o fio do estado, a toda a altura do cartão */}
              <span
                aria-hidden
                className="w-[3px] shrink-0 rounded-full"
                style={{ background: TONE_BAR[tone] }}
              />

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className={clsx(
                      'min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-[var(--ink)]',
                      falhou && 'line-through decoration-[var(--ink-faint)]',
                    )}
                  >
                    {card.clientName}
                  </span>
                  <span className="tabular shrink-0 text-[0.75rem] text-[var(--ink-faint)]">
                    {formatCents(card.priceCents)}
                  </span>
                </span>

                <span className="mt-0.5 block line-clamp-2 text-[0.8125rem] leading-snug text-[var(--ink-muted)]">
                  {card.services}
                </span>

                <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    className={clsx(
                      'text-[0.5625rem] font-semibold uppercase tracking-[0.11em]',
                      TONE_INK[tone],
                    )}
                  >
                    {STATUS_LABEL[card.status]}
                  </span>
                  {mostrarQuem ? (
                    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-[var(--ink-faint)]">
                      <span
                        aria-hidden
                        className="block h-1.5 w-1.5 rounded-full"
                        style={{
                          background: colors[card.staffId] ?? 'var(--gold)',
                        }}
                      />
                      {shortName(nomes.get(card.staffId) ?? '')}
                    </span>
                  ) : null}
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
        )
      })}
      {nowIndex === -1 && nowMin !== null ? (
        <li>
          <NowRule nowMin={nowMin} />
          {/* Já passou tudo: vale a pena dizê-lo, em vez de deixar o
              ecrã a acabar num fio solto. */}
          <p className="px-4 pb-8 pt-5 text-center text-[0.8125rem] text-[var(--ink-faint)]">
            Nada mais para hoje.
          </p>
        </li>
      ) : null}
    </ol>
  )
}

function NowRule({ nowMin }: { nowMin: number }) {
  return (
    <div data-agora aria-hidden className="flex items-center gap-2 px-4 py-1.5">
      <span className="block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      <span className="h-[2px] flex-1 rounded-full bg-[var(--accent)] opacity-80" />
      <span className="tabular text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
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
        staffId: block.staffId,
        startMin: block.startMin,
        endMin: block.endMin,
        clientName: block.clientName,
        services: block.serviceName,
        priceCents: block.priceCents,
        status: block.status,
        confirmSent: block.confirmSent,
      })
    } else {
      found.endMin = Math.max(found.endMin, block.endMin)
      found.services = `${found.services} + ${block.serviceName}`
      found.priceCents += block.priceCents
    }
  }

  return [...byAppointment.values()].sort((a, b) => a.startMin - b.startMin)
}
