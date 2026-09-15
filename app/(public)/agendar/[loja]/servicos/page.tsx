import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import clsx from 'clsx'
import { Check, ChevronRight, MessageCircle, Plus, X } from 'lucide-react'
import { sql } from '@/lib/db'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { fill, getDictionary, getLanguage } from '@/lib/i18n'
import { staffForDay } from '@/lib/availability'
import { formatCents } from '@/lib/money'
import {
  addDays,
  formatDayLong,
  formatDuration,
  isValidDay,
  today,
  type IsoDay,
} from '@/lib/time'
import {
  CART_PARAM,
  DAY_PARAM,
  STAFF_PARAM,
  addLine,
  funnelHref,
  first,
  parseCart,
  parseStaff,
  removeAt,
  MAX_CART_LINES,
} from '@/lib/cart'
import { categoryOpenOn, picksStaffOn } from '@/lib/sunday'
import { waLink } from '@/lib/whatsapp'
import { Empty, Notice } from '@/components/ui'
import { FunnelStage } from '@/components/funnel-stage'
import { ServiceGroup } from '@/components/service-group'
import { Photo } from '@/components/photo'
import { FAMILY_PHOTOS } from '@/components/family-discs'
import { initialsOf } from '@/lib/initials'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ServiceRow = {
  category_id: string
  category_slug: string
  category_name: string
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  image_url: string | null
  image_alt: string | null
}


export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.funnel.steps.service,
    // O dia e a profissional já vão no endereço: cada visita tem o seu,
    // e nenhum deles é uma página que valha a pena guardar num índice.
    // O endereço que se partilha é o do passo do dia, esse sim indexado.
    robots: { index: false, follow: false },
  }
}

/**
 * Passo 4 — escolher o serviço (ou vários).
 *
 * A ementa aqui já não é a da casa: é a DELA. Com a profissional
 * escolhida no passo anterior, o que aparece são só os serviços que ela
 * sabe fazer nesta loja — não faria sentido oferecer uma coloração à
 * cliente que escolheu a manicure e depois dizer-lhe, dois ecrãs à
 * frente, que ninguém a pode atender.
 *
 * Tudo o que se escolhe entra no endereço: nada disto precisa de sessão
 * nem de JavaScript.
 */
