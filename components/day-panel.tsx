import Link from 'next/link'
import { sql } from '@/lib/db'
import type { Org, Unit } from '@/lib/org'
import type { Actor } from '@/lib/auth/actor'
import { can } from '@/lib/auth/actor'
import { DAY_PARAM, TIME_PARAM } from '@/lib/cart'
import { formatCents } from '@/lib/money'
import { openingWindows } from '@/lib/hours'
import { receitaDaMarcacao } from '@/lib/dashboard'
import {
  addDays,
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
 * Três blocos: o dia, o mês, e o que precisa de mão. O recorte é o das
 * lojas a que esta pessoa tem acesso.
 *
 * As fronteiras de dia e de mês contam-se no fuso da rede; cada loja
 * mostra as suas horas no fuso dela.
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
type MonthRow = { current_cents: number; previous_cents: number }
type DailyRow = { day: string; cents: number }

/** Uma linha da agenda: ou é uma marcação, ou é o vazio entre duas. */
type Slot =
  | { kind: 'appt'; row: ApptRow }
  | { kind: 'gap'; fromMin: number; toMin: number; edge: 'open' | 'close' | null }

export async function DayPanel({
  actor,
  org,
  units,
}: {
  actor: Actor
  org: Org
  units: Unit[]
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

  const dayFrom = dayStart(day, tz)
  const dayTo = dayEnd(day, tz)

  const monthStart: IsoDay = `${day.slice(0, 7)}-01`
  const dayOfMonth = Number(day.slice(8, 10))
  const previousMonthStart = previousMonth(monthStart)
  // Compara-se período com período: do dia 1 até ao mesmo dia do mês.
  // Com o tecto no fim do mês anterior: a 30 de março, «o mesmo dia» de
  // fevereiro transbordava para 2 de março e os primeiros dias do mês
  // corrente contavam nas duas somas ao mesmo tempo.
  const previousSameDay = addDays(previousMonthStart, dayOfMonth - 1)
  const previousCutRaw = dayEnd(previousSameDay, tz)
  const currentMonthFrom = dayStart(monthStart, tz)
  const previousCut =
    previousCutRaw < currentMonthFrom ? previousCutRaw : currentMonthFrom

  const ids = units.map((u) => u.id)

  const [appts, money, monthRows, dailyRows, windows] =
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

      sql<MonthRow[]>`
        select
          coalesce(sum(${receitaDaMarcacao()}) filter (
            where a.starts_at >= ${dayStart(monthStart, tz)}
              and a.starts_at < ${dayTo}
          ), 0)::int as current_cents,
          coalesce(sum(${receitaDaMarcacao()}) filter (
            where a.starts_at >= ${dayStart(previousMonthStart, tz)}
              and a.starts_at < ${previousCut}
          ), 0)::int as previous_cents
        from appointment a
        where a.unit_id = any(${ids}::uuid[]) and a.status = 'completed'
      `,

      sql<DailyRow[]>`
        select
          to_char((a.starts_at at time zone ${tz})::date, 'YYYY-MM-DD') as day,
          sum(${receitaDaMarcacao()})::int as cents
        from appointment a
        where a.unit_id = any(${ids}::uuid[])
          and a.status = 'completed'
          and a.starts_at >= ${dayStart(monthStart, tz)}
          and a.starts_at < ${dayTo}
        group by 1
        order by 1
      `,

      // O horário de hoje, loja a loja — é o que dá princípio e fim à
      // agenda, e sem ele uma folga não sabe onde acaba.
      Promise.all(units.map((u) => openingWindows(u.id, day))),
    ])

  const revenueBy = new Map(money.map((r) => [r.unit_id, r.revenue_cents]))
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

  const month = monthRows[0] ?? { current_cents: 0, previous_cents: 0 }
  const currency = org.currency
  const daily = fillMonth(monthStart, dayOfMonth, dailyRows)

  // As casas com gente hoje ganham cartão; as paradas dizem-no numa
  // linha. Um cartão vazio por loja fechada era meio ecrã de nada.
  const abertas = units.filter((u) => (apptsBy.get(u.id)?.length ?? 0) > 0)
  const paradas = units.filter((u) => (apptsBy.get(u.id)?.length ?? 0) === 0)

  /*
    «A TRATAR» FICOU COM UMA LINHA SÓ.

    Eram duas — as marcações por confirmar e as comissões por pagar — e
    havia aqui um cuidado por causa da segunda: a gerente não tratava de
    comissões, e um cartão com uma linha que ela não podia ver abria-se
    vazio. As comissões saíram e o cuidado saiu com elas.

    O cartão continua a esconder-se quando não há nada: um «A tratar»
    sem nada dentro é uma pergunta a que já se respondeu.
  */
  const tratar = totals.porConfirmar > 0

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

      {/* ---------------------------------------------------- HOJE --- */}
      <section aria-label="O dia" className="surge surge-1 space-y-3">
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

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3">
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

            {paradas.length > 0 ? (
              <p className="px-1 text-[0.8125rem] text-[var(--ink-faint)]">
                {paradas.map((u) => u.name).join(' · ')} ·{' '}
                {paradas.length === 1 ? 'dia sem marcações' : 'dias sem marcações'}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-3">
            {units.length > 1 ? (
              <Card className="overflow-hidden">
                <SectionTitle>Por loja</SectionTitle>
                <ul className="divide-y divide-[var(--line-soft)]">
                  {units.map((unit) => {
                    const lista = apptsBy.get(unit.id) ?? []
                    return (
                      <li key={unit.id} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link
                            href={`/agenda/${unit.slug}`}
                            className="truncate text-sm font-medium text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                          >
                            {unit.name}
                          </Link>
                          <span className="tabular shrink-0 text-[0.8125rem] font-semibold text-[var(--ink)]">
                            {formatCents(revenueBy.get(unit.id) ?? 0, currency)}
                          </span>
                        </div>
                        <p className="tabular mt-1 text-[0.75rem] text-[var(--ink-faint)]">
                          {lista.length === 0
                            ? 'Dia sem marcações.'
                            : `${lista.length} marcaç${lista.length === 1 ? 'ão' : 'ões'} · ${
                                lista.filter((a) => a.status === 'completed').length
                              } feita${
                                lista.filter((a) => a.status === 'completed')
                                  .length === 1
                                  ? ''
                                  : 's'
                              }`}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            ) : null}

            {/* ------------------------------------------- O MÊS --- */}
            <Card className="px-4 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[0.8125rem] font-medium text-[var(--ink-muted)]">
                  O mês, até hoje
                </p>
                <p className="text-[0.75rem] text-[var(--ink-faint)]">
                  {monthName(day, tz)} · dias 1 a {dayOfMonth}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="metric text-[1.5rem] text-[var(--ink)]">
                  {formatCents(month.current_cents, currency)}
                </span>
                <Variacao
                  current={month.current_cents}
                  previous={month.previous_cents}
                />
              </div>
              <p className="mt-1.5 text-[0.75rem] text-[var(--ink-faint)]">
                {month.previous_cents > 0
                  ? `${formatCents(month.previous_cents, currency)} em ${monthName(previousMonthStart, tz)}, no mesmo período`
                  : 'Sem mês anterior para comparar.'}
              </p>
              {/* A forma do mês só a partir do tablet: no telemóvel a
                  tira serve para dizer o número, e mais uma fila de
                  barras era mais um ecrã a rolar. */}
              <div className="mt-3 hidden sm:block">
                <MonthChart daily={daily} currency={currency} timezone={tz} />
              </div>
            </Card>

            {/* ----------------------------------------- A TRATAR --- */}
            {tratar ? (
              <Card className="overflow-hidden">
                <SectionTitle>A tratar</SectionTitle>
                <ul className="divide-y divide-[var(--line-soft)]">
                  {totals.porConfirmar > 0 ? (
                    <li className="px-4 py-3">
                      <p className="text-[0.8125rem] font-medium text-[var(--ink)]">
                        {totals.porConfirmar} marcaç
                        {totals.porConfirmar === 1 ? 'ão' : 'ões'} por confirmar
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
                        Ainda hoje, na lista ao lado.
                      </p>
                    </li>
                  ) : null}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      </section>
    </div>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="panel-title border-b border-[var(--line-soft)] px-4 py-3">
      {children}
    </p>
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

// ---------------------------------------------------------------------
// Contas de calendário e de texto
// ---------------------------------------------------------------------

function previousMonth(monthStart: IsoDay): IsoDay {
  const year = Number(monthStart.slice(0, 4))
  const month = Number(monthStart.slice(5, 7))
  return month === 1
    ? `${year - 1}-12-01`
    : `${year}-${String(month - 1).padStart(2, '0')}-01`
}

function monthName(day: IsoDay, timezone: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    month: 'long',
    timeZone: timezone,
  }).format(dayStart(day, timezone))
}

/** Os dias do mês até hoje, com zeros nos dias sem dinheiro. */
function fillMonth(
  monthStart: IsoDay,
  days: number,
  rows: DailyRow[],
): DailyRow[] {
  const found = new Map(rows.map((r) => [r.day, r.cents]))
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(monthStart, i)
    return { day, cents: found.get(day) ?? 0 }
  })
}

/**
 * A variação em três caracteres, na pastilha ao lado do número. A frase
 * inteira («face ao mês anterior») repetia a linha de baixo, que já diz
 * de que mês se está a falar.
 */
function Variacao({
  current,
  previous,
}: {
  current: number
  previous: number
}) {
  if (previous === 0) {
    return current > 0 ? (
      <span className="text-[0.75rem] text-[var(--ink-faint)]">
        sem comparação
      </span>
    ) : null
  }

  const percent = Math.round(((current - previous) / previous) * 100)
  const bom = current >= previous
  const cor = bom ? 'var(--ok)' : 'var(--bad)'

  return (
    <span
      className="tabular inline-flex rounded-full px-1.5 py-[0.1875rem] text-[0.75rem] font-bold leading-none"
      style={{
        color: cor,
        background: `color-mix(in srgb, ${cor} 12%, transparent)`,
      }}
    >
      {percent > 0 ? '+' : ''}
      {percent}%
    </span>
  )
}

/**
 * Um gráfico de barras sem biblioteca nenhuma: são divs com altura em
 * percentagem. Serve o propósito — ver a forma do mês.
 *
 * O dia de hoje vai na segunda cor: é o único que ainda não fechou, e
 * ficar mais baixo do que os outros não quer dizer mau dia — quer dizer
 * meio-dia. Sem isso, a última barra mentia todas as manhãs.
 */
function MonthChart({
  daily,
  currency,
  timezone,
}: {
  daily: DailyRow[]
  currency: string
  timezone: string
}) {
  const peak = Math.max(1, ...daily.map((d) => d.cents))
  const ultimo = daily.length - 1

  return (
    <div className="flex h-20 items-end gap-[3px] border-b border-[var(--line-soft)] pb-px">
      {daily.map((d, i) => (
        <div
          key={d.day}
          className="group relative flex-1"
          title={`${d.day.slice(8)} · ${formatCents(d.cents, currency)}`}
        >
          <div
            className="cresce w-full rounded-t-[3px] transition-opacity group-hover:opacity-70"
            style={{
              height: `${Math.round((d.cents / peak) * 72)}px`,
              minHeight: d.cents > 0 ? '3px' : '2px',
              background: i === ultimo ? 'var(--gold)' : 'var(--accent)',
              opacity: d.cents > 0 ? 1 : 0.14,
              // Uma vaga da esquerda para a direita, e não trinta e um
              // saltos ao mesmo tempo: doze milésimos por dia chega para
              // se ler como uma varredura e acaba antes de incomodar.
              ['--atraso' as string]: `${i * 12}ms`,
            }}
          />
        </div>
      ))}
      <span className="sr-only">
        Faturação diária do mês, no fuso {timezone}.
      </span>
    </div>
  )
}
