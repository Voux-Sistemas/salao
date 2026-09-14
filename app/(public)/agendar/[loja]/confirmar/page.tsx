import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getClientActor } from '@/lib/auth/client-actor'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { picksStaffOn } from '@/lib/sunday'
import { planAt } from '@/lib/availability'
import { formatCents } from '@/lib/money'
import {
  formatDayLong,
  formatDuration,
  formatTime,
  isValidDay,
  isValidInstant,
  isoDay,
  today,
} from '@/lib/time'
import {
  CART_PARAM,
  DAY_PARAM,
  STAFF_PARAM,
  TIME_PARAM,
  cartToParam,
  first,
  funnelHref,
  parseCart,
  parseStaff,
} from '@/lib/cart'
import { serviceNamesFor } from '@/lib/catalog-names'
import { MapPin } from 'lucide-react'
import { FunnelStage } from '@/components/funnel-stage'
import { ConfirmForm } from '@/components/confirm-form'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.tabs.confirm,
    // Passo a meio de um funil: nada disto tem que estar num motor de busca.
    robots: { index: false, follow: false },
  }
}

/**
 * Passo 4 — o nome e o telefone, e gravar.
 *
 * Antes de mostrar o quê que seja, o servidor volta a planear a hora
 * escolhida. Um horário que entretanto encheu é apanhado aqui — não só
 * depois de a cliente escrever tudo.
 */
