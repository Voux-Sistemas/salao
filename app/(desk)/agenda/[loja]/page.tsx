import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ChevronDown, Columns3, Rows3, Users } from 'lucide-react'
import { requireActor, resolveUnit, unitsFor, can } from '@/lib/auth/actor'
import { loadAgendaDay, type AgendaScope } from '@/lib/agenda'
import { getAppointment } from '@/lib/booking'
import { agendaIsPrivateOn } from '@/lib/sunday'
import { isoDay } from '@/lib/time'
import { sql } from '@/lib/db'
import {
  addDays,
  formatDayLong,
  isoRange,
  minutesOfDay,
  today,
  type IsoDay,
  isValidDay,
} from '@/lib/time'
import {
  AgendaGrid,
  AgendaList,
  casaLivre,
  duracao,
  larguraMinimaDaGrelha,
} from '@/components/agenda-grid'
import { AgendaFocus } from '@/components/agenda-focus'
import { AppointmentPanel } from '@/components/appointment-panel'
import { DayJump } from '@/components/day-jump'
import { DeskDayStrip } from '@/components/desk-day-strip'
import { UnitSwitcher } from '@/components/unit-switcher'
import { ButtonLink, buttonClass } from '@/components/ui'
import { shortName } from '@/lib/text'
import { isUuid } from '@/lib/id'

export const metadata: Metadata = { title: 'Agenda' }


/**
 * A GRELHA DO DIA. A loja vive na barra de endereços; o dia, a
 * marcação aberta, a profissional escolhida e a vista também — assim o
 * retrocesso funciona e a ligação pode ser partilhada.
 *
 * A LISTA É O QUE SE ABRE PRIMEIRO. Quem entra na agenda chega quase
 * sempre com a mesma pergunta — quem vem hoje, a que horas — e essa
 * lê-se, não se mede. A grelha responde à outra pergunta, a de onde há
 * espaço para encaixar mais alguém, e fica a um toque em `?v=grelha`.
 *
 * O endereço limpo é a lista, e é isso que faz a omissão ser mesmo uma
 * omissão: `?v=grelha` é que marca o desvio. Trocar as duas coisas ao
 * mesmo tempo é obrigatório — inverter só a omissão faria os endereços
 * já guardados pela dona abrir a vista errada.
 *
 * Desenha-se UMA vista, não as duas com o CSS a esconder a outra:
 * metade do DOM da agenda escondido era peso que o telemóvel pagava
 * sem nunca o mostrar.
 */
