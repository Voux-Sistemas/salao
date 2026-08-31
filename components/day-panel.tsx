import Link from 'next/link'
import clsx from 'clsx'
import { sql } from '@/lib/db'
import type { Org, Unit } from '@/lib/org'
import type { Actor } from '@/lib/auth/actor'
import { DAY_PARAM, TIME_PARAM } from '@/lib/cart'
import { formatCents } from '@/lib/money'
import { openingWindows } from '@/lib/hours'
import { receitaDaMarcacao } from '@/lib/dashboard'
import { ocupacaoDaSemana } from '@/lib/ocupacao'
import { PainelNumeros } from '@/components/painel-numeros'
import {
  dayEnd,
  dayStart,
  formatDayLong,
  formatDuration,
  formatMinutes,
  formatTime,
  minutesOfDay,
  today,
  type IsoDay,
} from '@/lib/time'
import type { Status } from '@/lib/booking'
import { Card, Empty } from '@/components/ui'
import { shortName } from '@/lib/text'

/**
 * O PAINEL DO DIA. A raiz `/` é duas coisas: a montra para quem não tem
 * sessão, e isto para quem tem.
 *
 * O DIA LÊ-SE COMO UMA LISTA, NÃO COMO UMA RÉGUA.
 *
 * A primeira versão desenhava as horas em altura: uma marcação de meia
 * hora era metade de uma de uma hora, e o buraco da tarde era um buraco
 * de verdade. Lia-se mal por três razões que só se veem no telemóvel —
 * um serviço de 45 minutos ficava com vinte e oito píxeis para escrever
 * nome, serviço e profissional; nenhum bloco dizia a que horas era, e
 * portanto tinha de se medir contra a régua com os olhos; e a linha do
 * «agora» atravessava a marcação em curso por cima do nome, que se lia
 * como um risco.
 *
 * Aqui a duração está ESCRITA debaixo da hora e as folgas são fios
 * entre as marcações. Toda a linha tem o mesmo tamanho, leia-se de
 * manhã ou às sete da tarde, e o tempo que falta na que está a decorrer
 * mostra-se por dentro da própria linha.
 *
 * DOIS SEPARADORES, E A AGENDA ABRE PRIMEIRO.
 *
 * A página tinha o dia numa coluna de dois terços e os números do mês
 * ao lado — e com duas casas, a segunda ficava fora do ecrã: abria-se o
 * painel e via-se metade do salão.
 *
 * A agenda passa a levar a página toda, uma coluna por casa. Os números
 * mudam-se para o separador ao lado, onde têm espaço para dizer mais do
 * que um total: a ocupação, o mapa das horas que sobram, e as clientes
 * que voltam ou não voltam.
 *
 * O recorte é o das lojas a que esta pessoa tem acesso. As fronteiras
 * de dia contam-se no fuso da rede; cada loja mostra as suas horas no
 * fuso dela.
 */

/** Abaixo disto não é folga, é a volta entre duas clientes. */
const FOLGA_MINIMA = 30

/** A partir daqui a folga deixa de ser um facto e passa a ser lugar por vender. */
const FOLGA_VENDAVEL = 90

type ApptRow = {
  id: string
  unit_id: string
  status: Status
  starts_at: Date
  ends_at: Date
  client_name: string
  services: string | null
  staff_names: string | null
  /** Quanto vale, já com desconto. Só se mostra depois de concluída. */
  revenue_cents: number
}

type MoneyRow = { unit_id: string; revenue_cents: number }

/** Uma linha da agenda: ou é uma marcação, ou é o vazio entre duas. */
type Slot =
  | { kind: 'appt'; row: ApptRow }
  | { kind: 'gap'; fromMin: number; toMin: number; edge: 'open' | 'close' | null }

