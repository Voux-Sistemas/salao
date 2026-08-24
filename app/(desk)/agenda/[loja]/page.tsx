import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ChevronDown, Columns3, Rows3 } from 'lucide-react'
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
 * A GRELHA É A VISTA PRINCIPAL EM TODOS OS ECRÃS. No telemóvel as
 * colunas apertam-se até caberem todas (e é cada coluna que decide o
 * que ainda se lê lá dentro — ver `agenda-grid`); a lista fica a um
 * toque, em `?v=lista`, para quem quer LER o dia em vez de o ver.
 * Desenha-se UMA vista, não as duas com o CSS a esconder a outra:
 * metade do DOM da agenda escondido era peso que o telemóvel pagava
 * sem nunca o mostrar.
 */
export default async function AgendaDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ loja: string }>
  searchParams: Promise<{ d?: string; m?: string; p?: string; v?: string }>
}) {
  const actor = await requireActor()
  const { loja } = await params
  const { d, m, p, v } = await searchParams

  // Loja inexistente e loja sem acesso dão a MESMA resposta.
  const unit = await resolveUnit(actor, loja)

  const now = new Date()
  const day: IsoDay = d && DAY_RE.test(d) ? d : today(unit.timezone, now)
  /** A vista: grelha por omissão, lista para quem a pedir. */
  const view: 'grelha' | 'lista' = v === 'lista' ? 'lista' : 'grelha'

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
  /** Trocar de dia nunca perde a pessoa escolhida nem a vista. */
  const withDay = (
    target: IsoDay,
    staffId: string | null = picked,
    nextView: 'grelha' | 'lista' = view,
  ) =>
    `${here}?d=${target}${staffId ? `&p=${staffId}` : ''}${
      nextView === 'lista' ? '&v=lista' : ''
    }`
  const hrefFor = (appointmentId: string | null) =>
    appointmentId ? `${withDay(day)}&m=${appointmentId}` : withDay(day)
  /*
    O ENCAIXE JÁ COM A HORA NA MÃO. É isto que faz dos buracos da
    grelha portas: meia hora livre leva direita ao encaixe com o dia e
    a hora postos. Só para quem pode marcar — a profissional vê a
    agenda dela, não a escreve.
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
              GRELHA OU LISTA. A grelha mostra o dia como espaço — onde
              está cheio, onde há buracos; a lista mostra-o como texto —
              quem vem, o que faz, quanto é. São perguntas diferentes e
              a escolha fica no endereço, como tudo o resto.
            */}
            <div
              role="group"
              aria-label="Como ver o dia"
              className="flex h-8 items-center overflow-hidden rounded-[var(--radius)] border border-[var(--line)]"
            >
              <Link
                href={withDay(day, picked, 'grelha')}
                scroll={false}
                title="Grelha do dia"
                aria-current={view === 'grelha' ? 'true' : undefined}
                className={clsx(
                  'flex h-full w-9 items-center justify-center transition-colors',
                  view === 'grelha'
                    ? 'bg-[var(--surface-2)] text-[var(--ink)]'
                    : 'text-[var(--ink-faint)] hover:text-[var(--ink)]',
                )}
              >
                <Columns3 aria-hidden className="h-4 w-4" />
              </Link>
              <Link
                href={withDay(day, picked, 'lista')}
                scroll={false}
                title="Lista do dia"
                aria-current={view === 'lista' ? 'true' : undefined}
                className={clsx(
                  'flex h-full w-9 items-center justify-center border-l border-[var(--line-soft)] transition-colors',
                  view === 'lista'
                    ? 'bg-[var(--surface-2)] text-[var(--ink)]'
                    : 'text-[var(--ink-faint)] hover:text-[var(--ink)]',
                )}
              >
                <Rows3 aria-hidden className="h-4 w-4" />
              </Link>
            </div>

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
        {/* Onde as colunas não cabem todas, este esbatido na margem
            direita diz que o dia continua para o lado. No telemóvel só
            acontece com cinco ou mais profissionais (a coluna mínima é
            5rem); no monitor, entre `md` e `lg`, quando o painel rouba
            espaço à grelha. */}
        {view === 'grelha' && agenda.columns.length > 1 ? (
          <div
            aria-hidden
            className={clsx(
              'pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-[var(--surface)] to-transparent lg:hidden',
              agenda.columns.length > 4 ? 'block' : 'hidden md:block',
            )}
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
