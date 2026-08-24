import Link from 'next/link'
import Form from 'next/form'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { requireActor, resolveUnit, unitsFor, can } from '@/lib/auth/actor'
import { loadAgendaDay } from '@/lib/agenda'
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
import { AgendaGrid, AgendaList } from '@/components/agenda-grid'
import { AgendaFocus } from '@/components/agenda-focus'
import { AgendaPanorama } from '@/components/agenda-panorama'
import { AppointmentPanel } from '@/components/appointment-panel'
import { DeskDayStrip } from '@/components/desk-day-strip'
import { UnitSwitcher } from '@/components/unit-switcher'
import { ButtonLink, buttonClass } from '@/components/ui'
import { shortName } from '@/lib/text'

export const metadata: Metadata = { title: 'Agenda' }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A GRELHA DO DIA. A loja vive na barra de endereços; o dia e a
 * marcação aberta também — assim o retrocesso funciona e a ligação
 * pode ser partilhada.
 *
 * A profissional vê só a agenda dela — e no telemóvel vê o dia em
 * lista, cartão a cartão, em vez da grelha.
 */
export default async function AgendaDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ loja: string }>
  searchParams: Promise<{ d?: string; m?: string; p?: string }>
}) {
  const actor = await requireActor()
  const { loja } = await params
  const { d, m, p } = await searchParams

  // Loja inexistente e loja sem acesso dão a MESMA resposta.
  const unit = await resolveUnit(actor, loja)

  const now = new Date()
  const day: IsoDay = d && DAY_RE.test(d) ? d : today(unit.timezone, now)

  // A profissional vê só a agenda dela.
  const onlyStaffId = actor.role === 'professional' ? actor.id : null

  const [full, units, colorRows] = await Promise.all([
    loadAgendaDay(unit, day, { onlyStaffId }),
    unitsFor(actor),
    sql<{ id: string; display_color: string }[]>`
      select id, display_color from staff where org_id = ${unit.org_id}
    `,
  ])

  const colors = Object.fromEntries(
    colorRows.map((r) => [r.id, r.display_color]),
  )

  /*
    UMA PROFISSIONAL DE CADA VEZ — A SAÍDA PARA O ECRÃ ESTREITO.

    Com quatro colunas numa tela de 390px, cada uma fica com noventa
    píxeis e a agenda deixa de se ler: nome cortado, serviço cortado, e
    o dia a fugir para fora do ecrã. A escolha vive na barra de
    endereços, e não em memória do navegador, porque assim a dona pode
    guardar o endereço da agenda de uma pessoa e voltar lá amanhã.

    O dia carrega-se inteiro na mesma: a peneira é de olhar, não de
    perguntar à base outra vez. E o total de marcações do dia continua
    a contar-se do dia inteiro — é o dia da loja que ele conta, não o
    pedaço que está à vista.
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
  /** Trocar de dia nunca perde a pessoa escolhida, e vice-versa. */
  const withDay = (target: IsoDay, staffId: string | null = picked) =>
    `${here}?d=${target}${staffId ? `&p=${staffId}` : ''}`
  const hrefFor = (appointmentId: string | null) =>
    appointmentId ? `${withDay(day)}&m=${appointmentId}` : withDay(day)

  const todayDay = today(unit.timezone, now)
  const isToday = day === todayDay
  const nowMin = isToday
    ? Math.round((now.getTime() - dayStart(day, unit.timezone).getTime()) / 60_000)
    : null

  /*
    A CONTA É DO QUE ESTÁ NO ECRÃ, NÃO DO QUE ESTÁ NA BASE DE DADOS.

    Com uma profissional escolhida, dizer «11 marcações» quando se veem
    quatro é dar uma conta que ninguém consegue conferir. Conta-se o que
    está desenhado — e diz-se de quem é.
  */
  const appointmentCount = new Set(agenda.blocks.map((b) => b.appointmentId)).size
  const staffCount = agenda.columns.length
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
        */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-2.5 sm:flex-nowrap sm:px-6 sm:pt-3">
          <div className="min-w-0 flex-1 basis-full leading-tight sm:basis-auto">
            <h1 className="display truncate text-[1.0625rem] text-[var(--ink)] sm:text-lg">
              {capitalise(formatDayLong(day, unit.timezone))}
            </h1>
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
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <UnitSwitcher
              units={units}
              current={unit.slug}
              base="/agenda"
              showAll={false}
            />
            {can.overrideLeadRules(actor) ? (
              <ButtonLink href={`${here}/encaixe?d=${day}`} size="sm">
                Encaixe
              </ButtonLink>
            ) : null}
          </div>
        </div>

        {/* a semana, e o salto para um dia longe --------------------- */}
        {/*
          Envolve-se de propósito: no monitor a fita e o salto de data
          partilham a linha; no telemóvel o salto desce para baixo dela
          sozinho, sem que haja duas marcações do mesmo no ficheiro.
        */}
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
              O salto para um dia longe. Quem está a passar o livro de
              papel marca para daqui a três meses, e chegar lá de setas
              de semana em semana são doze toques. Aqui é um: no
              telemóvel abre o calendário do sistema.
            */}
            <Form action={here} scroll={false} className="flex items-center gap-1.5">
              <label htmlFor="agenda-dia" className="sr-only">
                Saltar para um dia
              </label>
              <input
                id="agenda-dia"
                type="date"
                name="d"
                defaultValue={day}
                className="tabular h-8 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2 text-base text-[var(--ink)] sm:text-[0.75rem]"
              />
              {picked ? <input type="hidden" name="p" value={picked} /> : null}
              <button type="submit" className={buttonClass('outline', 'sm')}>
                Ir
              </button>
            </Form>

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
        {!onlyStaffId && full.columns.length > 1 ? (
          <div className="relative border-t border-[var(--line-soft)]">
            <nav
              aria-label="Ver uma profissional"
              className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-4 py-1.5 sm:px-6 sm:py-2"
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
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--surface-raised)] to-transparent"
            />
          </div>
        ) : null}
      </div>

      {/* a grelha e o painel ----------------------------------------- */}
      <div className="relative flex min-h-0 flex-1">
        {/* Num ecrã estreito as colunas não cabem todas: este esbatido na
            margem direita é o que diz que o dia continua para o lado. Só
            faz sentido onde há mesmo mais do que uma coluna — e só onde
            há grelha, que abaixo de `md` já não há. */}
        {agenda.columns.length > 1 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-10 bg-gradient-to-l from-[var(--surface)] to-transparent md:block lg:hidden"
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
              chave={`${day}:${picked ?? ''}`}
            />
          ) : null}
          {/*
            NO TELEMÓVEL O DIA É UMA LISTA — PARA TODA A GENTE.

            Era só para a profissional, que vê uma coluna. A dona ficava
            com a grelha: três profissionais numa tela de 390px são cento
            e quarenta píxeis por coluna, com o nome da cliente cortado ao
            meio e o resto do dia a fugir de lado. A lista mostra o dia
            inteiro por ordem de hora e diz de quem é cada marcação — pela
            cor, a mesma das pastilhas aqui em cima. Quem quiser uma
            pessoa de cada vez toca-lhe na pastilha; a grelha volta a
            partir do tablet, que é onde ela cabe.
          */}
          <div className="md:hidden">
            <AgendaPanorama
              agenda={agenda}
              colors={colors}
              hrefFor={hrefFor}
              nowMin={nowMin}
            />
            <AgendaList
              agenda={agenda}
              colors={colors}
              hrefFor={hrefFor}
              nowMin={nowMin}
            />
          </div>
          <div className="hidden md:block">
            <AgendaGrid
              agenda={agenda}
              colors={colors}
              selectedId={selectedId}
              hrefFor={hrefFor}
              nowMin={nowMin}
            />
          </div>
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
function StaffChip({
  href,
  active,
  color,
  children,
}: {
  href: string
  active: boolean
  color?: string
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
          : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]',
      )}
    >
      {color ? (
        <span
          aria-hidden
          className="block h-1.5 w-1.5 rounded-full"
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
