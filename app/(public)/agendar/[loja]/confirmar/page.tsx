import { notFound, redirect } from 'next/navigation'
import { getClientActor } from '@/lib/auth/client-actor'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { planAt } from '@/lib/availability'
import { formatCents } from '@/lib/money'
import {
  formatDayLong,
  formatDuration,
  formatTime,
  isoDay,
} from '@/lib/time'
import {
  CART_PARAM,
  TIME_PARAM,
  cartToParam,
  first,
  funnelHref,
  parseCart,
} from '@/lib/cart'
import { Eyebrow } from '@/components/ui'
import { FunnelSteps } from '@/components/funnel-steps'
import { ConfirmForm } from '@/components/confirm-form'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = { title: 'Confirmar' }

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
  const cart = parseCart(query[CART_PARAM])
  const time = first(query[TIME_PARAM])

  if (cart.length === 0) redirect(here)

  const startsAt = time ? new Date(time) : null
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    redirect(funnelHref(`${here}/horarios`, { cart }))
  }

  const day = isoDay(startsAt, unit.timezone)
  const plan = await planAt(unit, day, cart, startsAt, 'online')

  // Esse horário já não é válido: volta-se aos que restam.
  if (!plan) redirect(funnelHref(`${here}/horarios`, { cart, day }))

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])
  const minutes = Math.round(
    (plan.endsAt.getTime() - plan.startsAt.getTime()) / 60_000,
  )

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-14 sm:py-20">
      <FunnelSteps
        current={4}
        dict={dict}
        hrefs={[
          '/agendar',
          funnelHref(here, { cart }),
          funnelHref(`${here}/horarios`, { cart, day }),
          null,
        ]}
      />

      <header className="mt-8">
        <Eyebrow>{unit.name}</Eyebrow>
        <h1 className="display mt-3 text-3xl sm:text-4xl">{dict.funnel.confirmTitle}</h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--ink-muted)]">
          {dict.funnel.confirmSubtitle}
        </p>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <div className="max-w-md">
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
              note: dict.funnel.noteLabel,
              notePlaceholder: dict.funnel.notePlaceholder,
              optional: dict.common.optional,
              submit: dict.funnel.submit,
            }}
          />
        </div>

        {/* ------------------------------------------------- resumo --- */}
        <aside className="lg:order-last">
          <div className="border border-[var(--line-soft)] bg-[var(--surface-raised)] p-6">
            <Eyebrow>{dict.funnel.yourVisit}</Eyebrow>

            <p className="display mt-4 text-lg text-[var(--ink)]">
              {formatDayLong(day, unit.timezone, language)}
            </p>
            <p className="tabular mt-1 text-[var(--accent)]">
              {formatTime(plan.startsAt, unit.timezone, language)}
              {' · '}
              {formatDuration(minutes, language)}
            </p>

            <ul className="mt-5 space-y-3 border-t border-[var(--line-soft)] pt-4">
              {plan.items.map((item, index) => (
                <li key={`${item.serviceId}-${index}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.8125rem] text-[var(--ink)]">
                      {item.serviceName}
                    </span>
                    <span className="tabular text-[0.8125rem] text-[var(--ink-muted)]">
                      {formatCents(item.priceCents, org.currency, language)}
                    </span>
                  </div>
                  <p className="tabular mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
                    {formatTime(item.startsAt, unit.timezone, language)}
                    {' · '}
                    {dict.common.with} {item.staffName}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-baseline justify-between border-t border-[var(--line-soft)] pt-4">
              <span className="text-[0.8125rem] text-[var(--ink-muted)]">
                {dict.common.total}
              </span>
              <span className="tabular display text-lg text-[var(--ink)]">
                {formatCents(plan.totalCents, org.currency, language)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
