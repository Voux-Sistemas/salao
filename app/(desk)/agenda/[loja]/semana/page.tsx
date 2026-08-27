import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { requireActor, resolveUnit } from '@/lib/auth/actor'
import {
  loadAgendaWeek,
  mondayOf,
  type AgendaWeek,
  type WeekDay,
} from '@/lib/agenda-week'
import { shortName } from '@/lib/text'
import {
  addDays,
  formatMinutes,
  formatMonthShort,
  formatWeekdayShort,
  today,
  type IsoDay,
  isValidDay,
} from '@/lib/time'
import { Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Semana' }


/*
  A LARGURA DA COLUNA DOS NOMES, UMA VEZ SÓ.

  A régua das horas e as pistas têm de partilhar esta medida ao píxel —
  é o que faz o «12h» do cabeçalho cair em cima do meio-dia das pistas.
  Vive numa constante para não se poder desafinar uma sem a outra.
*/
const GOTEIRA = 'w-[4.5rem] sm:w-[5.75rem]'

/**
 * O PANORAMA DA SEMANA.
 *
 * A agenda do dia responde a «o que acontece hoje». Esta responde à
 * pergunta que se faz de manhã, com o café na mão: como está a semana —
 * quem tem o quê, e a que horas.
 *
 * NÃO É UMA GRELHA DE SETE DIAS, nem uma fila de percentagens. Por cada
 * dia, uma pista por profissional no eixo real das horas: o turno é o
 * fundo, cada marcação é um bloco na posição a que começa, com a
 * largura do que dura e a cor da ficha de quem a faz. Os buracos livres
 * não se desenham — aparecem sozinhos, como numa agenda de papel.
 *
 * Cada peça é uma porta: o cabeçalho do dia abre a agenda desse dia, um
 * bloco abre a própria marcação.
 */
export default async function SemanaPage({
  params,
  searchParams,
}: {
  params: Promise<{ loja: string }>
  searchParams: Promise<{ d?: string }>
}) {
  const actor = await requireActor()
  const { loja } = await params
  const { d } = await searchParams

  const unit = await resolveUnit(actor, loja)

  const now = new Date()
  const todayDay = today(unit.timezone, now)
  const day: IsoDay = d && isValidDay(d) ? d : todayDay

  // A profissional vê a semana dela, tal como vê o dia dela.
  const onlyStaffId = actor.role === 'professional' ? actor.id : null

  const week = await loadAgendaWeek(unit, day, { onlyStaffId })
  const equipa = new Map(week.staff.map((s) => [s.staffId, s]))

  const here = `/agenda/${unit.slug}/semana`
  const semana = (target: IsoDay) => `${here}?d=${target}`
  const diaHref = (target: IsoDay) => `/agenda/${unit.slug}?d=${target}`

  const estaSemana = mondayOf(todayDay) === week.from
  const vazia = week.days.every((x) => x.lanes.length === 0)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6 lg:py-8">
      {/* A volta é para o dia que se estava a ver, não para hoje. */}
      <Link
        href={diaHref(day)}
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)] lg:mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à agenda
      </Link>

      <header className="mb-4 lg:mb-6">
        <p className="titulo-seccao mb-1 lg:mb-2">{unit.name} · Semana</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="display text-2xl text-[var(--ink)] lg:text-3xl">
            {intervalo(week.from, week.to, unit.timezone)}
          </h1>

          <nav
            aria-label="Mudar de semana"
            className="flex h-8 items-center overflow-hidden rounded-[var(--radius)] border border-[var(--line)]"
          >
            <Link
              href={semana(addDays(week.from, -7))}
              title="Semana anterior"
              aria-label="Semana anterior"
              className="flex h-full w-9 items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </Link>
            <Link
              href={semana(addDays(week.from, 7))}
              title="Semana seguinte"
              aria-label="Semana seguinte"
              className="flex h-full w-9 items-center justify-center border-l border-[var(--line-soft)] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          </nav>

          {!estaSemana ? (
            <Link
              href={semana(todayDay)}
              className="text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
            >
              Esta semana
            </Link>
          ) : null}
        </div>

        <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
          {week.totals.appointments === 1
            ? '1 marcação'
            : `${week.totals.appointments} marcações`}
          {week.staff.length > 0 && !onlyStaffId
            ? ` · ${
                week.staff.length === 1
                  ? '1 profissional'
                  : `${week.staff.length} profissionais`
              }`
            : ''}
        </p>
      </header>

      {vazia && week.totals.appointments === 0 ? (
        <Empty
          title="Semana sem escala"
          hint="Ninguém tem turno nesta semana. As escalas fazem-se na ficha de cada profissional."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)]">
          <Regua fromMin={week.fromMin} toMin={week.toMin} />
          {week.days.map((dia) => (
            <DiaSemana
              key={dia.day}
              dia={dia}
              week={week}
              equipa={equipa}
              href={diaHref(dia.day)}
              hoje={dia.day === todayDay}
              timezone={unit.timezone}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Onde cai um minuto na pista, em percentagem da régua. */
function pos(min: number, week: Pick<AgendaWeek, 'fromMin' | 'toMin'>): number {
  return (100 * (min - week.fromMin)) / (week.toMin - week.fromMin)
}

/**
 * A régua das horas, uma vez para a semana toda. Marcas de três em três
 * horas: à hora a hora não cabem num telemóvel, e de três em três ainda
 * dizem «manhã, almoço, tarde, fim do dia», que é a precisão que uma
 * vista de longe precisa.
 */
function Regua({ fromMin, toMin }: { fromMin: number; toMin: number }) {
  const marcas: number[] = []
  for (let m = Math.ceil(fromMin / 180) * 180; m <= toMin; m += 180) {
    // Rente à margem direita, o rótulo saía da caixa.
    if (pos(m, { fromMin, toMin }) > 97) continue
    marcas.push(m)
  }
  return (
    <div className="flex items-stretch border-b border-[var(--line)]">
      <div
        className={clsx(GOTEIRA, 'shrink-0 border-r border-[var(--line-soft)]')}
      />
      <div className="relative mr-2 h-6 min-w-0 flex-1">
        {marcas.map((m) => (
          <span
            key={m}
            className="absolute top-1.5 -translate-x-1/2 text-[0.625rem] tabular-nums text-[var(--ink-faint)]"
            style={{ left: `${pos(m, { fromMin, toMin })}%` }}
          >
            {Math.floor(m / 60)}h
          </span>
        ))}
      </div>
    </div>
  )
}

function DiaSemana({
  dia,
  week,
  equipa,
  href,
  hoje,
  timezone,
}: {
  dia: WeekDay
  week: AgendaWeek
  equipa: Map<string, { name: string; color: string }>
  href: string
  hoje: boolean
  timezone: string
}) {
  // Fechado é diferente de vazio: um feriado não é um dia mau. Mas um
  // turno num dia fechado mostra-se na mesma — apagá-lo era esconder
  // exactamente o erro de escala que esta vista serve para apanhar.
  const fechado = !dia.open && dia.lanes.length === 0

  return (
    <section
      className={clsx(
        'border-b border-[var(--line)] last:border-b-0',
        hoje && 'bg-[var(--surface-2)]',
      )}
    >
      <Link
        href={href}
        className="flex items-baseline gap-2 px-2.5 pb-1 pt-1.5 transition-colors hover:bg-[var(--surface-2)] sm:px-3"
      >
        <span
          className={clsx(
            'text-[0.6875rem] font-semibold uppercase tracking-wide',
            hoje ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]',
          )}
        >
          {formatWeekdayShort(dia.day, timezone).replace(/\.$/, '')}
        </span>
        <span className="display text-[0.9375rem] tabular-nums text-[var(--ink)]">
          {Number(dia.day.slice(8))}
        </span>
        {hoje ? (
          <span className="rounded-[2px] border border-current px-1 text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--accent)]">
            hoje
          </span>
        ) : null}
        <span className="ml-auto text-[0.6875rem] tabular-nums text-[var(--ink-faint)]">
          {fechado
            ? ''
            : dia.appointments === 0
              ? 'sem marcações'
              : dia.appointments === 1
                ? '1 marcação'
                : `${dia.appointments} marcações`}
        </span>
      </Link>

      {fechado ? (
        <p className="px-2.5 pb-2 text-[0.75rem] text-[var(--ink-faint)] sm:px-3">
          Fechado
        </p>
      ) : dia.lanes.length === 0 ? (
        /* Aberta e sem ninguém: uma pista vazia que o diz por extenso. */
        <div className="flex items-stretch border-t border-[var(--line-soft)]">
          <div
            className={clsx(
              GOTEIRA,
              'shrink-0 border-r border-[var(--line-soft)]',
            )}
          />
          <p className="my-2 mr-2 flex-1 text-[0.625rem] text-[var(--ink-faint)]">
            <span className="pl-1">Ninguém escalado</span>
          </p>
        </div>
      ) : (
        <>
          {dia.lanes.map((lane) => (
            <Faixa
              key={lane.staffId}
              lane={lane}
              week={week}
              pessoa={equipa.get(lane.staffId)}
              href={href}
              hoje={hoje}
            />
          ))}
          {!dia.open ? (
            <p className="px-2.5 pb-2 pt-1 text-[0.75rem] text-[var(--warn)] sm:px-3">
              A casa está fechada neste dia — a escala acima é um engano a
              corrigir.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function Faixa({
  lane,
  week,
  pessoa,
  href,
  hoje,
}: {
  lane: WeekDay['lanes'][number]
  week: AgendaWeek
  pessoa: { name: string; color: string } | undefined
  href: string
  hoje: boolean
}) {
  const p = (min: number) => pos(min, week)

  // As linhas das horas, referência muda por trás de tudo.
  const linhas: number[] = []
  for (
    let m = Math.ceil(week.fromMin / 60) * 60;
    m < week.toMin;
    m += 60
  ) {
    linhas.push(m)
  }

  return (
    <div className="flex min-h-[1.875rem] items-stretch border-t border-[var(--line-soft)]">
      <div
        className={clsx(
          GOTEIRA,
          'flex shrink-0 items-center gap-1.5 border-r border-[var(--line-soft)] pl-2.5 pr-1.5',
        )}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: pessoa?.color }}
        />
        <span className="truncate text-[0.6875rem] text-[var(--ink-muted)]">
          {shortName(pessoa?.name ?? '')}
        </span>
      </div>

      <div className="relative my-1 mr-2 min-w-0 flex-1">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {linhas.map((m) => (
            <span
              key={m}
              className={clsx(
                'absolute -bottom-1 -top-1 w-px',
                m % 180 === 0
                  ? 'bg-[rgba(34,29,23,0.11)]'
                  : 'bg-[rgba(34,29,23,0.055)]',
              )}
              style={{ left: `${p(m)}%` }}
            />
          ))}
        </div>

        {/*
          O TURNO É UM FUNDO, NÃO UMA BARRA. Cheio de cinzento, um dia
          sem marcações lia-se como um dia ocupado — ao contrário do que
          devia dizer. Assim é um véu que diz «está cá» sem gritar
          «está cheia»; o que salta à vista é só a marcação.
        */}
        {lane.shifts.map((s) => (
          <span
            key={s.start}
            aria-hidden
            className={clsx(
              'absolute inset-y-0 rounded-[2px] shadow-[inset_0_-1px_0_var(--line-soft)]',
              hoje ? 'bg-[rgba(34,29,23,0.07)]' : 'bg-[rgba(34,29,23,0.045)]',
            )}
            style={{
              left: `${p(s.start)}%`,
              width: `${p(s.end) - p(s.start)}%`,
            }}
          />
        ))}

        {lane.blocks.map((b) => {
          const largura = p(b.endMin) - p(b.startMin)
          return (
            <Link
              key={`${b.appointmentId}-${b.startMin}`}
              href={`${href}&m=${b.appointmentId}`}
              title={`${formatMinutes(b.startMin)}–${formatMinutes(
                b.endMin,
              )} · ${b.clientName} · ${b.serviceName}`}
              className="absolute inset-y-0 flex min-w-[7px] items-center overflow-hidden rounded-[2px] px-1 shadow-[0_0_0_1px_rgba(34,29,23,0.22),0_1px_2px_rgba(34,29,23,0.14)]"
              style={{
                left: `${p(b.startMin)}%`,
                width: `${largura}%`,
                background: `color-mix(in srgb, ${pessoa?.color ?? 'var(--accent)'} 42%, #FBF8F1)`,
                borderLeft: `3px solid ${pessoa?.color ?? 'var(--accent)'}`,
              }}
            >
              {/*
                O nome só quando cabe. Abaixo disto o bloco tem uns
                vinte píxeis num telemóvel — a cor e a posição já dizem
                o que há a dizer, e o nome vem no toque.
              */}
              {largura > 7 ? (
                <span className="truncate text-[0.625rem] font-semibold leading-none text-[rgba(20,15,10,0.78)]">
                  {shortName(b.clientName)}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** "24 – 30 ago", e com os dois meses quando a semana os atravessa. */
function intervalo(from: IsoDay, to: IsoDay, timezone: string): string {
  const di = Number(from.slice(8))
  const df = Number(to.slice(8))
  const mi = formatMonthShort(from, timezone)
  const mf = formatMonthShort(to, timezone)
  return mi === mf ? `${di} – ${df} ${mi}` : `${di} ${mi} – ${df} ${mf}`
}