export async function DayPanel({
  actor,
  org,
  units,
  vista = 'agenda',
}: {
  actor: Actor
  org: Org
  units: Unit[]
  vista?: Vista
}) {
  if (units.length === 0) {
    return (
      <div className="mx-auto max-w-[110rem] px-4 py-16 sm:px-6">
        <Empty
          title="Ainda não há lojas"
          hint="Crie a primeira loja em Gestão · Unidades para começar a marcar."
        />
      </div>
    )
  }

  const tz = org.timezone
  const now = new Date()
  const day = today(tz, now)

  /*
    OS NÚMEROS SAEM DAQUI ANTES DAS CONSULTAS DO DIA.

    Quem abre os números não quer o livro de hoje, e o livro de hoje são
    seis consultas — a lista, o dinheiro por loja, o mês, o dia a dia do
    mês e o horário de cada casa. Ramificar depois de as fazer era
    pagá-las para as deitar fora.
  */
  if (vista === 'numeros') {
    return (
      <Moldura day={day} tz={tz} vista={vista}>
        <PainelNumeros org={org} units={units} />
      </Moldura>
    )
  }

  const dayFrom = dayStart(day, tz)
  const dayTo = dayEnd(day, tz)

  /*
    O MÊS SAIU DAQUI.

    Este ficheiro tinha a conta do mês corrente contra o mesmo período
    do anterior, com o cuidado do dia 31 e tudo — e agora vive nos
    Números, onde o `monthKpis` já a fazia para a Gestão. Duas contas
    parecidas em dois sítios acabam sempre por divergir; ficou a que já
    tinha dono.
  */
  const ids = units.map((u) => u.id)

  const [appts, money, windows, ocupacao] =
    await Promise.all([
      /*
       * O DIA INTEIRO, E NÃO SÓ O QUE FALTA.
       *
       * A versão anterior trazia dez marcações por vir. Mas o painel
       * passou a dizer «2 de 4 feitas», e para isso precisa das que já
       * passaram — e a lista, com as concluídas esbatidas em cima, é o
       * que faz o dia ter princípio e não começar a meio.
       *
       * Um dia de salão são dezenas de linhas, não centenas: vem tudo.
       */
      sql<ApptRow[]>`
        select
          a.id, a.unit_id, a.status, a.starts_at, a.ends_at,
          c.name as client_name,
          (
            select string_agg(ai.service_name, ' + ' order by ai.sort_order)
              from appointment_item ai where ai.appointment_id = a.id
          ) as services,
          (
            select string_agg(distinct s.name, ', ')
              from appointment_item ai
              join staff s on s.id = ai.staff_id
             where ai.appointment_id = a.id
          ) as staff_names,
          ${receitaDaMarcacao()} as revenue_cents
        from appointment a
        join client c on c.id = a.client_id
        where a.unit_id = any(${ids}::uuid[])
          and a.starts_at >= ${dayFrom} and a.starts_at < ${dayTo}
          and a.status not in ('cancelled_by_client','cancelled_by_salon')
        order by a.starts_at, c.name
      `,

      /*
       * O dinheiro do dia é o que as marcações CONCLUÍDAS valem. Contava-
       * se pelos pagamentos lançados na comanda, e ninguém tinha tempo
       * para os lançar: o painel dizia vinte euros num mês de onze
       * marcações. Agora vem do gesto que elas já fazem — dar a marcação
       * por concluída.
       */
      sql<MoneyRow[]>`
        select
          u.id as unit_id,
          coalesce((
            select sum(${receitaDaMarcacao()})::int
              from appointment a
             where a.unit_id = u.id
               and a.status = 'completed'
               and a.starts_at >= ${dayFrom} and a.starts_at < ${dayTo}
          ), 0) as revenue_cents
        from unit u
        where u.id = any(${ids}::uuid[])
      `,

      // O horário de hoje, loja a loja — é o que dá princípio e fim à
      // agenda, e sem ele uma folga não sabe onde acaba.
      Promise.all(units.map((u) => openingWindows(u.id, day))),

      /* A ocupação de hoje. Traz a semana inteira porque é uma consulta
         só de qualquer maneira, e daqui só se lê a coluna de hoje. */
      ocupacaoDaSemana(org.id, tz, day),
    ])

  /* O que a casa tem para vender hoje e ainda não vendeu: a escala,
     menos as ausências, menos o que já está marcado por cima. */
  const hojeOcupado = ocupacao.find((d) => d.day === day)
  const porVender = hojeOcupado
    ? Math.max(0, hojeOcupado.escalado - hojeOcupado.vendido)
    : 0

  // `windows` vem pela ordem de `units` — passa a mapa para que quem o
  // lê não dependa de a lista continuar na mesma ordem.
  const windowsBy = new Map(units.map((u, i) => [u.id, windows[i] ?? []]))
  const apptsBy = new Map<string, ApptRow[]>()
  for (const row of appts) {
    const list = apptsBy.get(row.unit_id)
    if (list) list.push(row)
    else apptsBy.set(row.unit_id, [row])
  }

  const totals = {
    marcadas: appts.length,
    feitas: appts.filter((a) => a.status === 'completed').length,
    faltas: appts.filter((a) => a.status === 'no_show').length,
    porConfirmar: appts.filter((a) => a.status === 'booked').length,
    entrou: money.reduce((sum, r) => sum + r.revenue_cents, 0),
  }

  const currency = org.currency

  // As casas com gente hoje ganham cartão; as paradas dizem-no numa
  // linha. Um cartão vazio por loja fechada era meio ecrã de nada.
  const abertas = units.filter((u) => (apptsBy.get(u.id)?.length ?? 0) > 0)
  const paradas = units.filter((u) => (apptsBy.get(u.id)?.length ?? 0) === 0)

  return (
    <Moldura day={day} tz={tz} vista={vista}>
      {/* ---------------------------------------------------- HOJE --- */}
      <section aria-label="O dia" className="space-y-3">
        {/*
          TRÊS NÚMEROS NUMA FITA, E NÃO TRÊS CARTÕES.

          Eram três fichas da altura de um dedo para dizer «4», «0,00 €»
          e «0» — num telemóvel ocupavam meio ecrã antes de se chegar à
          primeira cliente. Postos numa linha, lêem-se de uma vez, que é
          a única coisa que se quer fazer com eles.

          E mudaram de pergunta: «feitas 2 de 4» diz onde vai o dia, e
          «4 marcações» só dizia o que estava no livro. As faltas só
          aparecem quando há — um zero permanente não é informação, e o
          lugar delas vale mais para o que ainda pede mão.
        */}
        <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <span className="flex items-baseline gap-1.5">
            <span className="metric text-[1rem] text-[var(--ink)]">
              {totals.feitas}
            </span>
            <span className="text-[0.75rem] text-[var(--ink-muted)]">
              de {totals.marcadas} feita{totals.marcadas === 1 ? '' : 's'}
            </span>
          </span>

          <Ponto />

          <span className="metric text-[1rem] text-[var(--ink)]">
            {formatCents(totals.entrou, currency)}
          </span>

          {/*
            A TERCEIRA CONTA É A HORA VAZIA.

            Marcações e euros já cá estavam. O que faltava era o que a
            casa tem para vender hoje e ainda não vendeu — a agenda
            di-lo dentro de cada buraco, «3 h 15 livres», uma linha de
            cada vez, e nunca o total.
          */}
          {porVender > 0 ? (
            <>
              <Ponto />
              <span className="flex items-baseline gap-1.5">
                <span className="metric text-[1rem] text-[var(--accent)]">
                  {formatDuration(porVender)}
                </span>
                <span className="text-[0.75rem] text-[var(--ink-muted)]">
                  por vender
                </span>
              </span>
            </>
          ) : null}

          {totals.faltas > 0 ? (
            <>
              <Ponto />
              <span className="flex items-baseline gap-1.5">
                <span className="metric text-[1rem] text-[var(--bad)]">
                  {totals.faltas}
                </span>
                <span className="text-[0.75rem] text-[var(--ink-muted)]">
                  falta{totals.faltas === 1 ? '' : 's'}
                </span>
              </span>
            </>
          ) : null}

          {totals.porConfirmar > 0 ? (
            <span className="ml-auto inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--warn)]">
              {totals.porConfirmar} por confirmar
            </span>
          ) : null}
        </Card>

        {/*
          AS CASAS LADO A LADO, E A COLUNA DA DIREITA SAIU.

          As lojas empilhavam-se numa coluna de dois terços, com os
          números do mês ao lado — e a segunda casa ficava fora do ecrã.
          Abria-se o painel e via-se metade do salão.

          Os números mudaram-se para o separador ao lado, onde têm
          espaço para dizer mais do que um total. Aqui fica o livro, e o
          livro leva a página toda: uma coluna por casa a partir do
          `lg`, empilhadas antes disso.
        */}
        <div
          className={clsx(
            'grid items-start gap-3',
            abertas.length > 1 && 'lg:grid-cols-2',
          )}
        >
          {abertas.length === 0 ? (
            <Card className="px-4 py-8">
              <Empty
                title="Dia sem marcações"
                hint="Nada no livro para hoje, em nenhuma das casas."
              />
            </Card>
          ) : (
            abertas.map((unit) => (
              <AgendaCard
                key={unit.id}
                unit={unit}
                rows={apptsBy.get(unit.id) ?? []}
                windows={windowsBy.get(unit.id) ?? []}
                day={day}
                now={now}
                currency={currency}
                soloTitle={units.length === 1}
              />
            ))
          )}
        </div>

        {paradas.length > 0 ? (
          <p className="px-1 text-[0.8125rem] text-[var(--ink-faint)]">
            {paradas.map((u) => u.name).join(' · ')} ·{' '}
            {paradas.length === 1 ? 'dia sem marcações' : 'dias sem marcações'}
          </p>
        ) : null}
      </section>
    </Moldura>
  )
}

