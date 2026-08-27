import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ChevronDown, Columns3, Rows3, Users } from 'lucide-react'
import { requireActor, resolveUnit, unitsFor, can } from '@/lib/auth/actor'
import { loadAgendaDay, type AgendaScope } from '@/lib/agenda'
import { getAppointment } from '@/lib/booking'
import { sql } from '@/lib/db'
import {
  addDays,
  dayStart,
  formatDayLong,
  isoRange,
  today,
  type IsoDay,
} from '@/lib/time'
import {
  AgendaGrid,
  AgendaList,
  larguraMinimaDaGrelha,
} from '@/components/agenda-grid'
import { AgendaFocus } from '@/components/agenda-focus'
import { AppointmentPanel } from '@/components/appointment-panel'
import { DayJump } from '@/components/day-jump'
import { DeskDayStrip } from '@/components/desk-day-strip'
import { UnitSwitcher } from '@/components/unit-switcher'
import { ButtonLink, buttonClass } from '@/components/ui'
import { shortName } from '@/lib/text'

export const metadata: Metadata = { title: 'Agenda' }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const day: IsoDay = d && DAY_RE.test(d) ? d : today(unit.timezone, now)
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

  // A profissional vê só a agenda dela.
  const onlyStaffId = actor.role === 'professional' ? actor.id : null

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

  const selectedId = m && UUID_RE.test(m) ? m : null
  const selected = selectedId ? await getAppointment(selectedId) : null

  // Marcação de outra loja (ou de outra rede) não se abre aqui.
  if (selected && selected.unit_id !== unit.id) notFound()
  if (
    selected &&
    onlyStaffId &&
    !selected.items.some((i) => i.staff_id === onlyStaffId)
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
  const nowMin = isToday
    ? Math.round((now.getTime() - dayStart(day, unit.timezone).getTime()) / 60_000)
    : null

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

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-3.5rem)]">
      {/* a fita do dia ------------------------------------------------ */}
      <div className="shrink-0 border-b border-[var(--line-soft)] bg-[var(--surface-raised)]">
        {/* que dia é, onde, e o que se pode fazer -------------------- */}
        {/*
          No telemóvel a data fica com a linha toda para ela (basis-full):
          a partilhar a linha com o selector de loja e o Encaixe, ficava
          «Segunda-fei…», que é pior do que não estar lá. No monitor há
          espaço de sobra e voltam todos à mesma linha.

          O TÍTULO É O CALENDÁRIO: tocar na data abre o selector nativo.
          A linha que existia só para «saltar para um dia» — campo, «Ir»,
          rótulo — foi-se, e com ela um dedo de altura do ecrã pequeno.
        */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-2.5 sm:flex-nowrap sm:px-6 sm:pt-3">
          <div className="min-w-0 flex-1 basis-full leading-tight sm:basis-auto">
            <DayJump
              day={day}
              hrefTemplate={withDay('{d}')}
              className="block max-w-full"
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
            <p className="truncate text-[0.6875rem] text-[var(--ink-faint)]">
              {unit.name} ·{' '}
              {appointmentCount === 1
                ? '1 marcação'
                : `${appointmentCount} marcações`}
              {onlyStaffId
                ? ''
                : pickedName
                  ? ` · ${shortName(pickedName)}`
                  : staffCount === 1
                    ? ' · 1 profissional'
                    : ` · ${staffCount} profissionais`}
              {!onlyStaffId && !pickedName && offCount > 0
                ? ` · ${offCount} de folga`
                : ''}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <UnitSwitcher
              units={units}
              current={unit.slug}
              base="/agenda"
              showAll={false}
            />
            {encaixeHref ? (
              <ButtonLink href={`${here}/encaixe?d=${day}`} size="sm">
                Encaixe
              </ButtonLink>
            ) : null}
          </div>
        </div>

        {/* a semana, a vista, e a volta a hoje ----------------------- */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 sm:py-2.5">
          <div className="min-w-[15rem] flex-1">
            <DeskDayStrip
              dense
              days={stripDays}
              active={day}
              today={todayDay}
              timezone={unit.timezone}
              hrefFor={(value) => withDay(value)}
              prevHref={withDay(addDays(day, -7))}
              nextHref={withDay(addDays(day, 7))}
            />
          </div>

          <div className="flex items-center gap-1.5">
            {/*
              LISTA OU GRELHA, POR ESTA ORDEM. A lista mostra o dia
              como texto — quem vem, o que faz, quanto é; a grelha
              mostra-o como espaço — onde está cheio, onde há buracos.
              São perguntas diferentes, e a primeira é a que se faz mais
              vezes, por isso é a que abre e a que fica à esquerda: a
              ordem dos botões conta a mesma história que a omissão.
              A escolha fica no endereço, como tudo o resto.
            */}
            <div
              role="group"
              aria-label="Como ver o dia"
              className="flex h-8 items-center overflow-hidden rounded-[var(--radius)] border border-[var(--line)]"
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

            {/*
              A PORTA PARA A SEMANA.

              Fica ao lado da vista porque é da mesma família — é outra
              maneira de olhar para a mesma agenda — mas não entra no
              interruptor lista/grelha: esses dois desenham O DIA, e a
              semana é outra pergunta, com endereço próprio. Leva o dia
              aberto consigo, para abrir na semana a que ele pertence.
            */}
            <Link
              href={`${here}/semana?d=${day}`}
              title="Panorama da semana"
              className={buttonClass('quiet', 'sm')}
            >
              Semana
            </Link>

            {!isToday ? (
              <Link
                href={withDay(todayDay)}
                scroll={false}
                className={buttonClass('quiet', 'sm')}
              >
                Hoje
              </Link>
            ) : null}
          </div>
        </div>

        {/* uma profissional de cada vez ------------------------------ */}
        {!onlyStaffId && (full.columns.length > 1 || scope === 'equipa') ? (
          <div className="flex items-center gap-1 border-t border-[var(--line-soft)] pr-3 sm:gap-1.5 sm:pr-5">
            <div className="relative min-w-0 flex-1">
              <nav
                aria-label="Ver uma profissional"
                className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1.5 pl-4 pr-6 sm:py-2 sm:pl-6"
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
              */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--surface-raised)] to-transparent"
              />
            </div>
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
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.6875rem] font-semibold tracking-[0.01em] shadow-[0_1px_2px_rgba(28,24,21,0.06)] transition-colors',
                scope === 'equipa'
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:text-[var(--ink)]',
              )}
            >
              <Users aria-hidden className="h-3.5 w-3.5" />
              {scope === 'equipa' ? 'Só hoje' : 'Equipa'}
            </Link>
          </div>
        ) : null}
      </div>

      {/* a grelha e o painel ----------------------------------------- */}
      <div className="relative flex min-h-0 flex-1">
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
        <div
          data-rolo-agenda
          className="min-w-0 flex-1 overflow-auto overscroll-contain"
        >
          {focusMin !== null ? (
            <AgendaFocus
              focusMin={focusMin}
              fromMin={agenda.fromMin}
              chave={`${day}:${picked ?? ''}:${view}`}
            />
          ) : null}
          {view === 'lista' ? (
            <AgendaList
              agenda={agenda}
              colors={colors}
              selectedId={selectedId}
              hrefFor={hrefFor}
              encaixeHref={encaixeHref}
              nowMin={nowMin}
            />
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
            : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]',
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
