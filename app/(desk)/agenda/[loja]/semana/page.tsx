import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { requireActor, resolveUnit } from '@/lib/auth/actor'
import { loadAgendaWeek, mondayOf, type WeekDay } from '@/lib/agenda-week'
import { shortName } from '@/lib/text'
import {
  addDays,
  formatDuration,
  formatMonthShort,
  formatWeekdayShort,
  today,
  type IsoDay,
} from '@/lib/time'
import { Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Semana' }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * O PANORAMA DA SEMANA.
 *
 * A agenda do dia responde a «o que acontece hoje». Esta responde à
 * pergunta que se faz de manhã, com o café na mão: como está a semana.
 *
 * NÃO É UMA GRELHA DE SETE DIAS. Cinco profissionais vezes sete dias
 * são trinta e cinco colunas — dez píxeis cada num telemóvel, que não é
 * uma agenda, é um código de barras. A semana não é uma pergunta sobre
 * horas, é uma pergunta sobre dias: sete linhas, uma por dia, cada uma
 * a dizer o quanto está cheia e quem lá anda. E cada linha é uma porta
 * para o dia, que é onde as horas estão.
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
  const day: IsoDay = d && DAY_RE.test(d) ? d : todayDay

  // A profissional vê a semana dela, tal como vê o dia dela.
  const onlyStaffId = actor.role === 'professional' ? actor.id : null

  const week = await loadAgendaWeek(unit, day, { onlyStaffId })
  const nomes = new Map(week.staff.map((s) => [s.staffId, s.name]))

  const here = `/agenda/${unit.slug}/semana`
  const semana = (target: IsoDay) => `${here}?d=${target}`
  const diaHref = (target: IsoDay) => `/agenda/${unit.slug}?d=${target}`

  const estaSemana = mondayOf(todayDay) === week.from
  const ocupacao = week.totals.capacityMin
    ? Math.round((100 * week.totals.bookedMin) / week.totals.capacityMin)
    : null

  /*
    A MEDIDA DE «CHEIO» É A MESMA PARA TODA A SEMANA.

    Se cada barra se medisse por si, um sábado com uma profissional e
    quatro horas marcadas ficava tão comprido como uma sexta com cinco
    profissionais e trinta — e o panorama passava a mentir exactamente
    onde devia ajudar. A régua é o dia de maior capacidade da semana,
    para as barras se poderem comparar de relance.
  */
  const regua = Math.max(...week.days.map((x) => x.capacityMin), 1)

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-5 sm:px-6 lg:py-8">
      {/* A volta é para o dia que se estava a ver, não para hoje. */}
      <Link
        href={diaHref(day)}
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)] lg:mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à agenda
      </Link>

      <header className="mb-5 lg:mb-7">
        <p className="titulo-seccao mb-1 lg:mb-2">{unit.name} · Panorama</p>
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
          {ocupacao !== null ? ` · ${ocupacao}% do tempo de equipa` : ''}
          {week.staff.length > 0 && !onlyStaffId
            ? ` · ${
                week.staff.length === 1
                  ? '1 profissional'
                  : `${week.staff.length} profissionais`
              }`
            : ''}
        </p>
      </header>

      {week.totals.capacityMin === 0 && week.totals.appointments === 0 ? (
        <Empty
          title="Semana sem escala"
          hint="Ninguém tem turno nesta semana. As escalas fazem-se na ficha de cada profissional."
        />
      ) : (
        <ol className="overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)]">
          {week.days.map((dia) => (
            <DiaLinha
              key={dia.day}
              dia={dia}
              regua={regua}
              nomes={nomes}
              href={diaHref(dia.day)}
              hoje={dia.day === todayDay}
              timezone={unit.timezone}
              soEu={onlyStaffId !== null}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function DiaLinha({
  dia,
  regua,
  nomes,
  href,
  hoje,
  timezone,
  soEu,
}: {
  dia: WeekDay
  regua: number
  nomes: Map<string, string>
  href: string
  hoje: boolean
  timezone: string
  soEu: boolean
}) {
  /*
    A barra tem duas larguras: a da CAPACIDADE, medida pela régua da
    semana, e a do MARCADO, dentro dela. É por isso que um sábado com
    uma pessoa se lê logo como um dia pequeno mesmo quando está cheio —
    a barra curta diz «pouca casa», o preenchimento diz «cheia». Uma
    barra só, de percentagem, dizia as duas coisas ao mesmo tempo e
    baralhava-as.
  */
  const taxa = dia.capacityMin
    ? Math.round((100 * dia.bookedMin) / dia.capacityMin)
    : 0
  const largura = Math.round((100 * dia.capacityMin) / regua)

  // Fechado é diferente de vazio: um feriado não é um dia mau.
  const fechado = !dia.open && dia.capacityMin === 0

  return (
    <li className="border-b border-[var(--line-soft)] last:border-b-0">
      <Link
        href={href}
        className={clsx(
          'flex items-center gap-3 py-2.5 pr-4 transition-colors hover:bg-[var(--surface-2)] sm:gap-4 sm:py-3',
          // O rail de hoje sem empurrar nada: a borda transparente dos
          // outros dias guarda-lhe o lugar.
          hoje
            ? 'border-l-4 border-[var(--accent)] bg-[var(--surface-2)] pl-3'
            : 'border-l-4 border-transparent pl-3',
        )}
        aria-current={hoje ? 'date' : undefined}
      >
        <div className="w-11 shrink-0 leading-tight sm:w-12">
          <p
            className={clsx(
              'text-[0.6875rem] uppercase tracking-wide',
              hoje ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]',
            )}
          >
            {formatWeekdayShort(dia.day, timezone).replace(/\.$/, '')}
          </p>
          <p className="display text-[0.9375rem] tabular-nums text-[var(--ink)]">
            {Number(dia.day.slice(8))}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          {fechado ? (
            <p className="text-[0.8125rem] text-[var(--ink-faint)]">Fechado</p>
          ) : (
            <>
              {/*
                A BARRA TEM TECTO. Num monitor largo, esticada de lado a
                lado, o olho perde o caminho entre o comprimento dela e
                o número que lhe pertence, do outro lado do ecrã — e o
                panorama, que serve para comparar dias de relance,
                passava a obrigar a varrer a linha toda. Presa a 26rem,
                os sete dias ficam num golpe de vista.
              */}
              <div className="max-w-[26rem]">
                <div
                  className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
                  style={{ width: `${Math.max(largura, 6)}%` }}
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${taxa}%` }}
                  />
                </div>
              </div>
              {/*
                Quem lá anda, enquanto couber na linha. É a segunda
                pergunta da semana — «quem trabalha na quinta?» — e
                responde-se sem sair daqui. Para a profissional, que só
                se vê a ela, o nome dela não diria nada: diz-se as horas
                que tem de turno.
              */}
              <p className="mt-1 truncate text-[0.6875rem] text-[var(--ink-faint)]">
                {dia.staffIds.length === 0
                  ? 'Sem escala'
                  : soEu
                    ? formatDuration(dia.capacityMin)
                    : dia.staffIds
                        .map((id) => shortName(nomes.get(id) ?? ''))
                        .filter(Boolean)
                        .join(' · ')}
              </p>
            </>
          )}
        </div>

        {/*
          Num dia fechado a coluna fica VAZIA, e não a zeros. «0 · 0%»
          ao lado de «Fechado» lê-se como um dia mau — e um domingo de
          porta fechada não é um dia mau, é um dia que não houve.
        */}
        <div className="w-14 shrink-0 text-right leading-tight sm:w-16">
          <p className="text-[0.9375rem] tabular-nums text-[var(--ink)]">
            {fechado ? '' : dia.appointments}
          </p>
          <p className="text-[0.6875rem] tabular-nums text-[var(--ink-faint)]">
            {fechado ? '' : `${taxa}%`}
          </p>
        </div>
      </Link>
    </li>
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