// ---------------------------------------------------------------------
// A moldura: o título, o dia, e os dois separadores
// ---------------------------------------------------------------------

export type Vista = 'agenda' | 'numeros'

/**
 * O QUE OS DOIS SEPARADORES TÊM EM COMUM.
 *
 * São ligações, não botões: a vista vive no endereço, e por isso o
 * botão de trás volta a ela e um atalho guardado abre onde se deixou.
 * Sem estado do lado do cliente, sem código a correr no telemóvel.
 */
function Moldura({
  day,
  tz,
  vista,
  children,
}: {
  day: IsoDay
  tz: string
  vista: Vista
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-[110rem] space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <header className="surge flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="display text-[1.75rem] leading-none text-[var(--ink)]">
            Hoje
          </h1>
          <span aria-hidden className="fio-casa mt-3" />
        </div>
        <p className="tabular text-[0.8125rem] text-[var(--ink-muted)]">
          {formatDayLong(day, tz)}
        </p>
      </header>

      <nav
        aria-label="Vista"
        className="surge surge-1 inline-flex gap-[3px] rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] p-[3px]"
      >
        <Separador href="/" activo={vista === 'agenda'}>
          Agenda
        </Separador>
        <Separador href="/?v=numeros" activo={vista === 'numeros'}>
          Números
        </Separador>
      </nav>

      <div className="surge surge-1">{children}</div>
    </div>
  )
}

