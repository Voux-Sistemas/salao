import Link from 'next/link'
import clsx from 'clsx'
import { Plus } from 'lucide-react'
import type { AgendaBlock, AgendaDay } from '@/lib/agenda'
import type { Status } from '@/lib/booking'
import { merge, subtract, type Interval } from '@/lib/intervals'
import { formatMinutes } from '@/lib/time'
import { formatCents } from '@/lib/money'
import { STATUS_LABEL, type Tone } from '@/lib/status'
import { initial, shortName } from '@/lib/text'
import { Empty } from '@/components/ui'
import { PassarPastilha, PassarTodas } from '@/components/passar-pastilha'
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
const COLUMN =
  'min-w-[var(--col-min)] flex-1 basis-[8.5rem] sm:min-w-[14rem] sm:basis-[14rem]'
/**
 * O MÍNIMO DA COLUNA NÃO É FIXO: PAGA-SE AS LOMBADAS COM ELE.
 *
 * As 5rem de origem estavam calibradas para uma grelha sem folgas —
 * quatro profissionais mais a régua davam 368px num ecrã de 390. Com as
 * lombadas a somar, esse mínimo deixou de chegar: medido no browser,
 * três a trabalhar mais cinco de folga pediam 388px de 356 disponíveis,
 * e o que se via era a última lombada cortada ao meio pela margem —
 * pior do que não a mostrar.
 *
 * A PRIMEIRA CORRECÇÃO FOI CONTAR PÍXEIS AQUI, E ESTAVA ERRADA. Partia
 * de 390 (o ecrã) quando o que a grelha tem é 356 — a agenda vive
 * dentro de um contentor com margem, e o servidor não sabe qual é. O
 * resultado foi encolher as colunas e continuar a transbordar por 30px.
 *
 * Quem sabe a largura é o CSS. Por isso o mínimo é uma conta em
 * `calc()`: cem por cento do que a grelha tem, menos a régua e as
 * lombadas — que são as únicas medidas fixas e conhecidas — a dividir
 * por quem trabalha. O servidor só diz QUANTAS lombadas há; a largura
 * fica com quem a tem.
 *
 * O `max()` com 3.5rem é o travão: abaixo disso a container query já
 * não tem onde escrever o nome e a coluna deixa de se ler. A partir
 * daí é melhor deslizar do que mostrar colunas ilegíveis.
 */
/** Régua das horas: `w-12` no telemóvel, `w-14` a partir de `sm`. */
const RAIL_PX = 48
/** Lombada de folga: `w-5` no telemóvel. */
const OFF_PX = 20
/** O travão do `max()` acima, em píxeis: abaixo disto não se lê. */
const COL_MIN_PX = 56
/** Coluna sem folgas nenhumas — a largura de sempre, `5rem`. */
const COL_SO_PX = 80

/**
 * A LARGURA QUE A GRELHA PRECISA, NO PIOR CASO.
 *
 * Mora aqui ao lado das medidas que a compõem para não poder
 * divergir delas: quem desenha a margem direita da agenda precisa de
 * saber, ao píxel, a partir de que largura de ecrã a grelha deixa de
 * caber — e essa conta tem de ser a MESMA que a `colMin` faz.
 */
export function larguraMinimaDaGrelha(working: number, off: number) {
  const col = off > 0 && working > 0 ? COL_MIN_PX : COL_SO_PX
  return RAIL_PX + working * col + off * OFF_PX
}

/**
 * AS HORAS EM QUE A CASA NÃO TEM NINGUÉM.
 *
 * Os buracos de cada profissional sobrepõem-se uns aos outros, e dizer
 * «livre» quando uma delas está ocupada seria mentira. A conta que não
 * mente a ninguém é outra: dentro do que está escalado (menos as
 * ausências), o tempo em que NINGUÉM tem nada marcado. É «casa livre»,
 * e é a coisa mais cara que a agenda tem para dizer — numa sexta com
 * catorze marcações, três horas de tarde sem ninguém não apareciam em
 * lado nenhum.
 *
 * Vive aqui, e não dentro da lista, porque o cabeçalho da página diz o
 * total no subtítulo e a lista desenha cada uma: são a mesma conta, e
 * duas contas parecidas acabam sempre por divergir.
 *
 * Menos de um quarto de hora não é buraco: é o intervalo entre duas
 * clientes, e anunciá-lo era encher a lista de linhas que ninguém pode
 * vender.
 *
 * Quem quer saber quem EM PARTICULAR está livre tem a grelha, que
 * responde por pessoa e não pela casa.
 */
