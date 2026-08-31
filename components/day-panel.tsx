import Link from 'next/link'
import clsx from 'clsx'
import { sql } from '@/lib/db'
import type { Org, Unit } from '@/lib/org'
import type { Actor } from '@/lib/auth/actor'
import { formatCents } from '@/lib/money'
import { receitaDaMarcacao } from '@/lib/dashboard'
import { ocupacaoDaSemana } from '@/lib/ocupacao'
import { PainelNumeros } from '@/components/painel-numeros'
import {
  dayEnd,
  dayStart,
  formatDayLong,
  formatDuration,
  formatTime,
  today,
  type IsoDay,
} from '@/lib/time'
import type { Status } from '@/lib/booking'
import { Card, Empty } from '@/components/ui'
import { semNome, shortName } from '@/lib/text'

/**
 * O PAINEL DO DIA. A raiz `/` é duas coisas: a montra para quem não tem
 * sessão, e isto para quem tem.
 *
 * DOIS SEPARADORES, E OS NÚMEROS ABREM PRIMEIRO.
 *
 * A página tinha o dia numa coluna de dois terços e os números do mês
 * ao lado — e com duas casas, a segunda ficava fora do ecrã: abria-se o
 * painel e via-se metade do salão.
 *
 * Agora são dois separadores, e quem abre são os Números: a ocupação, o
 * mapa das horas que sobram, as clientes que voltam ou não voltam. É o
 * que esta página tem de único — a agenda a sério tem porta própria na
 * coluna da esquerda, e é lá que se trabalha o dia.
 *
 * E POR ISSO A AGENDA DAQUI ENCOLHEU.
 *
 * Era um cartão por marcação, com a duração num pilar, os serviços por
 * extenso, quem faz, e uma barra de progresso na que estivesse a
 * decorrer — mais as folgas desenhadas entre elas, com a porta para o
 * encaixe. Tudo isso é o trabalho da agenda a sério, feito outra vez e
 * pior, num sítio onde não cabia.
 *
 * Fica uma linha por marcação: hora, nome, quem faz. As concluídas
 * apagam-se e mostram o que valeram. É o suficiente para saber como vai
 * o dia sem sair daqui, e para decidir se vale a pena sair.
 *
 * O recorte é o das lojas a que esta pessoa tem acesso. As fronteiras
 * de dia contam-se no fuso da rede; cada loja mostra as suas horas no
 * fuso dela.
 */



type ApptRow = {
  id: string
  unit_id: string
  status: Status
  starts_at: Date
  ends_at: Date
  client_name: string
  staff_names: string | null
  /** Quanto vale, já com desconto. Só se mostra depois de concluída. */
  revenue_cents: number
}

type MoneyRow = { unit_id: string; revenue_cents: number }


export async function DayPanel({
  actor,
  org,
  units,
  vista = 'numeros',
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
    três consultas — a lista do dia, o dinheiro por loja e a ocupação
    da semana. Ramificar depois de as fazer era pagá-las para as deitar
    fora.
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

  const [appts, money, ocupacao] =
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
          /* Os serviços por extenso saíram com a linha de baixo: eram a
             corda mais longa do cartão e a que menos decide. Quem os
             quer abre a agenda. */
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
        <Separador href="/" activo={vista === 'numeros'}>
          Números
        </Separador>
        <Separador href="/?v=agenda" activo={vista === 'agenda'}>
          Agenda
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

/**
 * A agenda de uma casa, marcação a marcação.
 *
 * Tinha aqui as folgas — o vazio entre duas marcações, com o tempo
 * escrito ao meio e uma porta para o encaixe a partir de hora e meia.
 * Saíram por duas razões: o separador dos Números passou a dizer o
 * mesmo somado («23 h 05 por vender»), e a agenda a sério continua a
 * mostrá-las uma a uma, que é onde se usam. Com elas saiu o horário da
 * loja, que só servia para saber onde a folga começa e acaba — menos
 * uma consulta por casa.
 */
function AgendaCard({
  unit,
  rows,
  now,
  currency,
  soloTitle,
}: {
  unit: Unit
  rows: ApptRow[]
  now: Date
  currency: string
  /** Com uma casa só, o nome dela já está na barra de cima. */
  soloTitle: boolean
}) {

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

      <div>
        {rows.map((row) => (
          <Marcacao
            key={row.id}
            row={row}
            unit={unit}
            now={now}
            currency={currency}
          />
        ))}
      </div>
    </Card>
  )
}

/**
 * UMA MARCAÇÃO, NUMA LINHA.
 *
 * Era um cartão com moldura: hora e duração num pilar, o nome, os
 * serviços por extenso e quem faz numa segunda linha, e uma barra de
 * progresso na que estivesse a decorrer. Isso é a agenda a sério, e a
 * agenda a sério está a um toque na coluna da esquerda — aqui era o
 * mesmo trabalho feito duas vezes, e a segunda casa ficava fora do
 * ecrã por causa dele.
 *
 * Fica o que se lê de relance: a hora, o nome, e quem a faz. Os
 * serviços saem porque são a linha mais longa e a que menos decide; a
 * duração sai porque a hora seguinte já a diz.
 *
 * A CONCLUÍDA APAGA-SE e mostra o que valeu. É a única diferença de
 * estado que sobra, e chega: o resto vê-se na agenda.
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
  const feita = row.status === 'completed'
  const passada = feita || row.status === 'no_show'

  /* A que está a decorrer é a única que ainda se assinala, e com um fio
     de cor à esquerda em vez de uma barra de progresso: aqui não há
     espaço para dizer quanto falta, e a agenda a sério di-lo. */
  const emCurso =
    !passada &&
    now.getTime() >= row.starts_at.getTime() &&
    now.getTime() < row.ends_at.getTime()

  return (
    <Link
      href={`/agenda/${unit.slug}?m=${row.id}`}
      className="flex items-baseline gap-3 border-t border-[var(--line-soft)] px-4 py-2 transition-colors first:border-t-0 hover:bg-[var(--surface-2)]"
      style={
        emCurso
          ? {
              background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
              boxShadow: 'inset 3px 0 0 var(--accent)',
            }
          : undefined
      }
    >
      <span
        className={clsx(
          'tabular w-[2.6rem] shrink-0 text-[0.8125rem] font-bold',
          passada ? 'text-[var(--ink-faint)]' : 'text-[var(--accent)]',
        )}
      >
        {formatTime(row.starts_at, unit.timezone)}
      </span>

      <span
        className={clsx(
          'min-w-0 flex-1 truncate text-[0.875rem]',
          semNome(row.client_name)
            ? 'italic text-[var(--ink-faint)]'
            : passada
              ? 'text-[var(--ink-faint)]'
              : 'font-medium text-[var(--ink)]',
        )}
      >
        {semNome(row.client_name) ? 'Sem nome' : row.client_name}
      </span>

      <span className="hidden shrink-0 text-[0.75rem] text-[var(--ink-faint)] sm:inline">
        {row.staff_names ? shortNames(row.staff_names) : ''}
      </span>

      <span className="tabular w-[3.5rem] shrink-0 text-right text-[0.75rem] font-bold">
        {feita ? (
          <span className="text-[var(--ok)]">
            {formatCents(row.revenue_cents, currency)}
          </span>
        ) : row.status === 'no_show' ? (
          <span className="text-[var(--bad)]">faltou</span>
        ) : null}
      </span>
    </Link>
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

function Ponto() {
  return (
    <span
      aria-hidden
      className="h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--ink-faint)]"
    />
  )
}

