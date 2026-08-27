import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import clsx from 'clsx'
import { getUnitBySlug } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { pulseOfDays, staffForDay, type StaffDay } from '@/lib/availability'
import {
  addDays,
  formatDayLong,
  isoRange,
  today,
  type IsoDay,
  isValidDay,
} from '@/lib/time'
import { DAY_PARAM, first, funnelHref } from '@/lib/cart'
import { Empty } from '@/components/ui'
import { FunnelShell } from '@/components/funnel-shell'
import { DayStrip } from '@/components/day-strip'
import { Monogram } from '@/components/brand'
import { Photo } from '@/components/photo'
import { Reveal } from '@/components/reveal'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.funnel.steps.staff,
    // O dia escolhido está no endereço: cada visita tem o seu, e nenhum
    // deles é uma página que valha a pena guardar num índice.
    robots: { index: false, follow: false },
  }
}


/**
 * Passo 3 — escolher a profissional.
 *
 * É o passo que esta casa pediu, e a regra dele é uma só: NINGUÉM
 * DESAPARECE. Quem folga, quem já tem o dia cheio e quem trabalha
 * noutra loja aparecem todas, apagadas e sem ligação por baixo, com o
 * motivo escrito. Uma lista que encolhe faz a cliente pensar que se
 * enganou no dia; uma lista completa com metade apagada diz-lhe a
 * verdade — «hoje é esta gente» — e deixa-a decidir se troca de dia ou
 * de pessoa.
 *
 * O que se decide aqui é a pessoa da visita inteira. Não há «sem
 * preferência»: era isso, exactamente, que atribuía a profissional por
 * ela e que a casa não quis.
 *
 * Esta página responde a uma pergunta grosseira — «ainda tem bocado
 * livre hoje?» — porque o serviço ainda não foi escolhido. Quem
 * atravessar por aqui volta a passar pelo motor nos dois passos
 * seguintes, e é lá que a hora exacta se decide.
 */
export default async function ChooseStaffPage({ params, searchParams }: Params) {
  const { loja } = await params
  const query = await searchParams
  const unit = await getUnitBySlug(loja)
  if (!unit) notFound()

  const here = `/agendar/${unit.slug}`
  const firstDay = today(unit.timezone)
  const lastDay = addDays(firstDay, unit.max_lead_days)
  const asked = first(query[DAY_PARAM])

  // Cada passo revalida o anterior. Sem dia, volta-se atrás.
  if (!asked || !isValidDay(asked) || asked < firstDay || asked > lastDay) {
    redirect(here)
  }
  const day = asked as IsoDay

  // A semana visível na tira: os dias sem ninguém ficam apagados lá,
  // para a troca de dia nunca levar a um ecrã todo cinzento.
  const week = isoRange(day, 7).filter((d) => d <= lastDay)
  const [dict, language, team, pulse] = await Promise.all([
    getDictionary(),
    getLanguage(),
    staffForDay(unit, day, 'online'),
    pulseOfDays(unit, week, 'online'),
  ])
  const deadDays = new Set(week.filter((d) => pulse.get(d) !== 'ok'))

  const anyone = team.some((person) => person.available)

  return (
    <FunnelShell
      step={3}
      dict={dict}
      hrefs={['/agendar', funnelHref(here, { day }), null, null, null, null]}
      eyebrow={unit.name}
      title={dict.funnel.staffTitle}
      subtitle={dict.funnel.staffSubtitle}
    >
      {/* A tira fica: trocar de dia é a saída natural de um dia sem
          ninguém, e obrigar a voltar atrás para isso era um passo a
          mais no meio da decisão. */}
      <DayStrip
        day={day}
        firstDay={firstDay}
        lastDay={lastDay}
        timezone={unit.timezone}
        language={language}
        dict={dict}
        href={(value) => funnelHref(`${here}/profissional`, { day: value })}
        label={dict.funnel.steps.day}
        disabled={deadDays}
      />

      <div className="mt-8 flex items-baseline gap-4">
        <h2 className="display text-xl text-[var(--ink)] first-letter:uppercase">
          {formatDayLong(day, unit.timezone, language)}
        </h2>
        <span className="h-px flex-1 bg-[var(--line-soft)]" />
      </div>

      {team.length === 0 || !anyone ? (
        <div className="mt-8">
          <Empty
            title={dict.funnel.staffNobody}
            hint={dict.funnel.staffNobodyHint}
          />
        </div>
      ) : null}

      {team.length > 0 ? (
        <ul className="mt-7 grid gap-3 sm:grid-cols-2">
          {team.map((person, index) => (
            <Reveal key={person.id} delay={Math.min(index, 6) * 60}>
              <StaffCard
                person={person}
                dict={dict}
                href={
                  person.available
                    ? funnelHref(`${here}/servicos`, { day, staffId: person.id })
                    : null
                }
              />
            </Reveal>
          ))}
        </ul>
      ) : null}
    </FunnelShell>
  )
}

