import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getUnitBySlug } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { pulseOfDays, staffForDay, type StaffDay } from '@/lib/availability'
import { addDays, isoRange, today, type IsoDay, isValidDay } from '@/lib/time'
import { CART_PARAM, DAY_PARAM, first, funnelHref, parseCart } from '@/lib/cart'
import { picksStaffOn } from '@/lib/sunday'
import { Empty } from '@/components/ui'
import { BandWeek, FunnelStage } from '@/components/funnel-stage'
import { Photo } from '@/components/photo'

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
 * UMA PERGUNTA E OS NOMES. A casa viu a versão com as horas livres de
 * cada uma, a frase de quem não atende e o prazo para desmarcar, e
 * achou tudo a mais: as horas estão no passo das horas, e aqui a
 * cliente só quer saber com quem pode marcar. Ficam os cartões de quem
 * atende neste dia, e mais nada.
 *
 * O que se decide aqui é a pessoa da visita inteira. Não há «sem
 * preferência»: era isso, exactamente, que atribuía a profissional por
 * ela e que a casa não quis.
 *
 * O desenho é o do mockup «Profissional · mais simples».
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
  const weekHref = (value: IsoDay) => funnelHref(`${here}/profissional`, { day: value, cart })

  // As setas andam uma semana. A de trás pára no primeiro dia marcável
  // em vez de sumir, para quem está a meio da semana poder voltar a hoje.
  const previousDay = day > firstDay ? maxDay(addDays(day, -7), firstDay) : null
  const nextDay = addDays(day, 7) <= lastDay ? addDays(day, 7) : null

  return (
    <FunnelStage
      step={3}
      dict={dict}
      hrefs={['/agendar', dayHref, null, null, null, null]}
      eyebrow={unit.name}
      title={dict.funnel.staffTitle}
      back={{ href: dayHref, label: dict.common.back }}
      week={
        <BandWeek
          day={day}
          days={week}
          timezone={unit.timezone}
          language={language}
          href={weekHref}
          previous={previousDay ? weekHref(previousDay) : null}
          next={nextDay ? weekHref(nextDay) : null}
          dict={dict}
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
           monitor cada pessoa ganha o seu cartão, três por fila. */
        <ul className="mt-3 overflow-hidden rounded-[22px] bg-[var(--surface-raised)] sm:mt-4 sm:grid sm:grid-cols-2 sm:gap-3.5 sm:overflow-visible sm:rounded-none sm:bg-transparent lg:grid-cols-3">
          {working.map((person, index) => (
            <StaffCard
              key={person.id}
              person={person}
              first={index === 0}
              href={funnelHref(`${here}/servicos`, { day, staffId: person.id, cart })}
            />
          ))}
        </ul>
      )}
    </FunnelStage>
  )
}

/** O cartão de quem atende: o retrato (ou as iniciais) e o nome. */
function StaffCard({
  person,
  first,
  href,
}: {
  person: StaffDay
  first: boolean
  href: string
}) {
  return (
    <li>
      {first ? null : (
        <span aria-hidden className="ml-[72px] block h-px bg-[var(--line-soft)] sm:hidden" />
      )}
      <Link
        href={href}
        className="group flex items-center gap-3.5 py-3.5 pr-[18px] pl-3.5 transition-[background-color,box-shadow] duration-200 outline-offset-2 hover:bg-[#FFFDF8] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:gap-4 sm:rounded-[22px] sm:bg-[var(--surface-raised)] sm:py-5 sm:pr-6 sm:pl-5 sm:hover:shadow-[0_0_0_1px_rgba(142,111,65,0.28),0_10px_28px_-18px_rgba(34,29,23,0.3)]"
      >
        <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-[#F3EBDA] sm:size-[52px]">
          {person.avatarUrl ? (
            <Photo src={person.avatarUrl} alt="" />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center text-[0.875rem] font-semibold tracking-[0.02em] text-[var(--action-strong)]"
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

        <span className="min-w-0 flex-1 truncate text-[1rem] leading-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)] sm:text-[1.0625rem] sm:leading-6 sm:tracking-[-0.012em]">
          {person.publicName}
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

const maxDay = (a: IsoDay, b: IsoDay): IsoDay => (a > b ? a : b)
