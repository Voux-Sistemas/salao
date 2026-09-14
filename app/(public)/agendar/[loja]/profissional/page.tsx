import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getUnitBySlug } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { pulseOfDays, staffForDay, type StaffDay } from '@/lib/availability'
import {
  addDays,
  formatDuration,
  formatList,
  formatTime,
  isoRange,
  today,
  type IsoDay,
  isValidDay,
} from '@/lib/time'
import { CART_PARAM, DAY_PARAM, first, funnelHref, parseCart } from '@/lib/cart'
import { picksStaffOn } from '@/lib/sunday'
import { Empty } from '@/components/ui'
import { BandWeek, FunnelStage } from '@/components/funnel-stage'
import { Photo } from '@/components/photo'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type Dict = Awaited<ReturnType<typeof getDictionary>>

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.funnel.steps.staff,
    // O dia escolhido está no endereço: cada visita tem o seu, e nenhum
    // deles é uma página que valha a pena guardar num índice.
    robots: { index: false, follow: false },
  }
}

/** Abaixo disto o maior bocado livre já não dá para uma visita folgada. */
const LITTLE_TIME_MINUTES = 60

/** Quantos bocados livres se escrevem antes de se passar a «+N». */
const WINDOWS_SHOWN = 3

/**
 * Passo 3 — escolher a profissional.
 *
 * É o passo que esta casa pediu, e a regra dele é uma só: NINGUÉM
 * DESAPARECE. Quem atende neste dia aparece em cartão, com as horas em
 * que ainda está livre. Quem folga ou já tem a agenda cheia fica
 * escrito por baixo, numa frase, com o motivo. Uma lista que encolhe
 * faz a cliente pensar que se enganou no dia; uma lista completa diz-lhe
 * a verdade — «hoje é esta gente» — e deixa-a decidir se troca de dia
 * ou de pessoa.
 *
 * O que se decide aqui é a pessoa da visita inteira. Não há «sem
 * preferência»: era isso, exactamente, que atribuía a profissional por
 * ela e que a casa não quis.
 *
 * AS HORAS LIVRES SÃO UM MAPA, NÃO UMA PROMESSA. O serviço ainda não foi
 * escolhido, por isso «14:00–18:30» diz onde há tempo, não que qualquer
 * serviço cabe lá. A hora exacta decide-se dois passos à frente, outra
 * vez pelo motor. Foi a casa que pediu para as ver: sem elas, a cliente
 * escolhia a profissional às cegas e só descobria no fim que ela estava
 * livre de manhã e não de tarde.
 *
 * O desenho é o do mockup «Profissional · elegante».
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

  // Um carrinho que já vinha montado — de trocar de dia na página das
  // horas, por exemplo — atravessa este passo intacto: entra no
  // endereço, sai em todas as portas.
  const cart = parseCart(query[CART_PARAM])

  // AO DOMINGO ESTE PASSO NÃO EXISTE.
  //
  // Não se mostra vazio nem com um aviso: manda-se para onde a visita
  // continua. Quem chega aqui vem de uma ligação guardada, de um
  // «voltar atrás», ou de trocar para domingo na semana da faixa — e em
  // todos esses casos o que ela quer é seguir, não ler que se enganou.
  if (!picksStaffOn(day)) redirect(funnelHref(`${here}/servicos`, { day, cart }))

  // A semana da faixa: os dias sem ninguém ficam apagados lá, para a
  // troca de dia nunca levar a um ecrã todo cinzento.
  const week = isoRange(day, 7).filter((d) => d <= lastDay)
  const [dict, language, team, pulse] = await Promise.all([
    getDictionary(),
    getLanguage(),
    staffForDay(unit, day, 'online'),
    pulseOfDays(unit, week, 'online'),
  ])
  const deadDays = new Set(week.filter((d) => d !== day && pulse.get(d) !== 'ok'))

  const working = team.filter((person) => person.available)
  const dayHref = funnelHref(here, { day })

  // Quem não atende, dito numa frase e agrupado pelo motivo. Loja
  // fechada não entra: aí ninguém atende e o ecrã vazio já o diz.
  const namesWith = (reason: StaffDay['reason']) =>
    team.filter((person) => person.reason === reason).map((person) => person.publicName)
  const off = namesWith('off')
  const full = namesWith('full')
  const groups = [
    off.length > 0
      ? `${formatList(off, language)}, ${(off.length === 1
          ? dict.funnel.staffAwayOff
          : dict.funnel.staffAwayOffMany
        ).replace('{loja}', unit.name)}`
      : null,
    full.length > 0
      ? `${formatList(full, language)}, ${
          full.length === 1 ? dict.funnel.staffAwayFull : dict.funnel.staffAwayFullMany
        }`
      : null,
  ].filter(Boolean)
  const awayLine = groups.length > 0 ? `${dict.funnel.staffAway}: ${groups.join('; ')}.` : null

  /* Os prazos são da loja e a dona muda-os no Admin; é a mesma frase do
     recibo, dita antes de marcar para ninguém ter medo de escolher. */
  const prazo =
    unit.reschedule_window_minutes === unit.cancel_window_minutes
      ? dict.funnel.changeUntil.replace(
          '{tempo}',
          formatDuration(unit.cancel_window_minutes, language),
        )
      : dict.funnel.changeUntilSplit
          .replace('{mudar}', formatDuration(unit.reschedule_window_minutes, language))
          .replace('{desmarcar}', formatDuration(unit.cancel_window_minutes, language))

  return (
    <FunnelStage
      step={3}
      dict={dict}
      hrefs={['/agendar', dayHref, null, null, null, null]}
      eyebrow={unit.name}
      title={dict.funnel.staffTitle}
      back={{ href: dayHref, label: dict.funnel.steps.day }}
      week={
        <BandWeek
          day={day}
          days={week}
          timezone={unit.timezone}
          language={language}
          href={(value) => funnelHref(`${here}/profissional`, { day: value, cart })}
          label={dict.funnel.steps.day}
          disabled={deadDays}
        />
      }
    >
      <div className="flex items-center gap-3 px-1.5 sm:gap-4 sm:px-0">
        <h2 className="text-[0.6875rem] leading-[14px] font-semibold tracking-[0.18em] whitespace-nowrap text-[var(--accent)] uppercase sm:text-[0.75rem] sm:leading-4">
          {dict.funnel.staffWorking}
        </h2>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{
            background: 'linear-gradient(90deg, rgba(198,169,107,0.5), rgba(198,169,107,0))',
          }}
        />
      </div>

      {working.length === 0 ? (
        <Empty title={dict.funnel.staffNobody} hint={dict.funnel.staffNobodyHint} />
      ) : (
        /* No telemóvel é uma lista só, com um fio entre as linhas; no
           monitor cada pessoa ganha o seu cartão, dois por fila. */
        <ul className="mt-3 overflow-hidden rounded-[22px] bg-[var(--surface-raised)] sm:mt-4 sm:grid sm:grid-cols-2 sm:gap-3.5 sm:overflow-visible sm:rounded-none sm:bg-transparent">
          {working.map((person, index) => (
            <StaffCard
              key={person.id}
              person={person}
              first={index === 0}
              dict={dict}
              timezone={unit.timezone}
              language={language}
              href={funnelHref(`${here}/servicos`, { day, staffId: person.id, cart })}
            />
          ))}
        </ul>
      )}

      {awayLine ? (
        <p className="mt-4 px-1.5 text-[0.8125rem] leading-[19px] text-[var(--ink-muted)] sm:mt-6 sm:px-0 sm:text-[0.875rem] sm:leading-5">
          {awayLine}
        </p>
      ) : null}

      <div className="mx-1.5 mt-7 flex items-center justify-between gap-6 border-t border-[var(--line-soft)] pt-4 sm:mx-0 sm:mt-12 sm:pt-[22px]">
        <Link
          href={dayHref}
          className="hidden items-center gap-1.5 text-[0.875rem] font-semibold text-[var(--action-strong)] transition-colors hover:text-[var(--ink)] sm:inline-flex"
        >
          <ChevronLeft size={15} strokeWidth={2} aria-hidden />
          {dict.funnel.changeDay}
        </Link>
        <p className="text-[0.8125rem] leading-[19px] text-[var(--ink-muted)] sm:text-right sm:text-[0.875rem] sm:leading-5">
          {prazo}
        </p>
      </div>
    </FunnelStage>
  )
}

