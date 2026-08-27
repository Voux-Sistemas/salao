import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { availableSlots, type Slot } from '@/lib/availability'
import { formatCents } from '@/lib/money'
import {
  addDays,
  formatDayLong,
  formatDayShort,
  formatDuration,
  formatMinutes,
  formatWeekdayShort,
  isoRange,
  today,
  type IsoDay,
  isValidDay,
} from '@/lib/time'
import {
  CART_PARAM,
  DAY_PARAM,
  STAFF_PARAM,
  first,
  funnelHref,
  parseCart,
  parseStaff,
} from '@/lib/cart'
import { picksStaffOn } from '@/lib/sunday'
import { serviceNamesFor } from '@/lib/catalog-names'
import { ButtonLink, Empty, Notice } from '@/components/ui'
import { FunnelShell, VisitSummary } from '@/components/funnel-shell'
import { DayStrip } from '@/components/day-strip'
import { Reveal } from '@/components/reveal'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.tabs.times,
    // O dia escolhido está no endereço: cada visita tem o seu, e nenhum
    // deles é uma página que valha a pena guardar num índice.
    robots: { index: false, follow: false },
  }
}


/**
 * Passo 5 — escolher a hora.
 *
 * O dia e a profissional já vêm decididos de trás, e é por isso que
 * este passo é agora o último: com o serviço escolhido sabe-se quanto
 * tempo é preciso reservar, e todas as horas oferecidas aqui cabem
 * mesmo. Ao contrário — a hora antes do serviço — ofereciam-se horas
 * que a visita não chegava a caber, e a cliente descobria-o no fim.
 *
 * Os horários oferecidos são os do CONJUNTO: já contam com a duração de
 * todos os serviços, com as folgas, com o intervalo entre eles e com o
 * recurso físico que cada um consome.
 */