function Separador({
  href,
  activo,
  children,
}: {
  href: string
  activo: boolean
  children: string
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      className={clsx(
        'inline-flex items-center rounded-[var(--radius-sm)] px-4 py-1.5 text-[0.8125rem] transition-colors',
        activo
          ? 'bg-[var(--surface-raised)] font-semibold text-[var(--ink)] shadow-[0_1px_3px_rgba(28,25,23,0.1)]'
          : 'font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]',
      )}
    >
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------
// A agenda de uma casa
// ---------------------------------------------------------------------

function AgendaCard({
  unit,
  rows,
  windows,
  day,
  now,
  currency,
  soloTitle,
}: {
  unit: Unit
  rows: ApptRow[]
  windows: { openMin: number; closeMin: number }[]
  day: IsoDay
  now: Date
  currency: string
  /** Com uma casa só, o nome dela já está na barra de cima. */
  soloTitle: boolean
}) {
  const slots = buildSlots(rows, windows, unit.timezone)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3">
        <h2 className="panel-title">
          {soloTitle ? 'O dia' : `O dia em ${unit.name}`}
        </h2>
        <Link
          href={`/agenda/${unit.slug}`}
          className="shrink-0 text-[0.75rem] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]"
        >
          Abrir agenda →
        </Link>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        {slots.map((slot) =>
          slot.kind === 'appt' ? (
            <Marcacao
              key={slot.row.id}
              row={slot.row}
              unit={unit}
              now={now}
              currency={currency}
            />
          ) : (
            <Folga
              key={`gap:${slot.fromMin}`}
              slot={slot}
              unit={unit}
              day={day}
            />
          ),
        )}
      </div>

      {/* A porta que faltava. Marcar era só possível a partir da agenda
          da loja, e este painel é onde se está quando alguém telefona. */}
      <Link
        href={`/agenda/${unit.slug}/encaixe?${DAY_PARAM}=${day}`}
        className="flex h-11 items-center justify-center gap-1.5 border-t border-[var(--line-soft)] text-[0.8125rem] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--surface-sunken)]"
      >
        <span aria-hidden className="text-base leading-none">+</span>
        Nova marcação
      </Link>
    </Card>
  )
}

/**
 * Uma marcação. A hora e a duração à esquerda, num pilar estreito e
 * tabular — é o que faz as linhas alinharem-se todas pela mesma coluna.
 * O fio de cor à esquerda diz o estado antes de se ler o que quer que
 * seja.
 */
function Marcacao({
  row,
  unit,
  now,
  currency,
}: {
  row: ApptRow
  unit: Unit
  now: Date
  currency: string
}) {
  const passada = row.status === 'completed' || row.status === 'no_show'
  /*
    EM CURSO — QUEM O DIZ É O RELÓGIO, NÃO UM BOTÃO.

    Lia os estados «chegou» e «em atendimento», que dependiam de alguém
    os ter carregado no painel da marcação. Como ninguém os carregava,
    esta barra de progresso — que diz quanto falta da visita que está a
    decorrer — praticamente nunca aparecia. Agora conta-se do relógio, e
    aparece sempre que é verdade.
  */
  const emCurso =
    !passada &&
    now.getTime() >= row.starts_at.getTime() &&
    now.getTime() < row.ends_at.getTime()

  const duracaoMs = Math.max(60000, row.ends_at.getTime() - row.starts_at.getTime())
  const minutos = Math.round(duracaoMs / 60000)

  // Quanto do serviço já passou, e quanto falta. Só faz sentido na que
  // está a decorrer — e é isto que substitui a linha do «agora»: a
  // marcação diz por dentro em que ponto vai, sem nada lhe passar por
  // cima do nome.
  const decorrido = now.getTime() - row.starts_at.getTime()
  const fracao = Math.min(1, Math.max(0, decorrido / duracaoMs))
  const faltam = Math.max(0, Math.round((row.ends_at.getTime() - now.getTime()) / 60000))

  return (
    <Link
      href={`/agenda/${unit.slug}?m=${row.id}`}
      className="flex gap-3 rounded-[var(--radius-sm)] border border-[var(--line-soft)] border-l-[3px] py-2.5 pl-2.5 pr-3 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
      style={{
        borderLeftColor: railColour(row.status),
        background: emCurso
          ? 'color-mix(in srgb, var(--accent) 4%, var(--surface-raised))'
          : 'var(--surface-raised)',
      }}
    >
      <span className="w-[2.75rem] shrink-0">
        <span
          className="tabular block text-[0.8125rem] font-bold leading-none"
          style={{
            color: passada ? 'var(--ink-faint)' : 'var(--accent)',
          }}
        >
          {formatTime(row.starts_at, unit.timezone)}
        </span>
        <span className="tabular mt-1 block text-[0.6875rem] leading-none text-[var(--ink-faint)]">
          {formatDuration(minutos)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]"
            style={passada ? { color: 'var(--ink-muted)' } : undefined}
          >
            {row.client_name}
          </span>
          <Selo status={row.status} valor={row.revenue_cents} currency={currency} />
        </span>

        <span className="mt-0.5 block truncate text-[0.75rem] text-[var(--ink-faint)]">
          {row.services ?? '—'}
          {row.staff_names ? ` · ${shortNames(row.staff_names)}` : ''}
        </span>

        {emCurso ? (
          <span className="mt-2 flex items-center gap-2">
            <span
              aria-hidden
              className="h-1 flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
            >
              <span
                className="block h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.round(fracao * 100)}%` }}
              />
            </span>
            <span className="tabular shrink-0 text-[0.6875rem] font-bold text-[var(--accent)]">
              {faltam > 0 ? `faltam ${formatDuration(faltam)}` : 'a terminar'}
            </span>
          </span>
        ) : null}
      </span>
    </Link>
  )
}

/**
 * O vazio entre duas marcações. Um fio com o tempo escrito ao meio.
 *
 * As folgas pequenas são factos e ficam em cinzento; a partir de hora e
 * meia passam a ser lugar por vender, e ganham a cor de aviso e a porta
 * para o encaixe — já com o dia e a hora no endereço.
 */
function Folga({
  slot,
  unit,
  day,
}: {
  slot: Extract<Slot, { kind: 'gap' }>
  unit: Unit
  day: IsoDay
}) {
  const minutos = slot.toMin - slot.fromMin
  const vendavel = minutos >= FOLGA_VENDAVEL

  const texto =
    slot.edge === 'open'
      ? `abre às ${formatMinutes(slot.fromMin)} · ${formatDuration(minutos)} livre`
      : slot.edge === 'close'
        ? `${formatDuration(minutos)} · fecha às ${formatMinutes(slot.toMin)}`
        : formatDuration(minutos)

  const fio = vendavel
    ? 'color-mix(in srgb, var(--warn) 28%, transparent)'
    : 'var(--line)'

  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="h-px flex-1" style={{ background: fio }} />
      {vendavel ? (
        <Link
          href={`/agenda/${unit.slug}/encaixe?${DAY_PARAM}=${day}&${TIME_PARAM}=${encodeURIComponent(formatMinutes(slot.fromMin))}`}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 text-[0.75rem] font-semibold text-[var(--warn)] transition-colors hover:bg-[color-mix(in_srgb,var(--warn)_18%,transparent)]"
        >
          <span aria-hidden className="text-sm leading-none">+</span>
          {formatDuration(minutos)} livres · encaixar
        </Link>
      ) : (
        <span className="shrink-0 text-[0.6875rem] text-[var(--ink-faint)]">
          {texto}
        </span>
      )}
      <span aria-hidden className="h-px flex-1" style={{ background: fio }} />
    </div>
  )
}

