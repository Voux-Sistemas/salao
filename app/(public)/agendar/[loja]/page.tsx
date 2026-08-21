import Link from 'next/link'
import { notFound } from 'next/navigation'
import clsx from 'clsx'
import { Check, Plus, X } from 'lucide-react'
import { sql } from '@/lib/db'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import {
  CART_PARAM,
  addLine,
  funnelHref,
  parseCart,
  removeAt,
  setStaffAt,
  MAX_CART_LINES,
} from '@/lib/cart'
import { ButtonLink, Eyebrow, Notice } from '@/components/ui'
import { FunnelSteps } from '@/components/funnel-steps'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ServiceRow = {
  category_id: string
  category_name: string
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
}

type SkillRow = {
  service_id: string
  staff_id: string
  staff_name: string
}

type PriceRow = { ord: number; price_cents: number; duration_minutes: number }

export async function generateMetadata({ params }: Params) {
  const { loja } = await params
  const unit = await getUnitBySlug(loja)
  return { title: unit ? `Marcar · ${unit.name}` : 'Marcar' }
}

/**
 * Passo 2 — escolher o serviço (ou vários) e, se quiser, a profissional.
 *
 * Só aparecem aqui os serviços abertos ao online e as profissionais que
 * aceitam marcação online. Quem não tem a habilidade nunca aparece como
 * opção nesse serviço.
 *
 * Tudo o que se escolhe entra no endereço: nada disto precisa de sessão
 * nem de JavaScript.
 */