export function casaLivre(agenda: AgendaDay): Interval[] {
  const trabalham = agenda.columns.filter((c) => !c.offDuty)

  const disponivel = merge(
    trabalham.flatMap((column) => subtract(column.schedule, column.absences)),
  )
  const ocupado = merge(
    agenda.blocks
      .filter((b) => b.status !== 'no_show' && !b.status.startsWith('cancel'))
      .map((b) => ({ start: b.blockStartMin, end: b.blockEndMin })),
  )

  return subtract(disponivel, ocupado)
    .flatMap((window) => {
      const start = Math.max(window.start, agenda.fromMin)
      const end = Math.min(window.end, agenda.toMin)
      return end > start ? [{ start, end }] : []
    })
    .filter((gap) => gap.end - gap.start >= 15)
}
/**
 * A COLUNA DE QUEM HOJE NÃO VEM.
 *
 * A dona quis a equipa toda à vista para ter o panorama da casa. O
 * risco óbvio disso é o dia de trabalho ficar espremido por causa de
 * quem não está a trabalhar — e aí o panorama custava mais do que
 * valia. Por isso a coluna de folga não é uma coluna a sério: é uma
 * lombada, o suficiente para o medalhão e para se perceber que aquela
 * pessoa existe e hoje não vem.
 *
 * NO TELEMÓVEL É UM RISCO, NÃO UMA LOMBADA. A primeira versão dava-lhe
 * 2.5rem em todo o lado, e a conta desmentiu-a: numa equipa de oito com
 * três a trabalhar, cinco folgas a 40px comiam 200 dos 390 píxeis do
 * ecrã — metade da agenda gasta a dizer quem NÃO está lá. A 1.25rem o
 * medalhão ainda se vê (é o que identifica a pessoa, pela cor), o nome
 * ao alto cala-se, e as mesmas cinco folgas passam a custar 100px.
 *
 * `shrink-0 grow-0` é o que segura isto: sem eles o `flex-1` das outras
 * colunas dividia o espaço em partes iguais e a folga voltava a ganhar
 * terreno.
 */
