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
  isoDay,
} from '@/lib/time'
import {
  CART_PARAM,
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
import { FunnelShell, VisitSummary } from '@/components/funnel-shell'
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
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    redirect(funnelHref(`${here}/horarios`, { cart: rawCart, staffId: askedStaff }))
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

  return (
    <FunnelShell
      step={6}
      dict={dict}
      hrefs={[
        '/agendar',
        funnelHref(here, { day }),
        picksStaff ? funnelHref(`${here}/profissional`, { day }) : null,
        funnelHref(`${here}/servicos`, { day, staffId, cart }),
        funnelHref(`${here}/horarios`, { cart, day, staffId }),
        null,
      ]}
      eyebrow={unit.name}
      title={dict.funnel.confirmTitle}
      subtitle={dict.funnel.confirmSubtitle}
      aside={
        <VisitSummary
          title={dict.funnel.yourVisit}
          head={
            <>
              <p className="display text-lg leading-snug text-[var(--ink)] first-letter:uppercase">
                {formatDayLong(day, unit.timezone, language)}
              </p>
              <p className="tabular mt-1 text-[var(--accent)]">
                {formatTime(plan.startsAt, unit.timezone, language)}
                {' · '}
                {formatDuration(minutes, language)}
              </p>
            </>
          }
          lines={plan.items.map((item) => ({
            label: names.get(item.serviceId) ?? item.serviceName,
            /* Ao domingo nao se diz «com quem»: a cliente nao
               escolheu ninguem, e quem atende decide-se no salao. */
            meta: picksStaff
              ? `${formatTime(item.startsAt, unit.timezone, language)} · ${dict.common.with} ${item.staffPublicName}`
              : formatTime(item.startsAt, unit.timezone, language),
            value: formatCents(item.priceCents, org.currency, language),
          }))}
          total={{
            label: dict.common.total,
            value: formatCents(plan.totalCents, org.currency, language),
          }}
          footer={
            <p className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
              <MapPin size={13} className="mt-0.5 shrink-0" />
              <span>
                {unit.name}
                {unit.address_line ? <>, {unit.address_line}</> : null}
                {unit.city ? <>, {unit.city}</> : null}
              </span>
            </p>
          }
        />
      }
    >
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
    </FunnelShell>
  )
}