export default async function ChooseServicesPage({ params, searchParams }: Params) {
  const { loja } = await params
  const query = await searchParams
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])
  if (!unit) notFound()

  const [dict, language, services, skills] = await Promise.all([
    getDictionary(),
    getLanguage(),
    sql<ServiceRow[]>`
      select c.id as category_id, c.name as category_name,
             s.id, s.name, s.description,
             e.duration_minutes, e.price_cents
        from service s
        join service_category c on c.id = s.category_id and c.is_active
        cross join lateral effective_service_pricing(s.id, ${unit.id}::uuid, null::uuid) e
       where s.org_id = ${org.id} and s.is_active and s.bookable_online
       order by c.sort_order, c.name, s.sort_order, s.name
    `,
    sql<SkillRow[]>`
      select ss.service_id, s.id as staff_id, s.name as staff_name
        from staff_skill ss
        join staff s on s.id = ss.staff_id
        join staff_unit su on su.staff_id = s.id and su.unit_id = ${unit.id}
       where s.org_id = ${org.id}
         and s.is_active
         and s.accepts_online_booking
       order by s.sort_order, s.name
    `,
  ])

  const byId = new Map(services.map((s) => [s.id, s]))

  // Um serviço desactivado entretanto é apanhado já — não só no fim.
  const cart = parseCart(query[CART_PARAM]).filter((line) => byId.has(line.serviceId))
  const dropped = parseCart(query[CART_PARAM]).length !== cart.length

  const staffByService = new Map<string, SkillRow[]>()
  for (const row of skills) {
    const list = staffByService.get(row.service_id) ?? []
    list.push(row)
    staffByService.set(row.service_id, list)
  }

  // Uma escolha de profissional que já não seja possível volta a
  // "sem preferência" em vez de rebentar no passo seguinte.
  const clean = cart.map((line) => {
    if (!line.staffId) return line
    const eligible = staffByService.get(line.serviceId) ?? []
    return eligible.some((s) => s.staff_id === line.staffId)
      ? line
      : { ...line, staffId: null }
  })

  // Preço e duração efectivos de cada linha, pela precedência que vive
  // na base de dados: profissional+loja → profissional → loja → base.
  const prices =
    clean.length === 0
      ? []
      : await sql<PriceRow[]>`
          select p.ord::int as ord, e.price_cents, e.duration_minutes
            from unnest(
                   ${clean.map((l) => l.serviceId)}::uuid[],
                   ${clean.map((l) => l.staffId)}::uuid[]
                 ) with ordinality as p(service_id, staff_id, ord)
           cross join lateral effective_service_pricing(
                   p.service_id, ${unit.id}::uuid, p.staff_id) e
           order by p.ord
        `
  const priceAt = new Map(prices.map((p) => [p.ord, p]))

  const totalCents = prices.reduce((sum, p) => sum + p.price_cents, 0)
  const totalMinutes =
    prices.reduce((sum, p) => sum + p.duration_minutes, 0) +
    Math.max(0, clean.length - 1) * unit.gap_between_services_minutes

  const here = `/agendar/${unit.slug}`
  const categories = new Map<string, { name: string; services: ServiceRow[] }>()
  for (const row of services) {
    const entry = categories.get(row.category_id) ?? {
      name: row.category_name,
      services: [],
    }
    entry.services.push(row)
    categories.set(row.category_id, entry)
  }

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 py-14 sm:py-20">
      <FunnelSteps
        current={2}
        dict={dict}
        hrefs={['/agendar', null, null, null]}
      />

      <header className="mt-8">
        <Eyebrow>{unit.name}</Eyebrow>
        <h1 className="display mt-3 text-3xl sm:text-4xl">{dict.funnel.serviceTitle}</h1>
        <p className="mt-3 text-[0.9375rem] text-[var(--ink-muted)]">
          {dict.funnel.serviceSubtitle}
        </p>
      </header>

      {dropped ? (
        <div className="mt-6">
          <Notice tone="warn">{dict.errors.serviceGone}</Notice>
        </div>
      ) : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        {/* ------------------------------------------------ catálogo --- */}
        <div className="space-y-12">
          {[...categories.values()].map((category) => (
            <section key={category.name}>
              <h2 className="display text-xl text-[var(--accent)]">{category.name}</h2>
              <ul className="mt-5 border-t border-[var(--line-soft)]">
                {category.services.map((service) => {
                  const chosen = clean.some((l) => l.serviceId === service.id)
                  const full = clean.length >= MAX_CART_LINES
                  return (
                    <li
                      key={service.id}
                      className="flex items-start gap-4 border-b border-[var(--line-soft)] py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--ink)]">{service.name}</p>
                        {service.description ? (
                          <p className="mt-1 max-w-lg text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
                            {service.description}
                          </p>
                        ) : null}
                        <p className="tabular mt-1.5 text-[0.75rem] text-[var(--ink-faint)]">
                          {formatDuration(service.duration_minutes, language)} ·{' '}
                          {formatCents(service.price_cents, org.currency, language)}
                        </p>
                      </div>

                      {chosen || full ? (
                        <span
                          className={clsx(
                            'mt-0.5 inline-flex h-8 items-center gap-1.5 px-3 text-[0.75rem]',
                            chosen
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--ink-faint)]',
                          )}
                        >
                          {chosen ? (
                            <>
                              <Check size={14} />
                              {dict.funnel.selected}
                            </>
                          ) : null}
                        </span>
                      ) : (
                        <Link
                          href={funnelHref(here, { cart: addLine(clean, service.id) })}
                          className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1.5 border border-[var(--line)] px-3 text-[0.75rem] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          <Plus size={14} />
                          {dict.funnel.addService}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* -------------------------------------------------- visita --- */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="border border-[var(--line-soft)] bg-[var(--surface-raised)] p-6">
            <Eyebrow>{dict.funnel.yourVisit}</Eyebrow>

            {clean.length === 0 ? (
              <p className="mt-5 text-[0.8125rem] leading-relaxed text-[var(--ink-faint)]">
                {dict.funnel.emptyCart}
              </p>
            ) : (
              <>
                <ul className="mt-5 space-y-5">
                  {clean.map((line, index) => {
                    const service = byId.get(line.serviceId)
                    const price = priceAt.get(index + 1)
                    const eligible = staffByService.get(line.serviceId) ?? []
                    if (!service) return null
                    return (
                      <li
                        key={`${line.serviceId}-${index}`}
                        className="border-b border-[var(--line-soft)] pb-5 last:border-0 last:pb-0"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.8125rem] text-[var(--ink)]">
                              {service.name}
                            </p>
                            <p className="tabular mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
                              {formatDuration(
                                price?.duration_minutes ?? service.duration_minutes,
                                language,
                              )}{' '}
                              ·{' '}
                              {formatCents(
                                price?.price_cents ?? service.price_cents,
                                org.currency,
                                language,
                              )}
                            </p>
                          </div>
                          <Link
                            href={funnelHref(here, { cart: removeAt(clean, index) })}
                            aria-label={dict.common.remove}
                            className="mt-0.5 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
                          >
                            <X size={15} />
                          </Link>
                        </div>

                        {eligible.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Link
                              href={funnelHref(here, {
                                cart: setStaffAt(clean, index, null),
                              })}
                              className={chipClass(line.staffId === null)}
                            >
                              {dict.funnel.anyProfessional}
                            </Link>
                            {eligible.map((person) => (
                              <Link
                                key={person.staff_id}
                                href={funnelHref(here, {
                                  cart: setStaffAt(clean, index, person.staff_id),
                                })}
                                className={chipClass(line.staffId === person.staff_id)}
                              >
                                {person.staff_name}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-6 border-t border-[var(--line-soft)] pt-4">
                  <div className="flex items-baseline justify-between text-[0.8125rem]">
                    <span className="text-[var(--ink-muted)]">
                      {dict.common.duration}
                    </span>
                    <span className="tabular text-[var(--ink)]">
                      {formatDuration(totalMinutes, language)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-[0.8125rem] text-[var(--ink-muted)]">
                      {dict.common.total}
                    </span>
                    <span className="tabular display text-lg text-[var(--ink)]">
                      {formatCents(totalCents, org.currency, language)}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="mt-6">
              {clean.length === 0 ? (
                <span className="block cursor-not-allowed border border-[var(--line)] px-5 py-3 text-center text-sm text-[var(--ink-faint)]">
                  {dict.common.next}
                </span>
              ) : (
                <ButtonLink
                  href={funnelHref(`${here}/horarios`, { cart: clean })}
                  size="lg"
                  className="w-full"
                >
                  {dict.common.next}
                </ButtonLink>
              )}
            </div>
          </div>

          <p className="mt-4 text-[0.6875rem] leading-relaxed text-[var(--ink-faint)]">
            {dict.funnel.anyProfessionalHint}
          </p>
        </aside>
      </div>
    </div>
  )
}

function chipClass(active: boolean): string {
  return clsx(
    'inline-flex h-7 items-center px-2.5 text-[0.6875rem] transition-colors',
    active
      ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
      : 'border border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
  )
}