const COLUMN_OFF =
  'w-5 shrink-0 grow-0 basis-5 sm:w-11 sm:basis-11'

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

  /*
    NINGUÉM A TRABALHAR NÃO É O MESMO QUE NÃO HAVER GRELHA.

    Com a equipa toda pedida, um dia sem escala nenhuma traz na mesma
    uma lombada por pessoa — e cinco lombadas encostadas umas às outras,
    sem uma única coluna a que pertençam, não dizem nada a ninguém. O
    aviso é mais honesto, e nomeia quem hoje não vem para a pergunta
    ficar respondida sem se ir a lado nenhum.
  */
  if (columns.every((c) => c.offDuty)) {
    return (
      <Empty
        title="Ninguém escalado neste dia"
        hint={
          columns.length === 0
            ? 'A escala define-se em Gestão · Equipa, e tem vigência: trocar de escala é fechar a antiga e abrir uma nova.'
            : `De folga: ${columns.map((c) => shortName(c.name)).join(', ')}. A escala define-se em Gestão · Equipa.`
        }
      />
    )
  }

  /*
    A folha estreita e centrada é para o dia de UMA pessoa. Com a equipa
    toda ligada há mais colunas no ecrã, mas se só uma trabalha o dia
    continua a ser dela — são as lombadas de folga que a acompanham, e
    espalhar isso por um monitor inteiro não o tornava mais legível.
  */
  const working = columns.filter((c) => !c.offDuty).length
  const off = columns.length - working
  /*
    Só se aperta o mínimo quando há lombadas a pagar; sem folgas a
    grelha fica exactamente como estava antes desta funcionalidade.
  */
  const colMin =
    off > 0 && working > 0
      ? `max(3.5rem, calc((100% - ${RAIL_PX + off * OFF_PX}px) / ${working}))`
      : '5rem'

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
      style={{ '--col-min': colMin } as React.CSSProperties}
      className={clsx(
        'grelha-dia w-full min-w-min bg-[var(--surface-raised)]',
        working <= 1 &&
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
        {columns.map((column) =>
          column.offDuty ? (
            /*
              A LOMBADA DE QUEM ESTÁ DE FOLGA.

              Sem cabeçalho a sério: o medalhão diz quem é, o nome ao
              alto confirma-o a quem tiver dúvidas, e o `title` dá a
              resposta inteira a quem parar o rato. Fica esbatido de
              propósito — está na grelha para se contar a equipa, não
              para disputar o olhar com o dia de trabalho.
            */
            <div
              key={column.staffId}
              title={`${column.name} · folga`}
              className={clsx(
                'flex flex-col items-center gap-1 border-l border-[var(--line-soft)] bg-[var(--surface-2)]/40 px-0 py-1.5 first:border-l-0 sm:gap-1.5 sm:px-1 sm:py-3',
                COLUMN_OFF,
              )}
            >
              {/*
                No telemóvel o medalhão é um ponto da cor dela: a 20px de
                largura não há sítio para uma inicial que se leia, e uma
                letra ilegível dentro de um círculo é ruído. A cor chega
                para a reconhecer — é a mesma do chip lá em cima.
              */}
              <span
                aria-hidden
                className="flex h-2 w-2 shrink-0 items-center justify-center rounded-full border border-dashed opacity-60 sm:h-7 sm:w-7"
                style={{
                  color: colors[column.staffId] ?? 'var(--accent)',
                  borderColor: `color-mix(in srgb, ${colors[column.staffId] ?? 'var(--accent)'} 45%, transparent)`,
                  background: `color-mix(in srgb, ${colors[column.staffId] ?? 'var(--accent)'} 30%, transparent)`,
                }}
              >
                <span className="hidden sm:block">
                  <Monogram
                    initials={initial(column.name)}
                    className="text-[0.6875rem]"
                  />
                </span>
              </span>
              {/*
                O nome ao alto, a subir, como num rótulo de lombada — e
                só onde há largura para ele. `vertical-rl` é o modo que
                todos os navegadores conhecem (o `sideways-lr`, que dava
                isto de uma vez só, ainda não chegou ao Safari) e a
                rotação de meia volta endireita-o.
              */}
              <span
                className="hidden min-h-0 flex-1 overflow-hidden text-[0.625rem] font-medium tracking-[0.02em] text-[var(--ink-faint)] sm:block"
                style={{ writingMode: 'vertical-rl', rotate: '180deg' }}
              >
                {shortName(column.name)}
              </span>
              <span className="sr-only">{column.name}, de folga</span>
            </div>
          ) : (
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
          ),
        )}
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
            {columns.map((column) =>
              column.offDuty ? (
                /*
                  A FAIXA DE FOLGA NÃO TEM DIA DENTRO.

                  Nem células de encaixe — marcar a quem não vem hoje não
                  é um descuido que se conserte, é uma escala que se
                  muda primeiro. Quem quiser mesmo pôr lá alguém dá-lhe
                  escala na ficha e a coluna abre-se sozinha.
                */
                <div
                  key={column.staffId}
                  aria-hidden
                  className={clsx(
                    'relative h-full border-l border-[var(--line)] bg-[var(--surface-2)]/40 first:border-l-0',
                    COLUMN_OFF,
                  )}
                />
              ) : (
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
              ),
            )}
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
  /** Nulo quando marcou sem deixar número. Ver `semContacto` na linha. */
  clientPhone: string | null
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
  selectedId,
  hrefFor,
  encaixeHref,
  nowMin,
}: {
  agenda: AgendaDay
  /** display_color de cada profissional, por staffId. */
  colors: Record<string, string>
  /*
    A MARCAÇÃO ABERTA TAMBÉM SE ASSINALA AQUI.

    A grelha sempre soube qual é; a lista não, porque era o desvio e
    quase ninguém lá chegava com uma marcação na mão. Agora é a vista
    que abre, e chega-se-lhe do caixa, dos avisos e de um encaixe
    acabado de fazer, todos com `&m=` no endereço: o painel abria ao
    lado sem que nada na lista dissesse de onde tinha vindo.
  */
  selectedId: string | null
  hrefFor: (appointmentId: string | null) => string
  /** Como na grelha: null para quem só pode ver a agenda. */
  encaixeHref: ((hm: string) => string) | null
  nowMin: number | null
}) {
  const cards = toCards(agenda.blocks)
  /*
    A LISTA É O DIA, E QUEM ESTÁ DE FOLGA NÃO TEM DIA.

    Estas colunas vêm da grelha, que as mostra para se contar a equipa.
    Aqui não há nada para desenhar delas — não têm marcações nem buracos
    — e contá-las mudava as duas decisões que se tomam a seguir: com
    quatro folgas e uma pessoa ao balcão, os buracos DELA deixavam de
    aparecer e cada cartão passava a repetir um nome que já era o único.
  */
  const trabalham = agenda.columns.filter((c) => !c.offDuty)
  /** Com uma coluna só, dizer de quem é em cada cartão é dizê-lo 12 vezes. */
  const mostrarQuem = trabalham.length > 1
  const nomes = new Map(agenda.columns.map((c) => [c.staffId, c.name]))

  /*
    QUEM NÃO É GENTE. Os perfis-cadeira seguram as horas do domingo até
    se saber quem as faz; o trabalho deles lê-se «por atribuir» e não
    com um nome, e é o que a lista conta na linha de cima para dizer
    quanto falta repartir.
  */
  const cadeiras = new Set(
    agenda.columns.filter((c) => c.placeholder).map((c) => c.staffId),
  )


  const gaps = casaLivre(agenda)

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

  const porAtribuir = rows.filter(
    (r) => r.kind === 'card' && cadeiras.has(r.card.staffId),
  ).length

  /*
    O AGORA CAI QUASE SEMPRE DENTRO DE UM VAZIO — E ENTÃO SÃO A MESMA
    LINHA.

    Duas marcas encostadas, o fio do relógio e o buraco, diziam a mesma
    coisa duas vezes. Juntas dizem a única que interessa: quanto tempo
    há por vender daqui até à próxima cliente. Quando o agora cai mesmo
    entre duas marcações coladas, o fio volta a aparecer sozinho.
  */
  const idxAgoraNoVazio =
    nowMin === null
      ? -1
      : rows.findIndex(
          (r) => r.kind === 'gap' && r.startMin <= nowMin && nowMin < r.endMin,
        )
  const idxAgora =
    nowMin === null || idxAgoraNoVazio !== -1
      ? -1
      : rows.findIndex((r) => r.startMin >= nowMin)
  /** Já passou tudo: não caiu num vazio nem antes de uma marcação. */
  const agoraNoFim =
    nowMin !== null && idxAgoraNoVazio === -1 && idxAgora === -1

  return (
    <div className="bg-[var(--surface-raised)]">
      {/*
        A LINHA DO DIA, E SÓ COM DUAS OU MAIS.

        Com uma marcação por repartir, a pastilha da própria linha é
        mais curta do que qualquer atalho. Com quatro — o domingo em que
        foi uma pessoa só — é um toque contra quatro.
      */}
      {porAtribuir > 1 ? (
        <PassarTodas
          quantas={porAtribuir}
          marcacoes={[
            ...new Set(
              rows
                .filter(
                  (r) => r.kind === 'card' && cadeiras.has(r.card.staffId),
                )
                .map((r) => (r as { card: DayCard }).card.appointmentId),
            ),
          ]}
          candidatos={agenda.columns
            .filter((c) => !c.placeholder && !c.offDuty)
            .map((c) => ({ staffId: c.staffId, name: c.name }))}
        />
      ) : null}

      <ol>
      {rows.map((row, index) => {
        if (row.kind === 'gap') {
          return (
            <li
              key={`livre-${row.startMin}`}
              className="border-b border-[var(--line-soft)] last:border-b-0"
            >
              {index === idxAgora ? <NowRule nowMin={nowMin!} /> : null}
              <GapRow
                startMin={row.startMin}
                endMin={row.endMin}
                encaixeHref={encaixeHref}
                nowMin={nowMin}
                agora={index === idxAgoraNoVazio ? nowMin : null}
              />
            </li>
          )
        }

        const { card } = row
        const tone = AGENDA_TONE[card.status]
        const falhou =
          card.status === 'no_show' || card.status.startsWith('cancel')
        const passou = nowMin !== null && card.endMin <= nowMin

        /*
          O ESTADO NORMAL CALA-SE.

          «Confirmada» em versalete tinha fila própria e repetia-se em
          catorze linhas seguidas: uma palavra que está sempre lá deixa
          de se ler, e continuava a pagar-se em altura. Agora só fala o
          que pede mão.

          · concluída — um visto verde ao pé do preço, sem palavra.
          · já passou e não foi concluída — «concluir», que é a única
            coisa que alguém tem de ir fazer ali. Dizia «fechar», da
            comanda por fechar; a comanda saiu, e concluir passou a ser
            o gesto que dá a marcação por feita E a faz contar no que a
            casa faturou nesse dia. Uma hora que passou sem isto é uma
            hora que não conta.
          · confirmada e ainda por vir — silêncio.
          · tudo o resto (chegou, em atendimento, faltou, cancelada) diz
            o seu nome, porque é excepção.
        */
        const concluida = card.status === 'completed'
        const etiqueta = concluida
          ? null
          : passou && !falhou
            ? { texto: 'concluir', tom: 'warn' as Tone }
            : card.status === 'confirmed'
              ? null
              : { texto: STATUS_LABEL[card.status], tom: tone }

        return (
          <li
            key={card.appointmentId}
            className="relative border-b border-[var(--line-soft)] last:border-b-0"
          >
            {index === idxAgora ? <NowRule nowMin={nowMin!} /> : null}
            {/*
              A LIGAÇÃO DEIXA DE ENVOLVER A LINHA E PASSA A COBRI-LA.

              Enquanto ela era a moldura, tudo o que estivesse dentro era
              parte dela — e um botão dentro de uma ligação não é HTML
              válido nem coisa que se possa tocar: o toque ia abrir a
              marcação em vez de fazer o que dizia.

              Agora a linha é uma caixa normal, e a ligação é uma folha
              transparente por cima dela. Tocar em qualquer sítio abre a
              marcação, como sempre; o que tiver de receber um toque
              próprio — a pastilha de quem faz — sobe acima da folha e
              fica de fora dela.
            */}
            <div
              className={clsx(
                // O mesmo ar nos dois: a linha é a mesma linha.
                'flex items-stretch gap-3 py-3 pr-4 transition-colors active:bg-[var(--surface-2)]',
                // O que já acabou apaga-se um pouco: a lista do dia é
                // sobretudo uma lista do que falta.
                passou && !falhou && 'opacity-65',
                /*
                  Na grelha a escolhida leva um anel à volta; aqui as
                  linhas encostam às duas margens e um anel ficaria
                  apertado contra elas. A marca é um fio na margem
                  esquerda e o fundo levantado — lê-se à mesma distância
                  e não empurra nada, porque o fio ocupa o sítio do
                  `pl-4` que a linha já tinha.
                */
                selectedId === card.appointmentId
                  ? 'border-l-4 border-[var(--accent)] bg-[var(--surface-2)] pl-3'
                  : 'border-l-4 border-transparent pl-3',
              )}
            >
              {/* O fio do estado abre a linha, à esquerda de tudo: é a
                  primeira coisa que o olho apanha ao descer a lista, e
                  responde antes de se ler — o que já foi está apagado, o
                  que vem a seguir está aceso. */}
              <span
                aria-hidden
                className="w-[3px] shrink-0 rounded-full"
                style={{ background: TONE_BAR[tone] }}
              />

              {/*
                A hora encolheu de 22px para 16. Era o tamanho de um
                título numa lista onde todas as linhas têm um — e o que
                se procura aqui é o nome, não o número.

                UMA COISA ESCURA POR LINHA, E É O NOME DA CLIENTE.
                A hora estava em tinta cheia, o nome também, e o preço
                ainda mais pesado do que os dois — três coisas a gritar
                na mesma linha. Num dia que ainda não começou nenhuma
                delas está apagada, e o ecrã inteiro fica em maiúsculas.
                A hora guarda o peso, que é o que a faz encontrar ao
                correr o dedo, e desce para a tinta média.
              */}
              <span className="w-[3.25rem] shrink-0">
                <span className="tabular block text-[1rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink-muted)]">
                  {formatMinutes(card.startMin)}
                </span>
                <span className="tabular mt-1 block text-[0.6875rem] leading-none text-[var(--ink-faint)]">
                  {formatMinutes(card.endMin)}
                </span>
              </span>

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
                  {/*
                    SEM CONTACTO — E ISTO TEM DE SE VER NA LINHA.

                    O telemóvel passou a ser opcional na marcação. Quem
                    marcou sem o deixar não pode ser avisada de nada: nem
                    de um atraso, nem de uma profissional que adoeceu.
                    Quem está ao balcão a remendar o dia precisa de saber
                    isso ANTES de pegar no telefone — não depois de abrir
                    a ficha e encontrar o campo vazio.
                  */}
                  {card.clientPhone === null ? (
                    <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-2 py-0.5 text-[0.625rem] font-bold text-[var(--warn)]">
                      sem contacto
                    </span>
                  ) : null}
                  {etiqueta ? (
                    <span
                      className={clsx(
                        'shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-bold',
                        TONE_INK[etiqueta.tom],
                      )}
                      style={{
                        background:
                          'color-mix(in srgb, currentColor 12%, transparent)',
                      }}
                    >
                      {etiqueta.texto}
                    </span>
                  ) : null}
                  {concluida ? (
                    <IconCheck
                      aria-label="Concluída"
                      className="h-3.5 w-3.5 shrink-0 text-[var(--ok)]"
                    />
                  ) : null}
                  {/* O preço desce as duas coisas, peso e tinta: lê-se
                      quando se vai cobrar, não antes. */}
                  <span className="tabular shrink-0 text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                    {formatCents(card.priceCents)}
                  </span>
                </span>

                {/*
                  O SERVIÇO E QUEM O FAZ SÃO A MESMA LINHA.

                  A profissional tinha fila própria por baixo, e era o
                  terceiro andar de cada cartão. Aqui é o ponto de cor no
                  fim do serviço — a mesma cor dos blocos dela na grelha
                  — e a linha ganha-se inteira.
                */}
                {/*
                  A PROFISSIONAL ENCOSTA À DIREITA, NOS DOIS ECRÃS.

                  Colada ao serviço, era ela que empurrava o nome para
                  as reticências — «Corte senhora (s/ brushing) + Br…» —
                  e a margem direita da linha ficava com a pastilha e o
                  preço em cima e nada por baixo. Encostada, o serviço
                  fica com a linha inteira e a direita ganha uma pilha
                  que se lê de uma vez: o que se paga em cima, quem o
                  faz em baixo.

                  Chegou a andar atrás do serviço no monitor, com o
                  argumento de que lá havia largura para a frase toda.
                  Havia — e era esse o problema: como os serviços têm
                  comprimentos diferentes, o nome mudava de sítio em
                  cada linha e nada se lia em coluna. Encostada, ela cai
                  sempre no mesmo sítio, e as quatro pessoas do dia
                  lêem-se de cima a baixo.
                */}
                <span className="mt-0.5 flex items-center gap-1.5 text-[0.75rem] leading-snug text-[var(--ink-muted)]">
                  <span className="min-w-0 flex-1 truncate">
                    {card.services}
                  </span>
                  {/*
                    O NOME VAI DENTRO DE UMA CAIXINHA.

                    Encostado à direita, ficava com o mesmo peso e a
                    mesma tinta do serviço que tem ao lado: «Sobrancelha»
                    e «Filipa R.» liam-se como uma frase só. A caixa
                    separa-os em duas coisas, que é o trabalho todo que
                    ela tem para fazer.

                    E é um cinzento de papel, igual em todas as linhas.
                    Pintá-la com a cor de cada pessoa lê-se mais depressa
                    — e enche o ecrã de seis pastilhas coloridas num
                    sítio onde a cor já tem ofício: o âmbar do que está
                    por fechar, o azul do que está por vir. A cor da
                    pessoa fica onde sempre esteve, no ponto.

                    A caixa é igual nos dois ecrãs. Um desenho que muda
                    de forma com a largura é dois desenhos para manter, e
                    ninguém que use os dois reconhece o segundo.
                  */}
                  {mostrarQuem ? (
                    <PassarPastilha
                      appointmentId={card.appointmentId}
                      cor={colors[card.staffId] ?? 'var(--gold)'}
                      nome={nomes.get(card.staffId) ?? ''}
                      semDono={cadeiras.has(card.staffId)}
                      cliente={card.clientName}
                      quando={`${formatMinutes(card.startMin)} → ${formatMinutes(card.endMin)}`}
                      servicos={card.services}
                      candidatos={agenda.handover[card.appointmentId] ?? []}
                    />
                  ) : null}
                  {/* A confirmação enviada fica, mas sem a palavra: o
                      visto e o `title` bastam para quem anda a decidir
                      a quem telefonar. */}
                  {card.confirmSent ? (
                    <IconCheck
                      aria-label="Confirmação enviada"
                      className="h-3 w-3 shrink-0 text-[var(--ink-faint)]"
                    />
                  ) : null}
                </span>
              </span>
            </div>

            <Link
              href={hrefFor(card.appointmentId)}
              scroll={false}
              aria-current={
                selectedId === card.appointmentId ? 'true' : undefined
              }
              aria-label={`Abrir a marcação de ${card.clientName}`}
              className="absolute inset-0 z-0"
            />
          </li>
        )
      })}
      {agoraNoFim ? (
        <li>
          <NowRule nowMin={nowMin!} />
          {/* Já passou tudo: vale a pena dizê-lo, em vez de deixar o
              ecrã a acabar num fio solto. */}
          <p className="px-4 pb-8 pt-5 text-center text-[0.8125rem] text-[var(--ink-faint)]">
            Nada mais para hoje.
          </p>
        </li>
      ) : null}
      </ol>
    </div>
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
  agora,
}: {
  startMin: number
  endMin: number
  encaixeHref: ((hm: string) => string) | null
  nowMin: number | null
  /** Minutos do relógio, quando o agora cai DENTRO deste vazio. */
  agora: number | null
}) {
  const handMin =
    nowMin !== null && nowMin > startMin
      ? Math.ceil(nowMin / 30) * 30
      : startMin
  const aproveitavel = encaixeHref !== null && handMin + 15 <= endMin
  /*
    O QUE SE DIZ É O QUE AINDA SE PODE VENDER. Um vazio que já começou
    não tem para vender o que tinha às nove da manhã: quando o agora
    está lá dentro, a conta parte do relógio e não do princípio dele.
  */
  const restante = agora !== null ? endMin - agora : endMin - startMin

  const dizer = (
    <>
      {agora !== null ? (
        <>
          <span className="tabular font-bold text-[var(--ink)]">
            agora {formatMinutes(agora)}
          </span>
          <span aria-hidden className="opacity-40">
            ·
          </span>
        </>
      ) : null}
      {/* «CASA LIVRE», E NÃO «LIVRE». Com quatro pessoas ao balcão,
          «livre» seria uma promessa sobre cada uma delas; a conta que
          está por trás é outra — ninguém tem nada — e a palavra passa a
          dizer isso. */}
      <span className="tabular">casa livre {duracao(restante)}</span>
    </>
  )

  /*
    O VAZIO É UMA PORTA, E É POR ISSO QUE ELE ESTÁ AQUI: meia hora sem
    ninguém leva direita ao encaixe, com o dia e a hora já na mão. Um
    vazio que já não dá para nada — um quarto de hora por vender, ou uma
    agenda que esta pessoa não pode marcar — fica só facto, em cinzento,
    e não finge ser botão.
  */
  const centro = aproveitavel ? (
    <Link
      href={encaixeHref!(formatMinutes(handMin))}
      scroll={false}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[0.6875rem] font-semibold transition-colors',
        agora !== null
          ? 'text-[var(--warn)]'
          : 'text-[var(--ink-faint)] hover:text-[var(--accent)]',
      )}
      style={
        agora !== null
          ? { background: 'color-mix(in srgb, var(--warn) 11%, transparent)' }
          : undefined
      }
    >
      <Plus aria-hidden className="h-3 w-3 shrink-0" />
      {dizer}
    </Link>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1 text-[0.6875rem] text-[var(--ink-faint)]">
      {dizer}
    </span>
  )

  /*
    A ETIQUETA AO MEIO, COM UM FIO DE CADA LADO. Encostada à direita
    como esteve, lia-se como o fim de uma linha; ao meio lê-se como o
    que é — uma pausa entre duas marcações.
  */
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      {agora !== null ? (
        <span
          aria-hidden
          className="block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink)]"
        />
      ) : null}
      <span aria-hidden className={fioDoVazio(agora)} />
      {centro}
      <span aria-hidden className={fioDoVazio(agora)} />
    </div>
  )
}

/** O fio de cada lado do vazio: âmbar quando leva o agora, senão fino. */
function fioDoVazio(agora: number | null): string {
  return agora !== null
    ? 'h-px flex-1 bg-[color-mix(in_srgb,var(--warn)_30%,transparent)]'
    : 'h-px flex-1 bg-[var(--line-soft)]'
}

/** "2 h 05" / "45 min" — a duração como se diz ao balcão. */
export function duracao(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
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
        clientPhone: block.clientPhone,
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