export default async function ConfirmPage({ params, searchParams }: Params) {
  const { loja } = await params
  const query = await searchParams
  const [org, unit, client] = await Promise.all([
    requireOrg(),
    getUnitBySlug(loja),
    // Quem já entrou na área dela não volta a escrever o que já sabemos.
    getClientActor(),
  ])
  if (!unit) notFound()

  const here = `/agendar/${unit.slug}`
  const askedStaff = parseStaff(query[STAFF_PARAM])
  const time = first(query[TIME_PARAM])
  const rawCart = parseCart(query[CART_PARAM])

  if (rawCart.length === 0) redirect(here)

  const startsAt = time ? new Date(time) : null
  // «Inválido» inclui os anos expandidos que o new Date aceita mas o
  // calendário da casa recusa — ver isValidInstant em lib/time.ts.
  if (!startsAt || !isValidInstant(startsAt)) {
    // E volta-se COM O DIA: sem ele, a página das horas mandava para o
    // selector de dias e o carrinho perdia-se pelo caminho. O `?d=` do
    // endereço serve; um endereço sem ele recomeça em hoje.
    const askedDay = first(query[DAY_PARAM])
    const fallbackDay =
      askedDay && isValidDay(askedDay) ? askedDay : today(unit.timezone)
    redirect(
      funnelHref(`${here}/horarios`, {
        cart: rawCart,
        staffId: askedStaff,
        day: fallbackDay,
      }),
    )
  }

  /*
   * Aqui o dia só se sabe depois de ler a hora — e é o dia que diz se
   * houve profissional a escolher. Ao domingo não houve: um `?p=` que
   * chegue por uma ligação antiga é ignorado, e a visita vai ao motor
   * sem dono, para ele a repartir por quem estiver livre.
   */
  const day = isoDay(startsAt, unit.timezone)
  const picksStaff = picksStaffOn(day)
  const staffId = picksStaff ? askedStaff : null

  // A profissional da visita manda em todas as linhas — é ela que foi
  // escolhida, e não a que uma ligação antiga possa trazer no carrinho.
  const cart = rawCart.map((line) => ({ ...line, staffId }))

  const plan = await planAt(unit, day, cart, startsAt, 'online')

  // Esse horário já não é válido: volta-se aos que restam.
  if (!plan) redirect(funnelHref(`${here}/horarios`, { cart, day, staffId }))

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])
  const minutes = Math.round(
    (plan.endsAt.getTime() - plan.startsAt.getTime()) / 60_000,
  )

  // O ecrã onde ela escreve o nome e carrega em marcar: o resumo ao
  // lado tem de estar na língua em que ela leu o preçário.
  const names = await serviceNamesFor(
    plan.items.map((item) => item.serviceId),
    language,
  )

  const timesHref = funnelHref(`${here}/horarios`, { cart, day, staffId })
  const dayLong = formatDayLong(day, unit.timezone, language)
  const startTime = formatTime(plan.startsAt, unit.timezone, language)
  const total = formatCents(plan.totalCents, org.currency, language)
  const staffName = picksStaff ? (plan.items[0]?.staffPublicName ?? null) : null
  const address = [unit.name, unit.address_line, unit.city].filter(Boolean).join(', ')

  return (
    <FunnelStage
      step={6}
      picksStaff={picksStaff}
      dict={dict}
      hrefs={[
        '/agendar',
        funnelHref(here, { day }),
        picksStaff ? funnelHref(`${here}/profissional`, { day }) : null,
        funnelHref(`${here}/servicos`, { day, staffId, cart }),
        timesHref,
        null,
      ]}
      eyebrow={unit.name}
      title={dict.funnel.confirmTitle}
      back={{ href: timesHref, label: dict.common.back }}
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,30rem)_21.25rem] lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2.5">
          {/*
            NO TELEMÓVEL O RECIBO VEM PRIMEIRO, EM PEQUENO.

            Estava no fim da página, depois do botão: ela escrevia o nome e
            confirmava sem ter à vista o que estava a confirmar. Aqui vai
            o dia, a hora, os serviços e o total, antes dos campos. No
            monitor o recibo inteiro fica na coluna do lado.
          */}
          <div className="rounded-[18px] bg-[var(--surface-raised)] px-3.5 py-3 shadow-[0_1px_2px_rgba(34,29,23,0.03)] lg:hidden">
            <div className="flex items-baseline justify-between gap-2.5">
              <p className="display text-[1.0625rem] leading-[1.25] text-[var(--ink)] first-letter:uppercase">
                {dayLong}
              </p>
              <p className="tabular shrink-0 text-[0.9375rem] font-semibold text-[var(--accent)]">
                {startTime}
              </p>
            </div>
            <ul className="mt-2.5 border-t border-[rgba(34,29,23,0.07)] pt-2">
              {plan.items.map((item, index) => (
                <li
                  key={`${item.serviceId}-${index}`}
                  className="flex items-baseline justify-between gap-3 text-[0.84375rem] leading-[22px] text-[var(--ink)]"
                >
                  <span className="min-w-0">{names.get(item.serviceId) ?? item.serviceName}</span>
                  <span className="tabular shrink-0">
                    {formatCents(item.priceCents, org.currency, language)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex items-baseline justify-between gap-3">
              <span className="tabular min-w-0 truncate text-[0.75rem] text-[#8A7F6E]">
                {[staffName, formatDuration(minutes, language)].filter(Boolean).join(' · ')}
              </span>
              <span className="tabular shrink-0 text-base font-semibold text-[var(--ink)]">
                {total}
              </span>
            </div>
          </div>

          {/* O formulário fica tal e qual — só o cartão à volta é novo, e
              o aspecto dos campos vem do .confirmar-leve no globals.css. */}
          <div className="confirmar-leve rounded-[18px] bg-[var(--surface-raised)] p-4 shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:rounded-[22px] sm:p-[26px]">
            <ConfirmForm
              unitSlug={unit.slug}
              cart={cartToParam(cart)}
              time={plan.startsAt.toISOString()}
              defaultName={client?.name ?? ''}
              defaultPhone={client?.phone ?? ''}
              labels={{
                name: dict.funnel.nameLabel,
                phone: dict.funnel.phoneLabel,
                phoneHint: dict.funnel.phoneHint,
                // «(opcional)» junto da pergunta, e não solto por baixo do
                // campo: o formulário mostra a dica só quando ela existe.
                note: `${dict.funnel.noteLabel} (${dict.common.optional})`,
                notePlaceholder: dict.funnel.notePlaceholder,
                optional: '',
                submit: dict.funnel.submit,
              }}
            />
          </div>
        </div>

        {/* -------------------------------------------------- recibo --- */}
        <aside className="hidden rounded-[20px] bg-[var(--surface-raised)] p-[22px] shadow-[0_1px_2px_rgba(34,29,23,0.03),0_14px_32px_-24px_rgba(34,29,23,0.28)] lg:sticky lg:top-24 lg:block">
          <p className="text-[0.6875rem] leading-[14px] font-medium tracking-[0.18em] text-[var(--accent)] uppercase">
            {dict.funnel.yourVisit}
          </p>
          <p className="display mt-3 text-[1.3125rem] leading-[1.2] text-[var(--ink)] first-letter:uppercase">
            {dayLong}
          </p>
          <p className="tabular mt-1 text-[0.875rem] leading-5 font-semibold text-[var(--accent)]">
            {startTime}
            <span className="font-normal text-[#8A7F6E]"> · {formatDuration(minutes, language)}</span>
          </p>

          <ul className="mt-3.5 space-y-2.5 border-t border-[rgba(34,29,23,0.07)] pt-3">
            {plan.items.map((item, index) => (
              <li
                key={`${item.serviceId}-${index}`}
                className="flex items-baseline justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[0.875rem] leading-5 text-[var(--ink)]">
                    {names.get(item.serviceId) ?? item.serviceName}
                  </p>
                  {/* Ao domingo não se diz «com quem»: a cliente não
                      escolheu ninguém, e quem atende decide-se no salão. */}
                  <p className="tabular text-[0.75rem] leading-[17px] text-[#8A7F6E]">
                    {picksStaff
                      ? `${formatTime(item.startsAt, unit.timezone, language)} · ${dict.common.with} ${item.staffPublicName}`
                      : formatTime(item.startsAt, unit.timezone, language)}
                  </p>
                </div>
                <span className="tabular shrink-0 text-[0.875rem] text-[var(--ink)]">
                  {formatCents(item.priceCents, org.currency, language)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3.5 flex items-baseline justify-between border-t border-[rgba(34,29,23,0.07)] pt-2.5">
            <span className="text-[0.8125rem] text-[var(--ink-muted)]">{dict.common.total}</span>
            <span className="tabular text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
              {total}
            </span>
          </div>

          <p className="mt-3.5 flex items-start gap-[7px] text-[0.75rem] leading-[17px] text-[#8A7F6E]">
            <MapPin size={13} className="mt-px shrink-0" aria-hidden />
            <span>{address}</span>
          </p>
        </aside>
      </div>
    </FunnelStage>
  )
}