/**
 * O que se diz do lado direito de uma marcação. Só há selo quando há
 * alguma coisa a dizer: uma marcação confirmada e ainda por vir está
 * exactamente como devia estar, e não precisa de etiqueta nenhuma.
 */
function Selo({
  status,
  valor,
  currency,
}: {
  status: Status
  /** O que a marcação vale. Dizia o que tinha sido cobrado. */
  valor: number
  currency: string
}) {
  if (status === 'completed') {
    return (
      <span className="tabular shrink-0 text-[0.75rem] font-bold text-[var(--ok)]">
        {formatCents(valor, currency)}
      </span>
    )
  }

  const selos: Partial<Record<Status, { texto: string; cor: string; cheio?: boolean }>> = {
    in_service: { texto: 'Em curso', cor: 'var(--accent)', cheio: true },
    checked_in: { texto: 'Chegou', cor: 'var(--warn)' },
    booked: { texto: 'Por confirmar', cor: 'var(--warn)' },
    no_show: { texto: 'Faltou', cor: 'var(--bad)' },
  }

  const selo = selos[status]
  if (!selo) return null

  return (
    <span
      className="shrink-0 rounded-full px-2 py-[0.1875rem] text-[0.625rem] font-bold leading-none"
      style={
        selo.cheio
          ? { background: selo.cor, color: 'var(--accent-ink)', letterSpacing: '0.06em', textTransform: 'uppercase' }
          : {
              background: `color-mix(in srgb, ${selo.cor} 12%, transparent)`,
              color: selo.cor,
            }
      }
    >
      {selo.texto}
    </span>
  )
}