/**
 * O cartão de quem atende: o retrato (ou as iniciais), o nome, e as
 * horas em que ainda está livre. «Pouco tempo» só aparece quando é
 * mesmo pouco; nos outros casos o cartão não comenta.
 */
function StaffCard({
  person,
  first,
  dict,
  timezone,
  language,
  href,
}: {
  person: StaffDay
  first: boolean
  dict: Dict
  timezone: string
  language: string
  href: string
}) {
  const windows = person.freeWindows
    .slice(0, WINDOWS_SHOWN)
    .map((w) => `${formatTime(w.start, timezone, language)}–${formatTime(w.end, timezone, language)}`)
  const more = person.freeWindows.length - windows.length
  const little = person.longestFreeMinutes < LITTLE_TIME_MINUTES

  return (
    <li>
      {first ? null : <span aria-hidden className="ml-[68px] block h-px bg-[var(--line-soft)] sm:hidden" />}
      <Link
        href={href}
        className="group flex items-center gap-3 py-3.5 pr-4 pl-3.5 transition-[background-color,box-shadow] duration-200 outline-offset-2 hover:bg-[#FFFDF8] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:gap-4 sm:rounded-[22px] sm:bg-[var(--surface-raised)] sm:py-[22px] sm:pr-[26px] sm:pl-[22px] sm:hover:shadow-[0_0_0_1px_rgba(142,111,65,0.28),0_10px_28px_-18px_rgba(34,29,23,0.3)]"
      >
        <span className="relative size-[42px] shrink-0 overflow-hidden rounded-full bg-[#F3EBDA] sm:size-[52px]">
          {person.avatarUrl ? (
            <Photo src={person.avatarUrl} alt="" />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center text-[0.8125rem] font-semibold tracking-[0.02em] text-[var(--action-strong)] sm:text-[0.875rem]"
            >
              {initialsOf(person.publicName)}
            </span>
          )}
          {/* O fio dourado vai por cima do retrato, e escurece no hover. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(198,169,107,0.5)] transition-shadow group-hover:shadow-[inset_0_0_0_1.5px_var(--accent)]"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] leading-5 font-semibold tracking-[-0.012em] text-[var(--ink)] sm:text-[1.0625rem] sm:leading-6">
            {person.publicName}
          </span>
          <span className="mt-0.5 block text-[0.8125rem] leading-[18px] text-[var(--ink-muted)] sm:mt-[3px] sm:text-[0.875rem] sm:leading-5">
            {windows.join(' · ')}
            {more > 0 ? ` · +${more}` : null}
            {little ? (
              <span className="font-medium text-[var(--warn)]">
                {' · '}
                {dict.funnel.staffLittleTime}
              </span>
            ) : null}
          </span>
        </span>

        <ChevronRight
          size={16}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 text-[var(--ink-faint)] transition-colors group-hover:text-[var(--action-strong)]"
        />
      </Link>
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