/**
 * O cartão de uma profissional. O mesmo desenho nos dois estados —
 * muda a cor e some a ligação. Quem não está disponível não vira um
 * cartão diferente: vira o mesmo cartão, apagado, com o motivo onde
 * estaria o tempo livre.
 */
function StaffCard({
  person,
  dict,
  href,
}: {
  person: StaffDay
  dict: Awaited<ReturnType<typeof getDictionary>>
  href: string | null
}) {
  const reason =
    person.reason === 'off'
      ? dict.funnel.staffOff
      : person.reason === 'closed'
        ? dict.funnel.staffClosed
        : dict.funnel.staffFull

  const inside = (
    <>
      {/* Sem retrato fica o monograma sobre a cor dela — a mesma que
          leva na agenda lá dentro. Apagada, perde a cor também: um
          cartão cinzento com um selo dourado dizia «carrega aqui». */}
      <span
        className="size-14 shrink-0 overflow-hidden"
        style={
          person.avatarUrl || !href
            ? undefined
            : { background: `color-mix(in srgb, ${person.displayColor} 40%, white)` }
        }
      >
        {person.avatarUrl ? (
          <Photo src={person.avatarUrl} alt={person.publicName} />
        ) : (
          <span
            aria-hidden
            className={clsx(
              'flex h-full w-full items-center justify-center',
              href ? 'text-[var(--ink)]' : 'bg-[var(--surface)] text-[var(--ink-faint)]',
            )}
          >
            <Monogram initials={initialsOf(person.publicName)} className="text-[1.0625rem]" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            'block truncate text-[0.9375rem] transition-colors',
            href ? 'text-[var(--ink)] group-hover:text-[var(--accent)]' : 'text-[var(--ink-faint)]',
          )}
        >
          {person.publicName}
        </span>
        {/* Quanto tempo livre lhe resta é conta do motor, não promessa
            à cliente — ela só vê a hora concreta no passo das horas.
            Quem não pode atender continua a dizer porquê. */}
        {!href ? (
          <span className="mt-1 block text-[0.75rem] text-[var(--ink-faint)] italic">
            {reason}
          </span>
        ) : null}
      </span>
    </>
  )

  const shape =
    'flex min-h-[5.5rem] items-center gap-4 border px-4 py-3.5 text-left transition-all duration-200'

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={clsx(
            shape,
            'group w-full border-[var(--line-soft)] bg-[var(--surface-raised)] hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[var(--shadow-soft)]',
          )}
        >
          {inside}
        </Link>
      ) : (
        // Sem ligação nenhuma por baixo: não há nada para carregar, e
        // um cartão que responde ao toque com silêncio é pior do que um
        // cartão que se vê logo que está fora.
        <div
          aria-disabled
          className={clsx(shape, 'w-full border-[var(--line-soft)] bg-transparent opacity-55')}
        >
          {inside}
        </div>
      )}
    </li>
  )
}

/** «Profissional 01» dá P1; «Ana Ribeiro» dá AR. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  const firstLetter = parts[0]!.charAt(0)
  const last = parts[parts.length - 1]!
  // Um número no fim («01») vale mais do que a letra: é o que distingue
  // uma «Profissional» da outra.
  const tail = /^\d+$/.test(last) ? String(Number(last)) : last.charAt(0)
  return (firstLetter + tail).toUpperCase()
}