/**
 * A coluna vem da base já com as profissionais juntas por vírgulas —
 * encurtar a corda inteira dava «Ady Ramirez.», que é meia pessoa
 * colada à outra metade de outra. Encurta-se uma a uma.
 */
function shortNames(joined: string): string {
  return joined
    .split(', ')
    .map((name) => shortName(name))
    .join(', ')
}

function railColour(status: Status): string {
  if (status === 'no_show') return 'var(--bad)'
  if (status === 'completed')
    return 'color-mix(in srgb, var(--accent) 30%, transparent)'
  return 'var(--accent)'
}

function Ponto() {
  return (
    <span
      aria-hidden
      className="h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--ink-faint)]"
    />
  )
}

// ---------------------------------------------------------------------
// As contas do dia
// ---------------------------------------------------------------------

/**
 * A agenda de uma casa, marcação a marcação, com os vazios pelo meio.
 *
 * O horário dá o princípio e o fim; as marcações dão os blocos
 * ocupados. O que sobra dentro do horário e não é curto de mais é
 * folga. Marcações sobrepostas — duas profissionais ao mesmo tempo —
 * fundem-se num bloco só: para efeitos de «a casa está livre?», duas
 * cadeiras ocupadas à mesma hora são uma hora ocupada.
 */
function buildSlots(
  rows: ApptRow[],
  windows: { openMin: number; closeMin: number }[],
  timezone: string,
): Slot[] {
  const marcacoes = rows.map((row) => ({
    row,
    from: minutesOfDay(row.starts_at, timezone),
    to: endMinutes(row, timezone),
  }))

  if (windows.length === 0) {
    return marcacoes.map((m) => ({ kind: 'appt' as const, row: m.row }))
  }

  // Os blocos ocupados, fundidos. É sobre estes que se recorta o
  // horário para saber o que sobra.
  const ocupado = merge(marcacoes.map((m) => [m.from, m.to]))

  const folgas: Extract<Slot, { kind: 'gap' }>[] = []
  const primeiraAbertura = windows[0]!.openMin
  const ultimoFecho = windows[windows.length - 1]!.closeMin

  for (const janela of windows) {
    let cursor = janela.openMin
    for (const [from, to] of ocupado) {
      if (to <= janela.openMin || from >= janela.closeMin) continue
      if (from - cursor >= FOLGA_MINIMA) {
        folgas.push({
          kind: 'gap',
          fromMin: cursor,
          toMin: from,
          edge: cursor === primeiraAbertura ? 'open' : null,
        })
      }
      cursor = Math.max(cursor, to)
    }
    if (janela.closeMin - cursor >= FOLGA_MINIMA) {
      folgas.push({
        kind: 'gap',
        fromMin: cursor,
        toMin: janela.closeMin,
        edge: janela.closeMin === ultimoFecho ? 'close' : null,
      })
    }
  }

  // Tudo por ordem de relógio: as folgas entram entre as marcações no
  // sítio onde realmente acontecem.
  const slots: { at: number; slot: Slot }[] = [
    ...marcacoes.map((m) => ({
      at: m.from,
      slot: { kind: 'appt' as const, row: m.row },
    })),
    ...folgas.map((g) => ({ at: g.fromMin, slot: g as Slot })),
  ]

  return slots.sort((a, b) => a.at - b.at).map((s) => s.slot)
}

/**
 * O fim de uma marcação, em minutos do dia. Uma marcação que atravessa
 * a meia-noite daria um número mais pequeno do que o do princípio —
 * e um bloco ao contrário engoliria a agenda toda.
 */
function endMinutes(row: ApptRow, timezone: string): number {
  const fim = minutesOfDay(row.ends_at, timezone)
  const inicio = minutesOfDay(row.starts_at, timezone)
  return fim > inicio ? fim : 1440
}

/** Intervalos sobrepostos, fundidos num só. */
function merge(spans: [number, number][]): [number, number][] {
  const ordenados = [...spans].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  for (const [from, to] of ordenados) {
    const ultimo = out[out.length - 1]
    if (ultimo && from <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], to)
    else out.push([from, to])
  }
  return out
}