export default async function TimesPage({ params, searchParams }: Params) {
  const { loja } = await params
  const query = await searchParams
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])
  if (!unit) notFound()

  const here = `/agendar/${unit.slug}`
  const firstDay = today(unit.timezone)
  const lastDay = addDays(firstDay, unit.max_lead_days)
  const askedDay = first(query[DAY_PARAM])
  const staffId = parseStaff(query[STAFF_PARAM])

  // Cada passo revalida o anterior, e cada um manda de volta ao seu:
  // sem dia ao princípio, sem profissional ao passo dela, sem serviço
  // à ementa — sempre com o que já estava escolhido intacto.
  if (!askedDay || !isValidDay(askedDay) || askedDay < firstDay || askedDay > lastDay) {
    redirect(here)
  }
  const day = askedDay as IsoDay

  // Ao domingo não se escolhe profissional — e por isso a falta dela
  // não é um erro que mande a cliente para trás. Um `?p=` de uma
  // ligação antiga é ignorado: a visita fica sem dono, e o motor
  // reparte-a por quem estiver livre à hora que ela marcar.
  const picksStaff = picksStaffOn(day)
  const chosenStaff = picksStaff ? staffId : null
  if (picksStaff && !staffId) redirect(funnelHref(`${here}/profissional`, { day }))

  // A profissional é a da visita inteira: as linhas do endereço podem
  // vir de uma ligação antiga, e é o `?p=` que manda.
  const cart = parseCart(query[CART_PARAM]).map((line) => ({
    ...line,
    staffId: chosenStaff,
  }))
  if (cart.length === 0) {
    redirect(funnelHref(`${here}/servicos`, { day, staffId: chosenStaff }))
  }

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  // A semana visível responde toda de uma vez: aqui já se sabe o
  // serviço e a pessoa, por isso a pergunta de cada dia é a exacta —
  // «esta visita cabe?» — e não o pulso grosseiro dos passos de trás.
  // Um dia sem hora nenhuma fica apagado na tira antes do toque.
  const week = isoRange(day, 7).filter((d) => d <= lastDay)
  const weekSlots = await Promise.all(
    week.map((d) => availableSlots(unit, d, cart, 'online')),
  )
  const byDay = new Map(week.map((d, i) => [d, weekSlots[i]!]))
  const { slots, problem } = byDay.get(day)!
  const deadDays = new Set(
    week.filter((d) => (byDay.get(d)?.slots.length ?? 0) === 0),
  )

  // Quando o dia escolhido está vazio, a saída não é um conselho — é
  // uma porta. Procuram-se os dias mais próximos onde ESTA visita com
  // ESTA profissional ainda cabe, às semanas, e param-se três achados.
  // Se o problema é «ninguém faz este serviço», nenhum dia vai servir,
  // e procurar seria prometer o que não há.
  const nearby: { day: IsoDay; count: number }[] = []
  if (slots.length === 0 && problem !== 'no_staff') {
    for (
      let cursor = firstDay;
      cursor <= lastDay && nearby.length < 3;
      cursor = addDays(cursor, 7)
    ) {
      const batch = isoRange(cursor, 7).filter((d) => d <= lastDay)
      const found = await Promise.all(
        batch.map(async (d) => {
          if (d === day) return null
          const hit = byDay.get(d) ?? (await availableSlots(unit, d, cart, 'online'))
          return hit.slots.length > 0 ? { day: d, count: hit.slots.length } : null
        }),
      )
      for (const f of found) if (f && nearby.length < 3) nearby.push(f)
    }
  }

  const groups: { label: string; slots: Slot[] }[] = [
    {
      label: dict.funnel.morning,
      slots: slots.filter((s) => s.minutesOfDay < 12 * 60),
    },
    {
      label: dict.funnel.afternoon,
      slots: slots.filter((s) => s.minutesOfDay >= 12 * 60 && s.minutesOfDay < 18 * 60),
    },
    {
      label: dict.funnel.evening,
      slots: slots.filter((s) => s.minutesOfDay >= 18 * 60),
    },
  ].filter((group) => group.slots.length > 0)

  const sample = slots[0]?.plan

  // O resumo da visita é o único sítio desta página onde aparece o
  // nome de um serviço — e é o nome dele que a cliente está a
  // confirmar. Vai na língua dela.
  const names = await serviceNamesFor(
    cart.map((line) => line.serviceId),
    language,
  )

  return (
    <FunnelShell
      step={5}
      dict={dict}
      hrefs={[
        '/agendar',
        funnelHref(here, { day }),
        picksStaff ? funnelHref(`${here}/profissional`, { day }) : null,
        funnelHref(`${here}/servicos`, { day, staffId: chosenStaff, cart }),
        null,
        null,
      ]}
      eyebrow={unit.name}
      title={dict.funnel.timeTitle}
      subtitle={dict.funnel.timeSubtitle}
      aside={
        sample ? (
          <VisitSummary
            title={dict.funnel.yourVisit}
            lines={sample.items.map((item) => ({
              label: names.get(item.serviceId) ?? item.serviceName,
              /* Ao domingo a cliente nao escolheu ninguem — e o nome
                 de quem o motor arrumou por dentro nao e uma promessa
                 que a casa queira fazer. Fica so a duracao. */
              meta: picksStaff
                ? `${item.staffPublicName} · ${formatDuration(item.durationMinutes, language)}`
                : formatDuration(item.durationMinutes, language),
              value: formatCents(item.priceCents, org.currency, language),
            }))}
            total={{
              label: dict.common.total,
              value: formatCents(sample.totalCents, org.currency, language),
            }}
            footer={
              <div className="flex items-baseline justify-between text-[0.75rem]">
                <span className="text-[var(--ink-muted)]">{dict.common.duration}</span>
                <span className="tabular text-[var(--ink)]">
                  {formatDuration(
                    Math.round(
                      (sample.endsAt.getTime() - sample.startsAt.getTime()) / 60_000,
                    ),
                    language,
                  )}
                </span>
              </div>
            }
          />
        ) : null
      }
    >
      {/* -------------------------------------------------- os dias ---
          A tira fica, e continua a navegar: mudar de ideias sobre o dia
          quando se está a olhar para as horas é o gesto mais natural do
          funil, e mandá-la três passos atrás para isso era castigá-la
          por mudar de ideias. Quem está de serviço volta a ser
          verificado — a profissional escolhida pode folgar na quinta, e
          nesse caso o que aparece em baixo é a explicação, não uma
          grelha vazia. */}
      <DayStrip
        day={day}
        firstDay={firstDay}
        lastDay={lastDay}
        timezone={unit.timezone}
        language={language}
        dict={dict}
        /*
         * TROCAR DE DIA PODE ATRAVESSAR A FRONTEIRA DO DOMINGO.
         *
         * De um dia de semana para domingo, a profissional escolhida
         * deixa de fazer sentido e cai. De domingo para um dia de
         * semana, ela nunca chegou a ser escolhida — e as horas de
         * uma visita sem dono não se sabem pedir, por isso a troca
         * leva ao passo dela, com o carrinho intacto.
         */
        href={(value) =>
          picksStaffOn(value) && !chosenStaff
            ? funnelHref(`${here}/profissional`, { day: value })
            : funnelHref(`${here}/horarios`, {
                cart,
                day: value,
                staffId: picksStaffOn(value) ? chosenStaff : null,
              })
        }
        label={dict.funnel.steps.day}
        disabled={deadDays}
      />

      {/* A data por extenso, em serifa: é o cabeçalho do que vem abaixo. */}
      <div className="mt-8 flex items-baseline gap-4">
        <h2 className="display text-xl text-[var(--ink)] first-letter:uppercase">
          {formatDayLong(day, unit.timezone, language)}
        </h2>
        <span className="h-px flex-1 bg-[var(--line-soft)]" />
        {slots.length > 0 ? (
          <span className="tabular shrink-0 text-[0.6875rem] text-[var(--ink-faint)]">
            {slots.length} {dict.funnel.slotsAvailable}
          </span>
        ) : null}
      </div>

      {/* ------------------------------------------------- as horas --- */}
      {problem === 'too_far' ? (
        <div className="mt-8">
          <Notice tone="warn">{dict.errors.tooFar}</Notice>
        </div>
      ) : null}

      {slots.length === 0 ? (
        /*
          Três becos diferentes, três respostas. O «no_staff» levava a
          frase do dia cheio — «experimente outro dia» — e era o pior
          conselho possível: quando ninguém faz o serviço, ou a
          profissional escolhida não o faz, nenhum dia do calendário vai
          servir. Quem seguisse o conselho batia à mesma porta até
          desistir.
        */
        <Empty
          title={
            problem === 'closed'
              ? dict.unit.closedToday
              : problem === 'no_staff'
                ? dict.funnel.noStaff
                : dict.funnel.noSlots
          }
          hint={
            problem === 'no_staff'
              ? dict.funnel.noStaffHint
              : dict.funnel.noSlotsHint
          }
          // Um beco nunca acaba em conselho. Primeiro as portas que
          // levam mesmo a uma hora — os dias mais próximos onde esta
          // visita cabe, com a conta de horários à vista — e só depois
          // as saídas de recurso: trocar de pessoa ou de serviço.
          action={
            <div className="flex flex-col items-center gap-5">
              {nearby.length > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="eyebrow text-[var(--ink-faint)]">
                    {dict.funnel.nearbyDays}
                  </span>
                  <div className="flex flex-wrap justify-center gap-3">
                    {nearby.map((option) => (
                      <ButtonLink
                        key={option.day}
                        href={funnelHref(`${here}/horarios`, {
                          cart,
                          day: option.day,
                          staffId: chosenStaff,
                        })}
                      >
                        <span className="first-letter:uppercase">
                          {formatWeekdayShort(option.day, unit.timezone, language)}{' '}
                          {formatDayShort(option.day, unit.timezone, language)}
                        </span>
                        <span className="tabular opacity-70">
                          · {option.count} {dict.funnel.slotsAvailable}
                        </span>
                      </ButtonLink>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink
                  href={funnelHref(`${here}/profissional`, { day })}
                  variant="outline"
                >
                  {dict.funnel.changeStaff}
                </ButtonLink>
                <ButtonLink
                  href={funnelHref(`${here}/servicos`, { day, staffId: chosenStaff, cart })}
                  variant="outline"
                >
                  {dict.funnel.changeServices}
                </ButtonLink>
              </div>
            </div>
          }
        />
      ) : (
        <div className="mt-7 space-y-9">
          {groups.map((group, groupIndex) => (
            <Reveal key={group.label} delay={groupIndex * 70}>
              <section>
                <div className="flex items-center gap-3">
                  <h3 className="eyebrow text-[var(--ink-faint)]">{group.label}</h3>
                  <span className="h-px flex-1 bg-[var(--line-soft)]" />
                </div>
                <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {group.slots.map((slot) => (
                    <li key={slot.startsAt.toISOString()}>
                      <Link
                        href={funnelHref(`${here}/confirmar`, {
                          cart,
                          day,
                          staffId: chosenStaff,
                          time: slot.startsAt.toISOString(),
                        })}
                        className="tabular flex h-12 items-center justify-center border border-[var(--line-soft)] bg-[var(--surface-raised)] text-sm text-[var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] hover:shadow-[var(--shadow-soft)]"
                      >
                        {formatMinutes(slot.minutesOfDay)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ))}
        </div>
      )}

    </FunnelShell>
  )
}

