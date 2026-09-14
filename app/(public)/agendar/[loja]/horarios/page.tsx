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
import { BandWeek, FunnelStage } from '@/components/funnel-stage'
import { initialsOf } from '@/lib/initials'

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
  const rawCart = parseCart(query[CART_PARAM])
  if (picksStaff && !staffId) {
    // Com o carrinho: quem cá chega sem dona vem quase sempre de trocar
    // de domingo para um dia de semana, e a visita montada vai com ela.
    redirect(funnelHref(`${here}/profissional`, { day, cart: rawCart }))
  }

  // A profissional é a da visita inteira: as linhas do endereço podem
  // vir de uma ligação antiga, e é o `?p=` que manda.
  const cart = rawCart.map((line) => ({
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

  // «none» é um carrinho que já não se pede assim: um serviço
  // desactivado, fechado ao online, ou de uma categoria que neste dia
  // é «sob consulta». Nenhum dia do calendário vai servir — dizer «dia
  // cheio» e varrer o horizonte à procura era prometer o que não há.
  // Volta-se à ementa desse dia, sem o carrinho estragado.
  if (problem === 'none') {
    redirect(funnelHref(`${here}/servicos`, { day, staffId: chosenStaff }))
  }
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

  /*
    PARA ONDE LEVA CADA DIA DA SEMANA DA FAIXA.

    Mudar de ideias sobre o dia quando se está a olhar para as horas é o
    gesto mais natural do funil, e mandá-la três passos atrás para isso
    era castigá-la. Quem está de serviço volta a ser verificado: a
    profissional escolhida pode folgar na quinta, e nesse caso o que
    aparece em baixo é a explicação, não uma grelha vazia. Um dia de
    semana a partir de um domingo (sem ninguém escolhido) passa pela
    profissional; um domingo larga a profissional, porque nesse dia não
    se escolhe.
  */
  const dayHref = (value: IsoDay) =>
    picksStaffOn(value) && !chosenStaff
      ? funnelHref(`${here}/profissional`, { day: value, cart })
      : funnelHref(`${here}/horarios`, {
          cart,
          day: value,
          staffId: picksStaffOn(value) ? chosenStaff : null,
        })
  const previousDay = day > firstDay ? maxDay(addDays(day, -7), firstDay) : null
  const nextDay = addDays(day, 7) <= lastDay ? addDays(day, 7) : null

  const servicesHref = funnelHref(`${here}/servicos`, { day, staffId: chosenStaff, cart })

  /* A visita, dita em pequeno. O nome de quem o motor arrumou por dentro
     ao domingo não é uma promessa que a casa queira fazer: aí fica só a
     duração e o preço. */
  const staffName = picksStaff ? (sample?.items[0]?.staffPublicName ?? null) : null
  const serviceLabel = sample
    ? sample.items.map((item) => names.get(item.serviceId) ?? item.serviceName).join(' + ')
    : null
  const visitMinutes = sample
    ? Math.round((sample.endsAt.getTime() - sample.startsAt.getTime()) / 60_000)
    : 0
  const visitMeta = sample
    ? [
        staffName,
        formatDuration(visitMinutes, language),
        formatCents(sample.totalCents, org.currency, language),
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  const monogram = staffName ? (
    <span className="relative flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F3EBDA] sm:size-[38px]">
      <span
        aria-hidden
        className="display text-[0.8125rem] leading-none text-[var(--action-strong)]"
      >
        {initialsOf(staffName)}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(198,169,107,0.45)]"
      />
    </span>
  ) : null

  return (
    <FunnelStage
      step={5}
      picksStaff={picksStaff}
      dict={dict}
      hrefs={[
        '/agendar',
        funnelHref(here, { day }),
        // Ao domingo o passo da profissional não existe: a migalha dele
        // não pode apontar para uma página que reencaminha para aqui.
        picksStaff ? funnelHref(`${here}/profissional`, { day }) : null,
        servicesHref,
        null,
        null,
      ]}
      eyebrow={unit.name}
      title={dict.funnel.timeTitle}
      back={{ href: servicesHref, label: dict.common.back }}
      week={
        <BandWeek
          day={day}
          days={week}
          timezone={unit.timezone}
          language={language}
          href={dayHref}
          previous={previousDay ? dayHref(previousDay) : null}
          next={nextDay ? dayHref(nextDay) : null}
          dict={dict}
          disabled={deadDays}
        />
      }
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
        <div>
          {/* A visita, num cartão pequeno — só no telemóvel. No monitor
              ela vive na coluna do lado. */}
          {sample ? (
            <div className="mb-[18px] flex items-center gap-[11px] rounded-2xl bg-[var(--surface-raised)] py-2 pr-3.5 pl-2 shadow-[0_1px_2px_rgba(34,29,23,0.03)] lg:hidden">
              {monogram}
              <div className={staffName ? 'min-w-0 flex-1' : 'min-w-0 flex-1 pl-2'}>
                <p className="truncate text-[0.875rem] leading-[19px] font-medium text-[var(--ink)]">
                  {serviceLabel}
                </p>
                <p className="tabular truncate text-[0.75rem] leading-4 text-[#8A7F6E]">
                  {visitMeta}
                </p>
              </div>
              <Link
                href={servicesHref}
                className="-my-2 shrink-0 py-2 text-[0.78125rem] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--action-strong)]"
              >
                {dict.common.change}
              </Link>
            </div>
          ) : null}

          {/* A data por extenso, em serifa, e quantas horas há. */}
          <div className="flex items-baseline justify-between gap-4 px-1 lg:px-0">
            <h2 className="display text-[1.0625rem] leading-[1.25] text-[var(--ink)] first-letter:uppercase lg:text-[1.375rem] lg:leading-[1.2]">
              {formatDayLong(day, unit.timezone, language)}
            </h2>
            {slots.length > 0 ? (
              <span className="tabular shrink-0 text-[0.71875rem] text-[#8A7F6E] lg:text-[0.78125rem]">
                {slots.length} {dict.funnel.slotsAvailable}
              </span>
            ) : null}
          </div>

          {problem === 'too_far' ? (
            <div className="mt-5">
              <Notice tone="warn">{dict.errors.tooFar}</Notice>
            </div>
          ) : null}

          {slots.length === 0 ? (
            /*
              Três becos diferentes, três respostas. O «no_staff» levava a
              frase do dia cheio — «experimente outro dia» — e era o pior
              conselho possível: quando ninguém faz o serviço, ou a
              profissional escolhida não o faz, nenhum dia do calendário
              vai servir.
            */
            <Empty
              title={
                problem === 'closed'
                  ? dict.unit.closedToday
                  : problem === 'no_staff'
                    ? picksStaff
                      ? dict.funnel.noStaff
                      : dict.funnel.sundayNoStaffTitle
                    : dict.funnel.noSlots
              }
              hint={
                problem === 'no_staff'
                  ? picksStaff
                    ? dict.funnel.noStaffHint
                    : dict.funnel.sundayNoStaffHint
                  : picksStaff
                    ? dict.funnel.noSlotsHint
                    : dict.funnel.sundayNoSlotsHint
              }
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
                    {/* Ao domingo não há para onde trocar de pessoa. O
                        carrinho vai junto — sem ele, quem trocasse de
                        pessoa perdia a visita montada. */}
                    {picksStaff ? (
                      <ButtonLink
                        href={funnelHref(`${here}/profissional`, { day, cart })}
                        variant="outline"
                      >
                        {dict.funnel.changeStaff}
                      </ButtonLink>
                    ) : null}
                    <ButtonLink href={servicesHref} variant="outline">
                      {dict.funnel.changeServices}
                    </ButtonLink>
                  </div>
                </div>
              }
            />
          ) : (
            /*
              AS HORAS EM PÍLULAS PEQUENAS.

              Eram caixas de quarenta e oito píxeis, três por fila: vinte e
              cinco horas enchiam três ecrãs de telemóvel. Em pílulas de
              trinta e oito, quatro por fila, a manhã e a tarde cabem quase
              no primeiro. Tocar numa leva direto à confirmação.
            */
            <div className="mt-3.5 space-y-[18px] lg:mt-5 lg:space-y-[22px]">
              {groups.map((group) => (
                <section key={group.label}>
                  <div className="flex items-center gap-2.5 px-1 lg:gap-3.5 lg:px-0">
                    <h3 className="text-[0.625rem] leading-[14px] font-medium tracking-[0.18em] text-[var(--accent)] uppercase lg:text-[0.6875rem]">
                      {group.label}
                    </h3>
                    <span className="tabular text-[0.65625rem] text-[var(--ink-faint)] lg:text-[0.71875rem]">
                      {group.slots.length}
                    </span>
                    <span
                      aria-hidden
                      className="h-px flex-1"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(198,169,107,0.4), rgba(198,169,107,0))',
                      }}
                    />
                  </div>
                  <ul className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:mt-2.5 lg:gap-2">
                    {group.slots.map((slot) => (
                      <li key={slot.startsAt.toISOString()}>
                        <Link
                          href={funnelHref(`${here}/confirmar`, {
                            cart,
                            day,
                            staffId: chosenStaff,
                            time: slot.startsAt.toISOString(),
                          })}
                          className="tabular flex h-[38px] items-center justify-center rounded-full bg-[var(--surface-raised)] text-[0.875rem] font-medium text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(34,29,23,0.06)] transition-all duration-200 outline-offset-2 hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] hover:shadow-[0_8px_18px_-12px_rgba(111,85,47,0.8)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] lg:h-10 lg:text-[0.90625rem]"
                        >
                          {formatMinutes(slot.minutesOfDay)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* -------------------------------------------------- visita --- */}
        {sample ? (
          <aside className="hidden rounded-[20px] bg-[var(--surface-raised)] p-[22px] shadow-[0_1px_2px_rgba(34,29,23,0.03),0_14px_32px_-24px_rgba(34,29,23,0.28)] lg:sticky lg:top-24 lg:block">
            <div className="flex items-center justify-between">
              <p className="text-[0.6875rem] leading-[14px] font-medium tracking-[0.18em] text-[var(--accent)] uppercase">
                {dict.funnel.yourVisit}
              </p>
              <Link
                href={servicesHref}
                className="text-[0.78125rem] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--action-strong)]"
              >
                {dict.common.change}
              </Link>
            </div>

            {staffName ? (
              <div className="mt-3.5 flex items-center gap-[11px]">
                {monogram}
                <div className="min-w-0">
                  <p className="truncate text-[0.875rem] leading-[19px] font-medium text-[var(--ink)]">
                    {staffName}
                  </p>
                  <p className="truncate text-[0.75rem] leading-4 text-[#8A7F6E] first-letter:uppercase">
                    {formatDayLong(day, unit.timezone, language)}
                  </p>
                </div>
              </div>
            ) : null}

            <ul className="mt-3.5 space-y-2.5 border-t border-[rgba(34,29,23,0.07)] pt-3">
              {sample.items.map((item, index) => (
                <li key={`${item.serviceId}-${index}`} className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.875rem] leading-5 text-[var(--ink)]">
                      {names.get(item.serviceId) ?? item.serviceName}
                    </p>
                    <p className="tabular text-[0.75rem] leading-[17px] text-[#8A7F6E]">
                      {formatDuration(item.durationMinutes, language)}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-[0.875rem] text-[var(--ink)]">
                    {formatCents(item.priceCents, org.currency, language)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3.5 border-t border-[rgba(34,29,23,0.07)] pt-2.5">
              <div className="flex items-baseline justify-between text-[0.8125rem] leading-5">
                <span className="text-[var(--ink-muted)]">{dict.common.duration}</span>
                <span className="tabular text-[var(--ink)]">
                  {formatDuration(visitMinutes, language)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-[0.8125rem] text-[var(--ink-muted)]">{dict.common.total}</span>
                <span className="tabular text-[1.1875rem] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                  {formatCents(sample.totalCents, org.currency, language)}
                </span>
              </div>
            </div>

            <p className="mt-4 text-center text-[0.75rem] leading-[17px] text-[#8A7F6E] italic">
              {dict.funnel.pickTimeHint}
            </p>
          </aside>
        ) : null}
      </div>
    </FunnelStage>
  )
}

const maxDay = (a: IsoDay, b: IsoDay): IsoDay => (a > b ? a : b)