export default async function ChooseServicesPage({ params, searchParams }: Params) {
  const { loja } = await params
  const query = await searchParams
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])
  if (!unit) notFound()

  const here = `/agendar/${unit.slug}`
  const firstDay = today(unit.timezone)
  const lastDay = addDays(firstDay, unit.max_lead_days)
  const askedDay = first(query[DAY_PARAM])
  const staffId = parseStaff(query[STAFF_PARAM])

  // Cada passo revalida o anterior. Sem dia, volta-se ao princípio;
  // sem profissional, ao passo dela — com o dia intacto.
  if (!askedDay || !isValidDay(askedDay) || askedDay < firstDay || askedDay > lastDay) {
    redirect(here)
  }
  const day = askedDay as IsoDay

  // Ao domingo não há profissional para revalidar: o passo dela não
  // existe, e um `?p=` que venha de uma ligação antiga é ignorado —
  // não redireccionado, porque não há para onde. Nos outros dias a
  // regra de sempre: sem ela, volta-se ao passo dela.
  const picksStaff = picksStaffOn(day)
  const chosenStaff = picksStaff ? staffId : null
  if (picksStaff && !staffId) redirect(funnelHref(`${here}/profissional`, { day }))

  // A língua antes da consulta: quem escolhe o serviço lê o nome
  // dele na sua língua, não só a moldura à volta.
  const language = await getLanguage()

  const [dict, services, team] = await Promise.all([
    getDictionary(),
    /*
     * A EMENTA.
     *
     * Nos dias de semana é a DELA: só o que a profissional escolhida
     * sabe fazer, porque oferecer o resto era prometer o que esta
     * visita não pode cumprir.
     *
     * Ao domingo não há «ela», e a pergunta volta a ser a da casa —
     * «alguém aqui faz isto?». O preço também: sem profissional, a
     * precedência resolve-se sem ela, e o que sai é o preço da loja.
     *
     * Nos dois casos vem TUDO o que a casa faz, incluindo o que ao
     * domingo é sob consulta. Separa-se cá em baixo, não aqui: quem é
     * sob consulta continua a precisar de nome, preço e duração para
     * se poder mostrar e para a mensagem do WhatsApp o saber nomear.
     */
    sql<ServiceRow[]>`
      select c.id as category_id,
             c.slug as category_slug,
             name_in(${language}, c.name, c.name_en, c.name_es) as category_name,
             s.id,
             name_in(${language}, s.name, s.name_en, s.name_es) as name,
             name_in(${language}, s.description,
                     s.description_en, s.description_es) as description,
             e.duration_minutes, e.price_cents,
             s.buffer_before_minutes, s.buffer_after_minutes,
             s.image_url, s.image_alt
        from service s
        join service_category c on c.id = s.category_id and c.is_active
        -- Preço e duração: a precedência é profissional+loja →
        -- profissional → loja → base, e é a base de dados que a
        -- resolve. Sem profissional (domingo) começa na loja.
        cross join lateral effective_service_pricing(
          s.id, ${unit.id}::uuid, ${chosenStaff}::uuid
        ) e
       where s.org_id = ${org.id} and s.is_active and s.bookable_online
         /*
          * E ALGUÉM TEM DE O SABER FAZER.
          *
          * Com profissional escolhida a pergunta é sobre ela; sem ela,
          * é sobre a loja inteira. Nos dois casos um serviço que
          * ninguém ali faz não é uma promessa cumprível, e sai da
          * ementa — a ficha dele fica lá dentro, com o seu aviso.
          */
         and exists (
           select 1
             from staff_skill ss
             join staff st on st.id = ss.staff_id and st.is_active
             join staff_unit su
               on su.staff_id = st.id and su.unit_id = ${unit.id}
            where ss.service_id = s.id
              and st.accepts_online_booking
              and (${chosenStaff}::uuid is null or ss.staff_id = ${chosenStaff}::uuid)
         )
       -- Pelo nome português, para a ordem ser a mesma nas três línguas.
       order by c.sort_order, c.name, s.sort_order, s.name
    `,
    // A mesma resposta do passo anterior, fresca: quem e quanto tempo
    // livre seguido lhe resta. E dela que sai o "ainda cabe?" de cada
    // servico la em baixo.
    staffForDay(unit, day, 'online'),
  ])

  // A profissional do endereço pode já não servir — saiu da equipa,
  // fechou-se ao online, mudou de loja, ou alguém lhe levou entretanto
  // o último bocado do dia. Volta-se ao passo dela em vez de montar uma
  // visita à volta de alguém que não pode atender.
  const person = chosenStaff ? team.find((p) => p.id === chosenStaff) : null
  if (chosenStaff && (!person || !person.available)) {
    redirect(funnelHref(`${here}/profissional`, { day }))
  }

  /*
   * O QUE SE MARCA E O QUE É SOB CONSULTA.
   *
   * Ao domingo a casa só faz cabelo. O resto não se apaga da ementa:
   * fica à vista, com o preço e a duração, e por baixo uma conversa de
   * WhatsApp já escrita. É a regra desta casa desde o princípio — quem
   * não pode ser servido vê porquê, e vê a saída.
   */
  const bookable = services.filter((s) => categoryOpenOn(day, s.category_slug))
  const onRequest = picksStaff
    ? []
    : services.filter((s) => !categoryOpenOn(day, s.category_slug))

  const byId = new Map(bookable.map((s) => [s.id, s]))

  // Um serviço que saiu da ementa entretanto — desactivado, fechado ao
  // online, ou que ela não faz — é apanhado já, e não três ecrãs à
  // frente com uma frase que não explica nada. A lista só tem os que
  // ela pode fazer, portanto o carrinho limpa-se sozinho e a cliente é
  // avisada em cima.
  //
  // Toda a linha vai com ela: a visita é de uma pessoa só, escolhida
  // no passo anterior. É este `staffId` que o motor já sabia respeitar
  // quando vinha de uma etiqueta lá em baixo — só mudou quem o põe.
  //
  // Ao domingo vai a nulo, que é como o motor diz «escolhe tu»: ele já
  // sabe fazê-lo — é o que faz ao balcão — e passa a distribuir por
  // quem estiver livre à hora marcada, sem a cliente ver nome nenhum.
  const asked = parseCart(query[CART_PARAM])
  const clean = asked
    .filter((line) => byId.has(line.serviceId))
    .map((line) => ({ ...line, staffId: chosenStaff }))
  const dropped = asked.length !== clean.length

  // Os preços já vieram da consulta acima, com ela lá dentro: não é
  // preciso perguntar duas vezes o que a mesma função já respondeu.
  const totalCents = clean.reduce(
    (sum, line) => sum + (byId.get(line.serviceId)?.price_cents ?? 0),
    0,
  )
  const totalMinutes =
    clean.reduce(
      (sum, line) => sum + (byId.get(line.serviceId)?.duration_minutes ?? 0),
      0,
    ) + Math.max(0, clean.length - 1) * unit.gap_between_services_minutes

  // "Escolher" no primeiro serviço, "Juntar" nos seguintes: o botão não
  // pode oferecer "outro" enquanto não houver um.
  const addLabel =
    clean.length === 0 ? dict.funnel.chooseService : dict.funnel.addService

  // O QUE AINDA CABE NO DIA DELA.
  //
  // Foi aqui que o funil deixava a cliente cair num beco: com meia hora
  // livre, a ementa oferecia uma coloração de duas — e o «não dá» só
  // aparecia dois ecrãs à frente, na página das horas, já com tudo
  // escolhido. A regra dos livros de marcações é só se oferecer o que
  // se pode cumprir, e por isso cada serviço é medido contra o maior
  // bocado livre seguido que lhe resta no dia: os serviços de uma
  // visita correm seguidos, e o que conta na agenda é a duração mais as
  // folgas de preparação, com o intervalo da casa entre serviços.
  //
  // A conta é necessária mas não exacta (a grelha de horários e os
  // recursos físicos só se decidem no passo seguinte) — por isso erra
  // sempre para o lado de oferecer, e a página das horas continua a ser
  // quem manda.
  const gapMin = unit.gap_between_services_minutes
  const occupies = (s: ServiceRow) =>
    s.duration_minutes + s.buffer_before_minutes + s.buffer_after_minutes
  const cartOccupies =
    clean.reduce((sum, line) => {
      const s = byId.get(line.serviceId)
      return sum + (s ? occupies(s) : 0)
    }, 0) +
    Math.max(0, clean.length - 1) * gapMin

  /*
   * O TECTO DO DIA.
   *
   * É contra ele que se mede se um serviço ainda cabe. Com
   * profissional escolhida é o maior bocado livre DELA. Ao domingo não
   * há «ela»: o tecto é o da pessoa que tiver o maior bocado livre,
   * porque basta uma para a visita caber — e é essa que o motor há-de
   * escolher no passo seguinte.
   */
  const longestFree = person
    ? person.longestFreeMinutes
    : Math.max(0, ...team.map((p) => p.longestFreeMinutes))

  const categories = new Map<string, { slug: string; name: string; services: ServiceRow[] }>()
  for (const row of bookable) {
    const entry = categories.get(row.category_id) ?? {
      slug: row.category_slug,
      name: row.category_name,
      services: [],
    }
    entry.services.push(row)
    categories.set(row.category_id, entry)
  }

  const timesHref = funnelHref(`${here}/horarios`, { day, staffId: chosenStaff, cart: clean })
  const visitMeta = `${clean.length} ${
    clean.length === 1 ? dict.common.service : dict.common.services
  } · ${formatDuration(totalMinutes, language)}`
  const total = formatCents(totalCents, org.currency, language)
  const categoryList = [...categories.values()]

  return (
    <FunnelStage
      step={4}
      picksStaff={picksStaff}
      dict={dict}
      hrefs={[
        '/agendar',
        funnelHref(here, { day }),
        // Ao domingo o passo da profissional não existe: a migalha
        // dele não pode ficar acesa a apontar para uma página que
        // manda a cliente de volta para aqui.
        picksStaff ? funnelHref(`${here}/profissional`, { day }) : null,
        null,
        null,
        null,
      ]}
      eyebrow={unit.name}
      title={dict.funnel.serviceTitle}
      back={{
        href: picksStaff
          ? funnelHref(`${here}/profissional`, { day })
          : funnelHref(here, { day }),
        label: dict.common.back,
      }}
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-2">
          {/*
            COM QUEM E QUANDO, NUM CARTÃO PEQUENO.

            Era uma frase comprida — «Com Profissional 01 · terça-feira,
            15 de setembro» — com dois links sublinhados por baixo, e no
            telemóvel levava três linhas. As duas escolhas continuam à
            vista, e a saída é uma só: «Alterar» leva à profissional, e lá
            a semana deixa trocar o dia também. Ao domingo não há «com
            quem», e «Alterar» volta ao dia.
          */}
          <div className="flex items-center gap-[11px] rounded-2xl bg-[var(--surface-raised)] py-2 pr-3.5 pl-2 shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:max-w-[23.75rem] sm:rounded-[18px] sm:py-2.5 sm:pr-5 sm:pl-2.5">
            {person ? (
              <span className="relative size-[34px] shrink-0 overflow-hidden rounded-full bg-[#F3EBDA] sm:size-[38px]">
                {person.avatarUrl ? (
                  <Photo src={person.avatarUrl} alt="" />
                ) : (
                  <span
                    aria-hidden
                    className="display flex h-full w-full items-center justify-center text-[0.8125rem] leading-none text-[var(--action-strong)]"
                  >
                    {initialsOf(person.publicName)}
                  </span>
                )}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(198,169,107,0.45)]"
                />
              </span>
            ) : null}
            <div className={clsx('min-w-0 flex-1', !person && 'pl-2')}>
              {person ? (
                <p className="truncate text-[0.875rem] leading-[19px] font-medium text-[var(--ink)]">
                  {person.publicName}
                </p>
              ) : null}
              <p
                className={clsx(
                  'truncate first-letter:uppercase',
                  person
                    ? 'text-[0.75rem] leading-4 text-[#8A7F6E]'
                    : 'text-[0.875rem] leading-[19px] font-medium text-[var(--ink)]',
                )}
              >
                {formatDayLong(day, unit.timezone, language)}
              </p>
            </div>
            <Link
              href={
                picksStaff
                  ? funnelHref(`${here}/profissional`, { day })
                  : funnelHref(here, { day })
              }
              className="-my-2 shrink-0 py-2 text-[0.78125rem] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--action-strong)]"
            >
              {dict.common.change}
            </Link>
          </div>

          {/* Porque é que ninguém lhe perguntou com quem. Dito uma vez, em
              cima, antes de ela dar pela falta do passo. */}
          {!picksStaff ? <Notice tone="neutral">{dict.funnel.sundayNoStaff}</Notice> : null}

          {dropped ? <Notice tone="warn">{dict.errors.serviceGone}</Notice> : null}

          {/* Cheio: dizer-se uma vez em cima, em vez de um traço mudo em
              cada linha do catálogo. */}
          {clean.length >= MAX_CART_LINES ? (
            <Notice tone="warn">{dict.funnel.cartFull}</Notice>
          ) : null}

          {/* Ela existe, está de serviço, e não tem uma única habilidade
              aberta ao online. É raro e é da gestão, não da cliente — mas
              sem isto ficava uma página em branco com um botão morto. */}
          {bookable.length === 0 ? (
            <Empty
              title={dict.funnel.staffNoServices}
              hint={dict.funnel.staffNoServicesHint}
            />
          ) : (
            <div className="mt-1.5 flex flex-col gap-2 sm:gap-2.5">
              {categoryList.map((category) => {
                const chosenHere = category.services.filter((service) =>
                  clean.some((line) => line.serviceId === service.id),
                ).length
                // Abre à chegada só a categoria onde já se escolheu alguma
                // coisa — fechá-la era esconder a escolha que ela fez.
                //
                // As outras chegam todas fechadas. Abria-se a primeira
                // para o ecrã não chegar só com títulos; com a fotografia
                // de cada família no cartão, as sete fechadas cabem num
                // ecrã e dizem o que há melhor do que uma lista aberta.
                const openAtStart = chosenHere > 0
                return (
                  <ServiceGroup
                    key={category.name}
                    title={category.name}
                    media={
                      FAMILY_PHOTOS.has(category.slug) ? (
                        <Photo src={`/fotos/familias/${category.slug}.jpg`} alt="" />
                      ) : (
                        <span
                          aria-hidden
                          className="display absolute inset-0 grid place-items-center text-lg text-[var(--accent)]"
                          style={{
                            background:
                              'linear-gradient(150deg, color-mix(in srgb, var(--gold) 22%, var(--surface-2)), var(--surface-2))',
                          }}
                        >
                          {category.name.slice(0, 1)}
                        </span>
                      )
                    }
                    chosenLabel={
                      chosenHere > 0
                        ? (chosenHere === 1
                            ? dict.funnel.serviceChosen
                            : dict.funnel.serviceChosenMany
                          ).replace('{n}', String(chosenHere))
                        : null
                    }
                    defaultOpen={openAtStart}
                  >
                    {category.services.map((service, serviceIndex) => {
                      const chosenAt = clean.findIndex(
                        (line) => line.serviceId === service.id,
                      )
                      const chosen = chosenAt >= 0
                      const full = clean.length >= MAX_CART_LINES
                      // Não cabe no maior bocado livre que lhe resta: fica
                      // apagado com o motivo, como uma profissional de
                      // folga. Tirar continua sempre possível.
                      const noFit =
                        !chosen &&
                        cartOccupies +
                          (clean.length > 0 ? gapMin : 0) +
                          occupies(service) >
                          longestFree

                      const price = formatCents(service.price_cents, org.currency, language)
                      const detail = noFit
                        ? `${formatDuration(service.duration_minutes, language)} · ${dict.funnel.serviceNoFit}`
                        : formatDuration(service.duration_minutes, language) +
                          (service.description ? ` · ${service.description}` : '')

                      /* A linha inteira é o alvo: toca-se no serviço, e
                         tocar outra vez tira. O círculo diz o estado — um
                         «+» de fio, ou ouro cheio com o visto. As miniaturas
                         com iniciais saíram: eram quase todas desenho à
                         espera de fotografia, e ocupavam a largura do nome. */
                      const inside = (
                        <>
                          <span
                            aria-hidden
                            className={clsx(
                              'flex size-[22px] shrink-0 items-center justify-center rounded-full transition-colors sm:size-6',
                              chosen
                                ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                : noFit || full
                                  ? 'text-[#C9BEAC] shadow-[inset_0_0_0_1px_rgba(34,29,23,0.08)]'
                                  : 'text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(142,111,65,0.35)] group-hover:shadow-[inset_0_0_0_1px_var(--accent)]',
                            )}
                          >
                            {chosen ? <Check size={12} strokeWidth={2.6} /> : <Plus size={11} strokeWidth={2.2} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={clsx(
                                'block text-[0.90625rem] leading-5 sm:text-[0.9375rem]',
                                chosen
                                  ? 'font-medium text-[var(--action-strong)]'
                                  : 'text-[var(--ink)]',
                              )}
                            >
                              {service.name}
                            </span>
                            <span className="mt-px line-clamp-2 block text-[0.75rem] leading-[17px] text-[#8A7F6E]">
                              {detail}
                            </span>
                          </span>
                          <span className="tabular shrink-0 text-[0.875rem] leading-5 text-[var(--ink)] sm:text-[0.90625rem]">
                            {price}
                          </span>
                        </>
                      )

                      const rowClass = clsx(
                        'flex w-full items-center gap-3 px-3.5 py-3 text-left sm:gap-3.5 sm:px-5 sm:py-3.5',
                        chosen && 'bg-[rgba(198,169,107,0.08)]',
                      )

                      return (
                        <li key={service.id}>
                          {serviceIndex > 0 ? (
                            <span
                              aria-hidden
                              className="ml-12 block h-px bg-[rgba(34,29,23,0.06)] sm:ml-[58px]"
                            />
                          ) : null}
                          {(full || noFit) && !chosen ? (
                            // Visita cheia, ou serviço que já não cabe: a
                            // linha fica lá para se ler, mas deixa de
                            // prometer um toque que não faz nada.
                            <div className={clsx(rowClass, 'opacity-50')}>{inside}</div>
                          ) : (
                            <Link
                              href={funnelHref(`${here}/servicos`, {
                                day,
                                staffId: chosenStaff,
                                cart: chosen
                                  ? removeAt(clean, chosenAt)
                                  : addLine(clean, service.id),
                              })}
                              // Sem isto o Next saltava a página para o topo
                              // a cada toque — o carrinho muda de endereço,
                              // mas a cliente não está a mudar de sítio.
                              scroll={false}
                              // O nome do serviço só existe para quem lê o
                              // ecrã; para quem o ouve, vai no rótulo.
                              aria-label={`${
                                chosen ? dict.common.remove : addLabel
                              } · ${service.name}`}
                              className={clsx(
                                'group transition-colors outline-offset-[-2px] hover:bg-[#FFFDF8] focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                                rowClass,
                              )}
                            >
                              {inside}
                            </Link>
                          )}
                        </li>
                      )
                    })}
                  </ServiceGroup>
                )
              })}
            </div>
          )}

          {/* ------------------------------------------ sob consulta --- */}
          {onRequest.length > 0 ? (
            <OnRequest
              services={onRequest}
              unitName={unit.name}
              phone={unit.whatsapp_phone ?? org.whatsapp_phone}
              dayLong={formatDayLong(day, unit.timezone, language)}
              dict={dict}
            />
          ) : null}
        </div>

        {/* -------------------------------------------------- visita --- */}
        {/* Só no monitor. No telemóvel a barra escura do fundo traz o
            total e o botão, e esta coluna era a mesma decisão pedida
            duas vezes. */}
        <aside className="hidden rounded-[20px] bg-[var(--surface-raised)] p-[22px] shadow-[0_1px_2px_rgba(34,29,23,0.03),0_14px_32px_-24px_rgba(34,29,23,0.28)] lg:sticky lg:top-24 lg:block">
          <p className="text-[0.6875rem] leading-[14px] font-medium tracking-[0.18em] text-[var(--accent)] uppercase">
            {dict.funnel.yourVisit}
          </p>

          {clean.length === 0 ? (
            <p className="mt-3.5 text-[0.8125rem] leading-relaxed text-[#8A7F6E]">
              {dict.funnel.emptyCart}
            </p>
          ) : (
            <>
              <ul className="mt-3.5 space-y-3">
                {clean.map((line, index) => {
                  const service = byId.get(line.serviceId)
                  if (!service) return null
                  return (
                    <li key={`${line.serviceId}-${index}`} className="flex items-start gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.875rem] leading-5 text-[var(--ink)]">{service.name}</p>
                        <p className="tabular text-[0.75rem] leading-[17px] text-[#8A7F6E]">
                          {formatDuration(service.duration_minutes, language)} ·{' '}
                          {formatCents(service.price_cents, org.currency, language)}
                        </p>
                      </div>
                      <Link
                        href={funnelHref(`${here}/servicos`, {
                          day,
                          staffId: chosenStaff,
                          cart: removeAt(clean, index),
                        })}
                        scroll={false}
                        aria-label={`${dict.common.remove} · ${service.name}`}
                        className="-mt-1.5 -mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] hover:text-[var(--bad)]"
                      >
                        <X size={14} />
                      </Link>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-4 border-t border-[rgba(34,29,23,0.07)] pt-3">
                <div className="flex items-baseline justify-between text-[0.8125rem] leading-5">
                  <span className="text-[var(--ink-muted)]">{dict.common.duration}</span>
                  <span className="tabular text-[var(--ink)]">
                    {formatDuration(totalMinutes, language)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-[0.8125rem] text-[var(--ink-muted)]">{dict.common.total}</span>
                  <span className="tabular text-[1.1875rem] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                    {total}
                  </span>
                </div>
              </div>
            </>
          )}

          {clean.length === 0 ? (
            // A mesma altura do botão a sério: quando a visita deixa de
            // estar vazia, o cartão não dá um salto.
            <span className="mt-[18px] flex h-12 cursor-not-allowed items-center justify-center rounded-full text-[0.9375rem] font-medium text-[var(--ink-faint)] shadow-[inset_0_0_0_1px_rgba(34,29,23,0.1)]">
              {dict.funnel.chooseTime}
            </span>
          ) : (
            <Link
              href={timesHref}
              className="botao sheen mt-[18px] flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--action)] text-[0.9375rem] font-semibold tracking-[0.01em] text-[var(--action-ink)] shadow-[0_10px_22px_-14px_rgba(111,85,47,0.7)] transition-all duration-300 select-none hover:-translate-y-0.5 hover:bg-[var(--action-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px"
            >
              {dict.funnel.chooseTime}
              <ChevronRight size={15} strokeWidth={2} aria-hidden />
            </Link>
          )}
        </aside>
      </div>

      {/*
        A BARRA DA VISITA, NO TELEMÓVEL: UM CARTÃO ESCURO A FLUTUAR.

        É a mesma faixa do topo, em pequeno, colada ao fundo do ecrã
        assim que há alguma coisa escolhida. É `sticky`, não `fixed`:
        larga o ecrã quando o conteúdo acaba, em vez de ficar pousada por
        cima do rodapé. Qualquer `overflow` num antepassado desfaz isto.
      */}
      {clean.length > 0 ? (
        <div className="band-dark animate-rise sticky bottom-3 z-40 mt-5 flex items-center gap-3 rounded-[20px] py-2.5 pr-2.5 pl-4 shadow-[inset_0_0_0_1px_rgba(211,184,126,0.14),0_18px_40px_-16px_rgba(20,16,9,0.55)] lg:hidden"
          style={{
            background:
              'radial-gradient(260px 160px at 95% -20%, rgba(211,184,126,0.12), rgba(211,184,126,0) 70%), linear-gradient(158deg, #1E1811 0%, #141009 100%)',
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.6875rem] leading-[14px] text-[var(--ink-muted)]">{visitMeta}</p>
            <p className="tabular mt-0.5 text-[1.0625rem] leading-[1.15] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              {total}
            </p>
          </div>
          <Link
            href={timesHref}
            className="flex h-[42px] shrink-0 items-center gap-1 rounded-full bg-[#C6A96B] pr-3.5 pl-[18px] text-[0.875rem] font-semibold text-[#1E1811] transition-colors hover:bg-[#D3B87E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D3B87E]"
          >
            {dict.funnel.chooseTime}
            <ChevronRight size={15} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      ) : null}
    </FunnelStage>
  )
}


/**
 * OS SERVIÇOS SOB CONSULTA.
 *
 * Ao domingo a casa faz cabelo. Mãos e pés, rosto e cera dependem de
 * quem lá estiver, e isso não se sabe com antecedência — por isso não
 * se marcam, mas também não se escondem: uma ementa que encolhe sem
 * explicação faz a cliente pensar que se enganou no dia.
 *
 * Ficam à vista, com preço e duração, e cada um leva a sua conversa já
 * escrita. É a mesma regra que rege o resto do funil — quem não pode
 * ser servido vê porquê, e vê a saída.
 *
 * A mensagem nomeia O SERVIÇO e O DIA. Do outro lado ninguém tem de
 * perguntar «qual?» nem «quando?», e é isso que faz a diferença entre
 * um botão de WhatsApp e um atalho útil.
 */
function OnRequest({
  services,
  unitName,
  phone,
  dayLong,
  dict,
}: {
  services: ServiceRow[]
  unitName: string
  phone: string | null
  dayLong: string
  dict: Awaited<ReturnType<typeof getDictionary>>
}) {
  return (
    <section className="mt-3 rounded-[18px] bg-[var(--surface-raised)] px-3.5 pt-4 pb-1 shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:rounded-[20px] sm:px-5 sm:pt-5">
      <h3 className="display text-[1.0625rem] leading-[1.25] text-[var(--ink)] sm:text-[1.1875rem]">
        {dict.funnel.sundayOnRequestTitle}
      </h3>
      <p className="mt-1.5 max-w-prose text-[0.78125rem] leading-[18px] text-[#8A7F6E]">
        {dict.funnel.sundayOnRequestHint}
      </p>

      <ul className="mt-3">
        {services.map((service) => {
          /* Sem número da casa não há conversa para abrir. Em vez de um
             botão que não vai a lado nenhum, o serviço fica na mesma
             lista, dito «sob consulta» e sem atalho — que é a verdade. */
          const href = phone
            ? waLink(
                phone,
                fill(dict.funnel.sundayAskMessage, {
                  servico: service.name,
                  dia: dayLong,
                  loja: unitName,
                }),
              )
            : null

          return (
            <li
              key={service.id}
              className="flex items-start gap-3 border-t border-[rgba(34,29,23,0.06)] py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-3">
                  <span className="min-w-0 text-[0.90625rem] leading-5 text-[var(--ink-muted)]">
                    {service.name}
                  </span>
                  <span className="ml-auto shrink-0 text-[0.6875rem] tracking-[0.08em] text-[var(--ink-faint)] uppercase sm:ml-0">
                    {dict.funnel.sundayOnRequest}
                  </span>
                </span>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-[0.75rem] text-[var(--ink-muted)] underline underline-offset-4 hover:text-[var(--accent)]"
                    /* Quem ouve o ecrã tem de saber de que serviço é
                       este botão: a lista tem muitos iguais. */
                    aria-label={`${dict.funnel.sundayAsk} · ${service.name}`}
                  >
                    <MessageCircle size={13} aria-hidden />
                    {dict.funnel.sundayAsk}
                  </a>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
