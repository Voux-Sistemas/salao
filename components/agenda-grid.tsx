import Link from 'next/link'
import clsx from 'clsx'
import type { AgendaBlock, AgendaDay } from '@/lib/agenda'
import type { Status } from '@/lib/booking'
import { merge, subtract, type Interval } from '@/lib/intervals'
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
 * NO TELEMÓVEL O MÍNIMO É APERTADO DE PROPÓSITO. A primeira tentativa
 * de grelha no telemóvel deu colunas de 140px com o nome cortado ao
 * meio e o resto do dia a fugir de lado; a resposta a isso não foi
 * desistir da grelha (a lista esconde os buracos, e os buracos são a
 * informação), foi deixar a coluna encolher até caberem TODAS no ecrã:
 * a 5rem, quatro profissionais mais a régua são 368px — cabem num
 * telemóvel de 390. O que se faz a uma coluna assim tão estreita não
 * se decide aqui: decide-o a própria coluna, por container query
 * (`coluna-agenda` no globals.css), mostrando só o que ainda se lê.
 */
const COLUMN = 'min-w-[5rem] flex-1 basis-[8.5rem] sm:min-w-[14rem] sm:basis-[14rem]'

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
  encaixeHref,
  nowMin,
}: {
  agenda: AgendaDay
  /** display_color de cada profissional, por staffId. */
  colors: Record<string, string>
  selectedId: string | null
  /** Como se abre o painel lateral de uma marcação. */
  hrefFor: (appointmentId: string | null) => string
  /**
   * Como se abre o encaixe já com uma hora na mão — ou null para quem
   * não pode marcar (as profissionais veem a agenda, não a escrevem).
   * Com isto, os buracos da grelha passam a ser tocáveis: meia hora
   * livre é um convite, não só um espaço em branco.
   */
  encaixeHref: ((hm: string) => string) | null
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
        {/*
          Cada célula é um contentor (`coluna-agenda`): quando a coluna
          aperta, é o CSS de `cab-coluna` que a põe ao alto — medalhão em
          cima, primeiro nome por baixo, escala escondida. Uma container
          query não pode estilizar o próprio contentor, só o que está lá
          dentro — daí o embrulho.
        */}
        {columns.map((column) => (
          <div
            key={column.staffId}
            className={clsx(
              'coluna-agenda border-l border-[var(--line-soft)] first:border-l-0',
              COLUMN,
            )}
          >
            <div className="cab-coluna flex items-center gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-3.5 sm:py-3">
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
                <p className="cab-escala tabular truncate text-[0.625rem] tracking-[0.04em] text-[var(--ink-faint)]">
                  {scheduleLabel(column.schedule)}
                </p>
              </div>
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
                  'coluna-agenda relative h-full border-l border-[var(--line)] first:border-l-0',
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

                {/*
                  OS BURACOS SÃO TOCÁVEIS. Meia hora livre na escala é
                  uma célula invisível que abre o encaixe já com o dia e
                  a hora postos — o gesto de marcar passa a começar onde
                  a dona já está a olhar. No monitor, pousar o rato
                  mostra «+ 14:30»; no telemóvel não se vê nada e não
                  faz falta: o dedo cai no branco e o encaixe abre.
                */}
                {encaixeHref
                  ? freeWindows(column, blocks, fromMin, toMin).flatMap(
                      (window) => {
                        const cells = []
                        for (
                          let m = Math.ceil(window.start / 30) * 30;
                          m + 15 <= window.end;
                          m += 30
                        ) {
                          const len = Math.min(30, window.end - m)
                          cells.push(
                            <Link
                              key={m}
                              href={encaixeHref(formatMinutes(m))}
                              scroll={false}
                              aria-label={`Encaixe às ${formatMinutes(m)}`}
                              className="absolute inset-x-0.5 z-[1] flex items-center justify-center rounded-[7px] text-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] hover:text-[var(--accent)] focus-visible:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                              style={{
                                top: top(m),
                                height: `calc(${span(len)} - 2px)`,
                              }}
                            >
                              <span className="tabular text-[0.6875rem] font-medium">
                                + {formatMinutes(m)}
                              </span>
                            </Link>,
                          )
                        }
                        return cells
                      },
                    )
                  : null}

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
    (no telemóvel a escala é 1,0 — mas aí a coluna estreita já reduziu
    o bloco ao nome, e os andares extra escondem-se por CSS). Uma linha de nome mede uns
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
        // `bloco-marcacao`: numa coluna apertada o CSS tira-lhe o
        // respiro lateral — cada píxel passa a ser do nome da cliente.
        'bloco-marcacao group absolute inset-x-1 z-[2] flex min-h-[20px] flex-col overflow-hidden rounded-[9px] border py-1 pl-3 pr-2 sm:inset-x-1.5 sm:pl-3.5 sm:pr-2.5',
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

      {/*
        Na coluna apertada sobra SÓ O NOME: a hora já a diz a posição do
        bloco (e a régua ali ao lado confirma-a), o serviço e o rodapé
        não cabem sem partir letras. É o CSS do contentor que os apaga —
        `bloco-hora`, `bloco-servico`, `bloco-rodape`.
      */}
      <span className="flex items-baseline gap-1.5">
        <span className="bloco-hora tabular shrink-0 text-[0.6875rem] font-medium text-[var(--ink-muted)]">
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
        <span className="bloco-servico mt-px block truncate text-[0.6875rem] leading-snug text-[var(--ink-muted)]">
          {block.serviceName}
          {block.itemCount > 1 ? ` +${block.itemCount - 1}` : ''}
        </span>
      ) : null}

      {andares === 3 ? (
        <span className="bloco-rodape mt-auto flex items-baseline gap-2 pt-1">
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

/**
 * O QUE SOBRA DA ESCALA: escala, menos marcações, menos ausências.
 *
 * É o negativo da agenda — e é a informação que a casa mais consulta:
 * «onde é que ainda cabe alguém hoje?». As canceladas e as faltas não
 * ocupam a cadeira, por isso não tapam buraco nenhum.
 */
function freeWindows(
  column: AgendaDay['columns'][number],
  blocks: AgendaBlock[],
  fromMin: number,
  toMin: number,
): Interval[] {
  const busy = blocks
    .filter(
      (b) =>
        b.staffId === column.staffId &&
        b.status !== 'no_show' &&
        !b.status.startsWith('cancel'),
    )
    .map((b) => ({ start: b.blockStartMin, end: b.blockEndMin }))

  return subtract(
    subtract(column.schedule, merge(busy)),
    column.absences,
  ).flatMap((window) => {
    const start = Math.max(window.start, fromMin)
    const end = Math.min(window.end, toMin)
    return end > start ? [{ start, end }] : []
  })
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
// A LISTA DO DIA — o dia cartão a cartão, com a hora grande à esquerda.
//
// Já foi a vista obrigatória do telemóvel; agora é uma ESCOLHA (`?v=`),
// porque a grelha aprendeu a caber no ecrã. A lista continua a ser a
// melhor maneira de LER o dia — quem vem, o que faz, quanto paga — e
// a pior de ver onde ele tem espaço; por isso, quando mostra uma
// profissional só, os buracos entram como linhas próprias. Quando há
// mais do que uma, cada cartão diz de quem é — pelo nome e pela cor,
// a mesma cor da pastilha lá em cima.
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

/** Uma linha da lista: um cartão de marcação, ou um buraco livre. */
type ListRow =
  | { kind: 'card'; startMin: number; card: DayCard }
  | { kind: 'gap'; startMin: number; endMin: number }

export function AgendaList({
  agenda,
  colors,
  hrefFor,
  encaixeHref,
  nowMin,
}: {
  agenda: AgendaDay
  /** display_color de cada profissional, por staffId. */
  colors: Record<string, string>
  hrefFor: (appointmentId: string | null) => string
  /** Como na grelha: null para quem só pode ver a agenda. */
  encaixeHref: ((hm: string) => string) | null
  nowMin: number | null
}) {
  const cards = toCards(agenda.blocks)
  /** Com uma coluna só, dizer de quem é em cada cartão é dizê-lo 12 vezes. */
  const mostrarQuem = agenda.columns.length > 1
  const nomes = new Map(agenda.columns.map((c) => [c.staffId, c.name]))

  /*
    A LISTA DIZIA SÓ O QUE ESTÁ MARCADO — E O NEGÓCIO VIVE DO RESTO.
    Com uma profissional no ecrã, os buracos da escala dela entram na
    lista como linhas próprias: hora, um tracejado, e quanto tempo é.
    Com várias profissionais os buracos sobrepõem-se uns aos outros e
    uma lista única mentiria — aí quem quer ver buracos tem a grelha.
  */
  const gaps =
    agenda.columns.length === 1
      ? freeWindows(
          agenda.columns[0]!,
          agenda.blocks,
          agenda.fromMin,
          agenda.toMin,
        ).filter((gap) => gap.end - gap.start >= 15)
      : []

  if (cards.length === 0) {
    return <Empty title="Dia livre" hint="Não há nenhuma marcação neste dia." />
  }

  const rows: ListRow[] = [
    ...cards.map((card) => ({
      kind: 'card' as const,
      startMin: card.startMin,
      card,
    })),
    ...gaps.map((gap) => ({
      kind: 'gap' as const,
      startMin: gap.start,
      endMin: gap.end,
    })),
  ].sort((a, b) => a.startMin - b.startMin)

  // O fio de «agora» entra entre o que já passou e o que vem a seguir.
  const nowIndex =
    nowMin === null ? -1 : rows.findIndex((r) => r.startMin >= nowMin)

  return (
    <ol className="bg-[var(--surface-raised)]">
      {rows.map((row, index) => {
        if (row.kind === 'gap') {
          return (
            <li
              key={`livre-${row.startMin}`}
              className="border-b border-[var(--line-soft)]"
            >
              {index === nowIndex ? <NowRule nowMin={nowMin!} /> : null}
              <GapRow
                startMin={row.startMin}
                endMin={row.endMin}
                encaixeHref={encaixeHref}
                nowMin={nowMin}
              />
            </li>
          )
        }

        const { card } = row
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

/**
 * Um buraco na lista: a hora, um tracejado, e quanto tempo é. Para quem
 * pode marcar é também uma porta — toca-se e o encaixe abre já com a
 * hora na mão. Se o dia é hoje e o buraco já começou, a hora que se
 * leva é a próxima meia hora, não uma que já passou; um buraco todo
 * passado deixa de ser porta e fica só o registo.
 */
function GapRow({
  startMin,
  endMin,
  encaixeHref,
  nowMin,
}: {
  startMin: number
  endMin: number
  encaixeHref: ((hm: string) => string) | null
  nowMin: number | null
}) {
  const handMin =
    nowMin !== null && nowMin > startMin
      ? Math.ceil(nowMin / 30) * 30
      : startMin
  const aproveitavel = handMin + 15 <= endMin
  const corpo = (
    <>
      <span className="tabular w-[3.75rem] shrink-0 text-right text-[0.75rem] font-medium">
        {formatMinutes(startMin)}
      </span>
      <span
        aria-hidden
        className="h-px flex-1 border-t border-dashed border-[var(--line)]"
      />
      <span className="tabular shrink-0 text-[0.6875rem]">
        {dur(endMin - startMin)} livre
      </span>
    </>
  )

  if (!encaixeHref || !aproveitavel) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 text-[var(--ink-faint)] opacity-80">
        {corpo}
      </div>
    )
  }

  return (
    <Link
      href={encaixeHref(formatMinutes(handMin))}
      scroll={false}
      className="flex items-center gap-3 px-4 py-2 text-[var(--ink-faint)] transition-colors active:bg-[var(--surface-2)]"
    >
      {corpo}
      <span className="shrink-0 text-[0.6875rem] font-semibold text-[var(--accent)]">
        + Encaixe
      </span>
    </Link>
  )
}

/** "2h05" / "45m" — a duração no corpo mais curto que ela tem. */
function dur(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
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