export default async function AgendaDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ loja: string }>
  searchParams: Promise<{
    d?: string
    m?: string
    p?: string
    v?: string
    e?: string
  }>
}) {
  const actor = await requireActor()
  const { loja } = await params
  const { d, m, p, v, e } = await searchParams

  // Loja inexistente e loja sem acesso dão a MESMA resposta.
  const unit = await resolveUnit(actor, loja)

  const now = new Date()
  const day: IsoDay = d && isValidDay(d) ? d : today(unit.timezone, now)
  /** A vista: lista por omissão, grelha para quem a pedir. */
  const view: 'grelha' | 'lista' = v === 'grelha' ? 'grelha' : 'lista'

  /*
    O DIA, OU A CASA INTEIRA.

    Por omissão a agenda mostra quem trabalha — é o que serve para tocar
    o dia. `?e=equipa` acrescenta quem hoje não vem, em coluna estreita:
    a dona pediu-o para ver a casa toda de uma vez e perceber num relance
    quantas mãos tem numa terça-feira. Fica no endereço como tudo o
    resto, para se poder guardar e voltar lá.
  */
  const scope: AgendaScope = e === 'equipa' ? 'equipa' : 'dia'

  /*
    A profissional vê só a agenda dela — EXCEPTO AO DOMINGO.

    Ao domingo o trabalho não é de ninguém em particular: entra em nome
    de quem o motor escolheu, mas quem o pega decide-se lá, entre elas.
    Uma pessoa não pode escolher pegar aquilo que não vê, e por isso a
    peneira cai e a grelha abre inteira para todas.

    O dia que manda é o dia da grelha, não o de hoje: quem abrir o
    domingo numa segunda-feira continua a vê-lo todo.
  */
  const onlyStaffId =
    actor.role === 'professional' && agendaIsPrivateOn(day) ? actor.id : null

  const [full, units, colorRows] = await Promise.all([
    loadAgendaDay(unit, day, { onlyStaffId, scope }),
    unitsFor(actor),
    sql<{ id: string; display_color: string }[]>`
      select id, display_color from staff where org_id = ${unit.org_id}
    `,
  ])

  const colors = Object.fromEntries(
    colorRows.map((r) => [r.id, r.display_color]),
  )

  /*
    UMA PROFISSIONAL DE CADA VEZ — A PENEIRA DO `?p=`.

    A escolha vive na barra de endereços, e não em memória do navegador,
    porque assim a dona pode guardar o endereço da agenda de uma pessoa
    e voltar lá amanhã.

    O dia carrega-se inteiro na mesma: a peneira é de olhar, não de
    perguntar à base outra vez. E o total de marcações do dia continua
    a contar-se do que está à vista — é isso que se consegue conferir.
  */
  const picked =
    p && full.columns.some((column) => column.staffId === p) ? p : null
  const agenda = picked
    ? {
        ...full,
        columns: full.columns.filter((column) => column.staffId === picked),
        blocks: full.blocks.filter((block) => block.staffId === picked),
      }
    : full

  const selectedId = m && isUuid(m) ? m : null
  const selected = selectedId ? await getAppointment(selectedId) : null

  // Marcação de outra loja (ou de outra rede) não se abre aqui.
  if (selected && selected.unit_id !== unit.id) notFound()
  /*
   * A peneira do painel olha para o dia DA MARCAÇÃO, não para o `?d=`
   * da grelha: são coisas independentes, e um `?d=domingo` com um
   * `?m=` de terça-feira abria a marcação de uma colega pela porta do
   * dia aberto. A mesma pergunta que as actions fazem (`canTouch`).
   */
  if (
    selected &&
    actor.role === 'professional' &&
    agendaIsPrivateOn(isoDay(selected.starts_at, unit.timezone)) &&
    !selected.items.some((i) => i.staff_id === actor.id)
  ) {
    notFound()
  }

  const confirmSent = selected ? await hasConfirm(selected.id) : false

  const here = `/agenda/${unit.slug}`
  /** Trocar de dia nunca perde a pessoa escolhida, a vista nem o âmbito. */
  const withDay = (
    target: IsoDay,
    staffId: string | null = picked,
    nextView: 'grelha' | 'lista' = view,
    nextScope: AgendaScope = scope,
  ) =>
    `${here}?d=${target}${staffId ? `&p=${staffId}` : ''}${
      nextView === 'grelha' ? '&v=grelha' : ''
    }${nextScope === 'equipa' ? '&e=equipa' : ''}`
  const hrefFor = (appointmentId: string | null) =>
    appointmentId ? `${withDay(day)}&m=${appointmentId}` : withDay(day)
  /*
    O ENCAIXE JÁ COM A HORA NA MÃO. É isto que faz dos buracos da
    grelha portas: meia hora livre leva direita ao encaixe com o dia e
    a hora postos.

    A profissional passa por aqui como as outras: é ela que tem a
    cliente à frente a perguntar se dá, e o encaixe que ela abre é para
    a agenda dela — o passo seguinte só lhe mostra o nome dela.
  */
  const encaixeHref = can.overrideLeadRules(actor)
    ? (hm: string) => `${here}/encaixe?d=${day}&hm=${hm}`
    : null

  const todayDay = today(unit.timezone, now)
  const isToday = day === todayDay
  // Relógio de parede, como a régua da grelha — a diferença em
  // milissegundos anda 60 min ao lado nos domingos de mudança de hora.
  const nowMin = isToday ? minutesOfDay(now, unit.timezone) : null

  const appointmentCount = new Set(agenda.blocks.map((b) => b.appointmentId)).size
  /*
    QUEM TRABALHA CONTA-SE À PARTE DE QUEM ESTÁ DE FOLGA.

    Somar as duas dava «5 profissionais» num dia com duas pessoas ao
    balcão — a linha que devia dizer a lotação do dia passava a
    escondê-la, e era exactamente por causa dela que a dona quis ver a
    equipa toda. Contam-se as que trabalham; as folgas dizem-se a seguir,
    e só quando existem.
  */
  const staffCount = agenda.columns.filter((c) => !c.offDuty).length
  const offCount = agenda.columns.length - staffCount
  /*
    Zero quando a grelha cabe, 40px quando transborda — e é o browser
    que decide, porque o `100%` aqui dentro é a largura real que ela
    tem. Ver o comentário do esbatido, mais abaixo.
  */
  const larguraDoEsbatido = `max(0px, min(2.5rem, ${larguraMinimaDaGrelha(
    staffCount,
    offCount,
  )}px - 100%))`
  const pickedName = picked
    ? (full.columns.find((c) => c.staffId === picked)?.name ?? null)
    : null

  /*
    «2 POR FECHAR» E «CASA LIVRE 3 H 40», EM VEZ DE «4 PROFISSIONAIS».

    Quantas pessoas estão ao balcão já se vê na fita de baixo, nome por
    nome — dizê-lo outra vez em número era a mesma informação a pagar
    duas vezes. No lugar entram as duas coisas que este subtítulo pode
    dizer e mais nenhum sítio diz: o que ficou por fechar, que é
    trabalho de alguém, e quanto tempo a casa tem por vender, que é a
    conta que decide se vale a pena ir buscar clientes.

    O fim de cada marcação é o do seu bloco mais tardio: uma marcação de
    dois serviços encadeados só acabou quando o segundo acabou.
  */
  const fimDaMarcacao = new Map<string, number>()
  const estadoDaMarcacao = new Map<string, string>()
  for (const block of agenda.blocks) {
    fimDaMarcacao.set(
      block.appointmentId,
      Math.max(fimDaMarcacao.get(block.appointmentId) ?? 0, block.endMin),
    )
    estadoDaMarcacao.set(block.appointmentId, block.status)
  }
  const porFechar =
    nowMin === null
      ? 0
      : [...fimDaMarcacao].filter(([id, fim]) => {
          const estado = estadoDaMarcacao.get(id) ?? ''
          return (
            fim <= nowMin &&
            estado !== 'completed' &&
            estado !== 'no_show' &&
            !estado.startsWith('cancel')
          )
        }).length

  const livreMin = casaLivre(agenda).reduce(
    (total, janela) => total + (janela.end - janela.start),
    0,
  )

  /*
    A FITA ANDA COM O DIA, EM VEZ DE FICAR PRESA À SEMANA DO CALENDÁRIO.

    Sete dias com o dia aberto ao meio: ontem e amanhã estão sempre à
    distância de um toque, mesmo quando o dia aberto é um domingo. Presa
    à semana de calendário, o domingo caía na última célula e ver o dia
    seguinte obrigava a mudar de semana primeiro.
  */
  const stripDays = isoRange(addDays(day, -3), 7)

  /*
    ONDE O DIA SE ABRE.

    Uma agenda que abre no topo mostra a hora de abrir a casa — que às
    três da tarde não é a hora que interessa a ninguém. Abre-se em
    «agora» quando o dia é hoje, e na primeira marcação quando não é. O
    resto do dia está a um dedo de distância, para cima e para baixo.
  */
  const firstBlockMin =
    agenda.blocks.length > 0
      ? Math.min(...agenda.blocks.map((b) => b.blockStartMin))
      : null
  const focusMin = nowMin ?? firstBlockMin

  /*
    OS COMANDOS MUDAM DE SÍTIO CONFORME O ECRÃ, MAS SÃO OS MESMOS.

    Escritos aqui uma vez e colocados duas — no ecrã largo cabem todos
    na linha do título, no telemóvel espalham-se pelas linhas que já
    existem. É o CSS que escolhe qual das duas cópias se vê; escrever
    dois desenhos diferentes era duas coisas para manter.
  */

  /*
    LISTA OU GRELHA, POR ESTA ORDEM. A lista mostra o dia como texto —
    quem vem, o que faz, quanto é; a grelha mostra-o como espaço — onde
    está cheio, onde há buracos. São perguntas diferentes, e a primeira
    é a que se faz mais vezes, por isso é a que abre e a que fica à
    esquerda: a ordem dos botões conta a mesma história que a omissão.
    A escolha fica no endereço, como tudo o resto.
  */
  const interruptorVista = (
    <div
      role="group"
      aria-label="Como ver o dia"
      className="flex h-8 items-center overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)]"
    >
      <Link
        href={withDay(day, picked, 'lista')}
        scroll={false}
        title="Lista do dia"
        aria-current={view === 'lista' ? 'true' : undefined}
        className={clsx(
          'flex h-full w-9 items-center justify-center transition-colors',
          view === 'lista'
            ? 'bg-[var(--surface-2)] text-[var(--ink)]'
            : 'text-[var(--ink-faint)] hover:text-[var(--ink)]',
        )}
      >
        <Rows3 aria-hidden className="h-4 w-4" />
      </Link>
      <Link
        href={withDay(day, picked, 'grelha')}
        scroll={false}
        title="Grelha do dia"
        aria-current={view === 'grelha' ? 'true' : undefined}
        className={clsx(
          'flex h-full w-9 items-center justify-center border-l border-[var(--line-soft)] transition-colors',
          view === 'grelha'
            ? 'bg-[var(--surface-2)] text-[var(--ink)]'
            : 'text-[var(--ink-faint)] hover:text-[var(--ink)]',
        )}
      >
        <Columns3 aria-hidden className="h-4 w-4" />
      </Link>
    </div>
  )

  /*
    A PORTA PARA A SEMANA.

    É da mesma família da vista — outra maneira de olhar para a mesma
    agenda — mas não entra no interruptor lista/grelha: esses dois
    desenham O DIA, e a semana é outra pergunta, com endereço próprio.
    Leva o dia aberto consigo, para abrir na semana a que ele pertence.
    No telemóvel senta-se no lugar que as setas ‹ › deixaram vago.
  */
  const portaDaSemana = (
    <Link
      href={`${here}/semana?d=${day}`}
      title="Panorama da semana"
      className={buttonClass('quiet', 'sm')}
    >
      Semana
    </Link>
  )

  const voltarAHoje = !isToday ? (
    <Link
      href={withDay(todayDay)}
      scroll={false}
      className={buttonClass('quiet', 'sm')}
    >
      Hoje
    </Link>
  ) : null

  const temFiltro =
    !onlyStaffId && (full.columns.length > 1 || scope === 'equipa')

  /*
    O FILTRO DE BOLSO — a fita das profissionais fechada num botão.

    No ecrã largo a fita fica: com quatro pessoas ao balcão é o filtro
    que mais vale a pena, e é ela que diz de relance quem está hoje na
    casa. No telemóvel gastava uma fila inteira, e o «Equipa» flutuava
    por cima do último nome e cortava-o ao meio. Aqui fecha-se num
    «Todas ⌄», e a primeira cliente sobe meia marcação.

    `<details>` e não um menu de cliente: abre-se poucas vezes e não
    vale JavaScript. A `key` fecha-o ao escolher — sem ela o React
    reaproveita o elemento e o `open` do DOM ficava aberto.
  */
  const filtroDeBolso = temFiltro ? (
    <details key={picked ?? 'todas'} className="relative">
      <summary
        className={clsx(
          'inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-[0.75rem] font-semibold transition-colors [&::-webkit-details-marker]:hidden',
          picked
            ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-[var(--accent)]'
            : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-muted)]',
        )}
      >
        {picked && pickedName ? (
          <span
            aria-hidden
            className="block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: colors[picked] ?? 'var(--gold)' }}
          />
        ) : null}
        {picked && pickedName ? shortName(pickedName) : 'Todas'}
        <ChevronDown aria-hidden className="h-3 w-3 shrink-0" />
      </summary>

      {/*
        O PAINEL ABRE PARA O LADO ONDE HÁ ECRÃ.

        Abria alinhado à direita, e estava certo enquanto o «Todas ⌄»
        vivia no canto direito da linha dos números. Quando ele desceu
        para a ponta ESQUERDA da fila dos comandos, alinhar pela direita
        passou a mandar o painel para fora do ecrã: 176px a crescer para
        a esquerda a partir de um chip que começa aos 14. Ancora-se à
        esquerda, que é onde ele agora está.
      */}
      <div className="absolute top-full left-0 z-30 mt-1.5 min-w-[11rem] overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-soft)]">
        <FiltroItem href={withDay(day, null)} active={picked === null}>
          Todas
        </FiltroItem>
        {full.columns.map((column) => (
          <FiltroItem
            key={column.staffId}
            href={withDay(day, column.staffId)}
            active={picked === column.staffId}
            color={colors[column.staffId]}
            muted={column.offDuty}
          >
            {shortName(column.name)}
          </FiltroItem>
        ))}
        {/* O «Equipa» vive aqui dentro: é do mesmo assunto — quem se vê
            — e cá fora não tinha onde se sentar sem roubar espaço. */}
        <span
          aria-hidden
          className="my-1 block h-px bg-[var(--line-soft)]"
        />
        <FiltroItem
          href={withDay(day, picked, view, scope === 'equipa' ? 'dia' : 'equipa')}
          active={scope === 'equipa'}
        >
          <span className="inline-flex items-center gap-1.5">
            <Users aria-hidden className="h-3.5 w-3.5" />
            {scope === 'equipa' ? 'Só quem trabalha' : 'Equipa toda'}
          </span>
        </FiltroItem>
      </div>
    </details>
  ) : null

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-3.5rem)]">
      {/* a fita do dia ------------------------------------------------ */}
      {/*
        NO MONITOR O CABEÇALHO ESTÁ NA MESMA COLUNA DA LISTA.

        Ficou uma versão em que só a lista foi apertada para 68rem e o
        cabeçalho continuou a atravessar o ecrã: a coluna branca começava
        190px à direita de onde começava o título, encostada a nada, e
        lia-se como um defeito e não como uma decisão. Ou entram os dois
        na mesma coluna, ou nenhum entra.

        E a barra branca por baixo do cabeçalho sai com eles: no monitor
        o papel é a lista, e o cabeçalho fica sobre a mesa. No telemóvel
        continua a ser uma faixa branca colada ao topo, porque lá a
        largura já é a do ecrã e não há coluna nenhuma para alinhar.
      */}
      <div className="shrink-0 border-b border-[var(--line-soft)] bg-[var(--surface-raised)] sm:border-b-0 sm:bg-transparent">
        <div className="mx-auto w-full max-w-[68rem]">
        {/* que dia é, onde, e o que se pode fazer -------------------- */}
        {/*
          A DATA VOLTOU A CABER NA MESMA LINHA DO «ENCAIXE».

          Esteve com a linha toda para ela (`basis-full`), e tinha de
          estar: a partilhá-la com o selector de loja E o Encaixe, no
          telemóvel ficava «Segunda-fei…», que é pior do que não estar
          lá. Agora o selector desceu para a linha de baixo, e sobra o
          suficiente — com o `truncate` de guarda para os dias de nome
          comprido.

          O TÍTULO É O CALENDÁRIO: tocar na data abre o selector nativo.
          A linha que existia só para «saltar para um dia» — campo, «Ir»,
          rótulo — foi-se, e com ela um dedo de altura do ecrã pequeno.
        */}
        <div className="flex items-center gap-3 px-4 pt-2.5 sm:px-6 sm:pt-3">
          <div className="flex min-w-0 flex-1 items-baseline gap-3.5 leading-tight">
            <DayJump
              day={day}
              hrefTemplate={withDay('{d}')}
              className="block min-w-0 max-w-full"
            >
              <h1 className="display flex items-center gap-1 text-[1.0625rem] text-[var(--ink)] sm:text-lg">
                <span className="truncate">
                  {capitalise(formatDayLong(day, unit.timezone))}
                </span>
                <ChevronDown
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
                />
              </h1>
            </DayJump>

            {/*
              OS FACTOS DO DIA LÊEM-SE AO LADO DO TÍTULO.

              Tinham fila própria por baixo dele, e essa fila existia por
              causa da loja — que lá vivia como texto sublinhado, vestida
              de facto no meio de dois números que ninguém carrega. Com a
              loja arrumada na fila dos filtros, o que sobrou foram
              factos; e factos lêem-se como a data se lê, encostados ao
              título. É o gesto que o painel do Hoje já faz.

              FORA do `DayJump`, que é um campo de data deitado por cima
              do título: lá dentro, tocar em «14 marcações» abria o
              calendário.

              Só no monitor. No telemóvel esta linha saiu inteira — lá os
              números eram a coisa que se lia menos vezes de todas as que
              lá estavam.
            */}
            <span className="tabular hidden shrink-0 text-[0.75rem] text-[var(--ink-faint)] sm:inline">
              {appointmentCount === 1
                ? '1 marcação'
                : `${appointmentCount} marcações`}
              {!onlyStaffId && pickedName ? ` · ${shortName(pickedName)}` : ''}
              {porFechar > 0 ? (
                <span className="font-semibold text-[var(--warn)]">
                  {' '}
                  · {porFechar} por fechar
                </span>
              ) : null}
              {livreMin > 0 ? ` · casa livre ${duracao(livreMin)}` : ''}
              {!onlyStaffId && !pickedName && offCount > 0
                ? ` · ${offCount} de folga`
                : ''}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* No ecrã largo há espaço para as três; no telemóvel só o
                Encaixe fica aqui, e as outras duas descem. */}
            <span className="hidden items-center gap-1.5 sm:flex">
              {interruptorVista}
              {portaDaSemana}
              {voltarAHoje}
            </span>
            {encaixeHref ? (
              <ButtonLink href={`${here}/encaixe?d=${day}`} size="sm">
                Encaixe
              </ButtonLink>
            ) : null}
          </div>
        </div>

        {/* os dias --------------------------------------------------- */}
        {/*
          AS SETAS ‹ › SAÍRAM. Não levavam a lado nenhum que já não
          estivesse à mão: o ⌄ da data salta para qualquer dia do ano, e
          tocar num dia da ponta já recentra a fita, porque ela anda com
          o dia aberto e não com a semana do calendário. As duas gastavam
          64px de largura que no telemóvel fazem falta às sete células.

          E O «SEMANA» TAMBÉM SAIU DAQUI. Sentado no fim da fita, comia
          74px aos sete dias: as células ficavam com 40px, que num
          telemóvel é um alvo apertado. Desceu para a fila dos comandos,
          e os dias passaram a ter a largura toda — 48px cada.
        */}
        <div className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5">
          <div className="min-w-0 flex-1">
            <DeskDayStrip
              dense
              days={stripDays}
              active={day}
              today={todayDay}
              timezone={unit.timezone}
              hrefFor={(value) => withDay(value)}
            />
          </div>
        </div>

        {/* os comandos, só no telemóvel ------------------------------ */}
        {/*
          CADA FILA FAZ UMA COISA SÓ.

          No ecrã largo estes três vivem no canto de cima, ao lado do
          «Encaixe», e esta fila não existe. No telemóvel não cabem lá,
          e espalhados pelas outras filas era cada um a roubar espaço ao
          texto de quem o alojava. Juntos numa fila própria têm as duas
          pontas ocupadas — quem se vê à esquerda, como se vê à direita
          — e nenhuma das outras filas tem de ceder nada.

          `flex-wrap` porque num dia que não é hoje entra mais um botão,
          o «Hoje», e cinco comandos não cabem em 358px. Passar para a
          linha de baixo é feio uma vez por semana; cortado ao meio na
          margem seria feio sempre.
        */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-2.5 sm:hidden">
          {/* A casa, no sítio onde a linha dos números a deixou. */}
          <UnitSwitcher
            units={units}
            current={unit.slug}
            base="/agenda"
            showAll={false}
            variant="chip"
          />
          {filtroDeBolso}
          <span className="flex-grow" />
          {interruptorVista}
          {portaDaSemana}
          {voltarAHoje}
        </div>


        {/* o que se vê: a casa, e quem lá está ----------------------- */}
        {/*
          A FILA PASSA A RESPONDER A UMA PERGUNTA SÓ, E INTEIRA.

          A loja vivia na linha de baixo do título, vestida de facto: o
          tamanho, a cor e o peso dos dois números que estavam ao lado
          dela e que ninguém carrega, com um sublinhado fininho a ser
          tudo o que a distinguia. E esta fila — que é toda ela de
          escolher o que se vê — não a tinha.

          Agora tem. A casa é a primeira pastilha, com um fio a separá-la
          das outras: ela escolhe a CASA, as outras escolhem as pessoas
          dentro dela. É a mesma pastilha do telemóvel, no mesmo sítio da
          fila, e quem usa os dois ecrãs reconhece-a.

          A fila existe também quando não há filtro de pessoas — uma
          profissional só e duas casas — porque nesse dia a pastilha da
          casa é a única coisa que aqui mora, e continua a ter de morar
          algures.
        */}
        {temFiltro || units.length > 1 ? (
          <div className="hidden items-center gap-1.5 px-4 py-2 sm:flex sm:px-6">
            {units.length > 1 ? (
              <>
                <UnitSwitcher
                  units={units}
                  current={unit.slug}
                  base="/agenda"
                  showAll={false}
                  variant="chip"
                />
                {temFiltro ? (
                  <span
                    aria-hidden
                    className="mx-1 block h-4 w-px shrink-0 bg-[var(--line-soft)]"
                  />
                ) : null}
              </>
            ) : null}
            {temFiltro ? (
              <>
            {/*
              A FITA DEIXA DE ESTICAR ATÉ À MARGEM.

              Tinha `flex-1`, e por isso ocupava tudo o que sobrava: as
              pastilhas ficavam à esquerda, o «Equipa» encostado à
              direita, e um vazio de meio ecrã entre os dois. Esse vazio
              é que fazia a fita dos dias — que é curta de propósito —
              parecer a única coisa curta da página.

              Sem ele a fita mede o que as pastilhas medem, e o «Equipa»
              passa a ser o fim da fila. Continua a poder encolher
              (`min-w-0`) e a deslizar por dentro quando a equipa é
              grande de mais para caber.
            */}
            <div className="relative min-w-0 max-w-full">
              <nav
                aria-label="Ver uma profissional"
                className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pr-6"
              >
                <StaffChip href={withDay(day, null)} active={picked === null}>
                  Todas
                </StaffChip>
                {full.columns.map((column) => (
                  <StaffChip
                    key={column.staffId}
                    href={withDay(day, column.staffId)}
                    active={picked === column.staffId}
                    color={colors[column.staffId]}
                    muted={column.offDuty}
                  >
                    {shortName(column.name)}
                  </StaffChip>
                ))}
              </nav>
              {/*
                COM A EQUIPA TODA A FITA NÃO CABE NO TELEMÓVEL, E UM NOME
                CORTADO RENTE À MARGEM PARECE UM DEFEITO DO ECRÃ.

                Este esbatido diz o contrário: não está partido, há mais
                para o lado. Não apanha toques, para não roubar o último
                chip a quem lhe quer tocar.

                A COR É A DO CHÃO, E O CHÃO MUDOU. Pintava-se com
                `--surface-raised` porque o cabeçalho era uma faixa
                branca; quando ele passou a creme, este esbatido ficou a
                pintar branco sobre creme — uma mancha clara antes do
                «Equipa», que se lia como um rasgo no ecrã e não como
                uma fita que continua.
              */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--surface-raised)] to-transparent sm:from-[var(--surface)]"
              />
            </div>

            {/* O fio entre as pessoas e o âmbito: são a mesma pergunta
                — quem se vê — mas uma escolhe uma, a outra escolhe o
                conjunto. */}
            <span
              aria-hidden
              className="mx-1 block h-4 w-px shrink-0 bg-[var(--line-soft)]"
            />
            {/*
              O INTERRUPTOR DA CASA INTEIRA.

              ESTEVE POUSADO EM CIMA DA FITA, E ESTAVA ERRADO. Ficava em
              `absolute` sobre ela, com um `pr-16` a fingir de espaço
              reservado — mas o botão mede 81px com «Só hoje», e medido
              no browser invadia a fita em 93px: dois chips desapareciam
              por baixo dele. Alargar a reserva não resolvia: a fita
              DESLIZA, e ao primeiro arrasto os chips voltavam a passar
              por baixo. Um elemento sobreposto a uma fita que corre não
              se conserta com padding.

              Agora é vizinho e não inquilino: a fita ocupa o que sobra
              (`min-w-0 flex-1`, que é o que a deixa encolher dentro do
              flex) e desliza dentro disso. Nada se sobrepõe, em nenhuma
              posição de scroll.

              Diz o que se ganha ao carregar, não o que está — «Equipa»
              leva à casa toda, «Só hoje» volta ao dia — que é a
              pergunta que a dona tem na cabeça quando olha para ali.
            */}
            <Link
              href={withDay(
                day,
                picked,
                view,
                scope === 'equipa' ? 'dia' : 'equipa',
              )}
              scroll={false}
              title={
                scope === 'equipa'
                  ? 'Mostrar só quem trabalha hoje'
                  : 'Mostrar a equipa toda, incluindo folgas'
              }
              className={clsx(
                // A mesma altura e o mesmo corpo das pastilhas das
                // pessoas: agora estão lado a lado na mesma fila, e dois
                // tamanhos de pastilha encostados lêem-se como um erro.
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.75rem] font-semibold tracking-[0.01em] transition-colors',
                scope === 'equipa'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:text-[var(--ink)]',
              )}
            >
              <Users aria-hidden className="h-3.5 w-3.5" />
              {scope === 'equipa' ? 'Só hoje' : 'Equipa'}
            </Link>
              </>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>

      {/* a grelha e o painel ----------------------------------------- */}
      {/*
        UM DEDO DE CREME ENTRE OS COMANDOS E O DIA.

        No monitor isto já acontece: o cabeçalho está sobre creme e a
        lista é uma folha branca, e vê-se onde acaba um e começa o
        outro. No telemóvel era tudo branco de cima a baixo — os
        comandos e as clientes na mesma mancha, sem nada a separá-las.
        Dez píxeis de chão chegam para separar o que se toca do que se
        lê, e não custam meia linha de lista.
      */}
      <div className="relative mt-2.5 flex min-h-0 flex-1 sm:mt-0">
        {/*
          ESTE ESBATIDO ESTAVA A PINTAR A COR ERRADA, E LIA-SE COMO UM
          DEFEITO.

          Dizia `from-[var(--surface)]` — o bege do fundo da página —
          mas por baixo dele está a grelha, que é `--surface-raised`,
          mais claro. Resultado: uma faixa escura de 40px colada à
          margem direita, por cima da última coluna. Numa fotografia de
          telemóvel não se lê como «há mais para o lado»; lê-se como se
          a grelha tivesse ficado cortada a meio da última lombada.

          E APARECIA QUANDO NÃO DEVIA. A conta era `columns.length > 4`,
          mas com a equipa toda as lombadas de folga medem 20px: cinco
          colunas em que três são folgas cabem à vontade, e o esbatido
          prometia um lado que não existia. Contar só quem trabalha
          também não servia — cinco a trabalhar mais uma de folga dá
          388px certos num ecrã de 388, cabe, e a conta dizia que não.

          Nenhuma contagem serve, porque a pergunta não é quantas são: é
          se somadas passam da largura do ecrã, e essa largura o
          servidor não a sabe. Então não decide — mede. A largura do
          esbatido é um `calc()` com `100%` lá dentro, que é o browser a
          dizer o que tem. Se a grelha cabe, dá zero e o esbatido
          desaparece sozinho; se transborda, cresce até 40px. A mesma
          saída que a coluna mínima já tinha tomado: dar ao CSS as
          medidas fixas e deixá-lo fazer a divisão.
        */}
        {view === 'grelha' && staffCount > 1 ? (
          <div
            aria-hidden
            style={{ width: larguraDoEsbatido } as React.CSSProperties}
            className="pointer-events-none absolute inset-y-0 right-0 z-20 bg-gradient-to-l from-[var(--surface-raised)] to-transparent lg:hidden"
          />
        ) : null}
        {/*
          A BARRA DE DESLOCAMENTO ESTAVA A DESALINHAR A FOLHA.

          O cabeçalho vive fora deste rolo e a lista dentro dele, e por
          isso a folha acabava uns nove píxeis antes dos botões de cima:
          a barra come esse bocado só a quem está lá dentro. `stable
          both-edges` reserva-o dos DOIS lados — a coluna continua ao
          meio, e o meio passa a ser o mesmo do cabeçalho, que é o que
          faz as duas margens coincidirem. Onde o navegador não conhece
          a regra (Safari antigo), fica como estava.
        */}
        <div
          data-rolo-agenda
          className="min-w-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable_both-edges]"
        >
          {focusMin !== null ? (
            <AgendaFocus
              focusMin={focusMin}
              fromMin={agenda.fromMin}
              chave={`${day}:${picked ?? ''}:${view}`}
            />
          ) : null}
          {view === 'lista' ? (
            /*
              A LISTA DEIXA DE ATRAVESSAR O MONITOR.

              Num ecrã de 1900px o nome da cliente ficava a mil e
              quinhentos pixéis do preço, e o olho fazia a travessia em
              cada linha — a linha que se estava a ler perdia-se pelo
              caminho. Uma coluna de 68rem lê-se como uma folha. No
              telemóvel isto não faz nada: lá a largura já é o ecrã.

              A grelha continua a ocupar tudo: ela é uma medida, e uma
              medida encurtada mente.
            */
            <div className="mx-auto w-full max-w-[68rem] sm:px-6 sm:pb-6">
              {/* No monitor a lista é uma folha pousada na mesa; no
                  telemóvel encosta às duas margens, porque lá o ecrã
                  inteiro já é a folha. */}
              <div className="sm:overflow-hidden sm:rounded-[var(--radius)] sm:border sm:border-[var(--line-soft)] sm:shadow-[0_1px_2px_rgba(46,38,28,0.05)]">
                <AgendaList
                  agenda={agenda}
                  colors={colors}
                  selectedId={selectedId}
                  hrefFor={hrefFor}
                  encaixeHref={encaixeHref}
                  nowMin={nowMin}
                />
              </div>
            </div>
          ) : (
            <AgendaGrid
              agenda={agenda}
              colors={colors}
              selectedId={selectedId}
              hrefFor={hrefFor}
              encaixeHref={encaixeHref}
              nowMin={nowMin}
            />
          )}
        </div>

        {selected ? (
          <>
            {/* no telemóvel o painel cobre o ecrã; a sombra fecha-o */}
            <Link
              href={withDay(day)}
              scroll={false}
              aria-label="Fechar o painel"
              className="animate-fade fixed inset-0 z-40 bg-[rgba(20,15,8,0.4)] lg:hidden"
            />
            <div className="animate-fade fixed inset-y-0 right-0 z-50 w-full max-w-[24rem] overflow-hidden shadow-[var(--shadow-warm)] lg:static lg:z-auto lg:w-[23rem] lg:max-w-none lg:shrink-0 lg:animate-none lg:shadow-none">
              <AppointmentPanel
                actor={actor}
                appointment={selected}
                closeHref={withDay(day)}
                confirmSent={confirmSent}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

async function hasConfirm(appointmentId: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1 from notification_log
       where appointment_id = ${appointmentId} and routine = 'confirm'
    ) as exists
  `
  return rows[0]?.exists ?? false
}

/**
 * Uma pastilha por profissional, com o fio da cor dela à esquerda — a
 * mesma cor que os blocos dela têm na grelha, para que a escolha e o
 * que ela faz se leiam como a mesma coisa.
 */
/**
 * `muted` é quem hoje está de folga, quando se pede a equipa toda: o
 * chip fica a tracejado e desmaiado. Continua a levar à agenda dela —
 * ver o dia vazio de alguém é uma resposta legítima — mas não se
 * confunde com quem está a trabalhar.
 */
/**
 * Uma linha do filtro de bolso. O ponto de cor é o mesmo dos chips e
 * dos blocos da grelha — quem está de folga fica desmaiado, como lá.
 */
function FiltroItem({
  href,
  active,
  color,
  muted,
  children,
}: {
  href: string
  active: boolean
  color?: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={clsx(
        'flex items-center gap-2 px-3.5 py-2 text-[0.8125rem] whitespace-nowrap transition-colors',
        active
          ? 'font-semibold text-[var(--ink)]'
          : 'text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
        muted && 'opacity-60',
      )}
    >
      {color ? (
        <span
          aria-hidden
          className="block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
      ) : null}
      {children}
    </Link>
  )
}

function StaffChip({
  href,
  active,
  color,
  muted,
  children,
}: {
  href: string
  active: boolean
  color?: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={clsx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.75rem] transition-colors',
        active
          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
          : muted
            ? 'border-dashed border-[var(--line-soft)] text-[var(--ink-faint)] opacity-70 hover:opacity-100'
            : // Fundo próprio, para o chip assentar tanto na faixa
              // branca do telemóvel como no creme do monitor.
              'border-[var(--line-soft)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]',
      )}
    >
      {color ? (
        <span
          aria-hidden
          className={clsx('block h-1.5 w-1.5 rounded-full', muted && 'opacity-45')}
          style={{ background: color }}
        />
      ) : null}
      {children}
    </Link>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
