import type { Metadata } from 'next'
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
import { FunnelShell, MobileVisitBar } from '@/components/funnel-shell'
import { Reveal } from '@/components/reveal'

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

/*
 * O outro endereço que se cola numa conversa — e o mais usado dos dois,
 * porque é o que responde a «quero marcar». Mesma regra: quem lê a
 * pré-visualização é um robô sem cookie, logo português.
 *
 * O passo seguinte (escolher hora) e o de confirmar já são pessoais e
 * ficam fora do índice — ver o `robots` de cada um.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { loja } = await params
  const unit = await getUnitBySlug(loja)
  if (!unit) return { title: 'Marcar' }

  const title = `Marcar · ${unit.name}`
  const description = unit.city
    ? `Escolha o serviço, a profissional e a hora em ${unit.city}. Confirmação imediata.`
    : 'Escolha o serviço, a profissional e a hora. Confirmação imediata.'

  return {
    title,
    description,
    alternates: { canonical: `/agendar/${unit.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `/agendar/${unit.slug}`,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
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

  // "Escolher" no primeiro serviço, "Juntar" nos seguintes: o botão não
  // pode oferecer "outro" enquanto não houver um.
  const addLabel =
    clean.length === 0 ? dict.funnel.chooseService : dict.funnel.addService

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
    <FunnelShell
      step={2}
      dict={dict}
      hrefs={['/agendar', null, null, null]}
      eyebrow={unit.name}
      title={dict.funnel.serviceTitle}
      subtitle={dict.funnel.serviceSubtitle}
    >
      {dropped ? (
        <div className="mb-8">
          <Notice tone="warn">{dict.errors.serviceGone}</Notice>
        </div>
      ) : null}

      {/* Cheio: dizer-se uma vez em cima, em vez de um traço mudo em
          cada linha do catálogo. */}
      {clean.length >= MAX_CART_LINES ? (
        <div className="mb-8">
          <Notice tone="warn">{dict.funnel.cartFull}</Notice>
        </div>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* ------------------------------------------------ catálogo --- */}
        <div className="space-y-14">
          {[...categories.values()].map((category, groupIndex) => (
            <Reveal key={category.name} delay={groupIndex * 60}>
              <section>
                <div className="flex items-baseline gap-4">
                  <h2 className="display text-xl text-[var(--accent)]">
                    {category.name}
                  </h2>
                  <span className="h-px flex-1 bg-[var(--line-soft)]" />
                  <span className="tabular text-[0.6875rem] text-[var(--ink-faint)]">
                    {String(groupIndex + 1).padStart(2, '0')}
                  </span>
                </div>

                <ul className="mt-6 space-y-6">
                  {category.services.map((service) => {
                    const chosenAt = clean.findIndex(
                      (l) => l.serviceId === service.id,
                    )
                    const chosen = chosenAt >= 0
                    const full = clean.length >= MAX_CART_LINES
                    return (
                      <li key={service.id}>
                        {/* nome — pontilhado — preço: a leitura de uma ementa */}
                        <div className="flex items-baseline gap-3">
                          <p
                            className={clsx(
                              'text-[0.9375rem] transition-colors',
                              chosen ? 'text-[var(--accent)]' : 'text-[var(--ink)]',
                            )}
                          >
                            {service.name}
                          </p>
                          <span className="flex-1 translate-y-[-3px] border-b border-dotted border-[var(--line)]" />
                          <span className="tabular shrink-0 text-[0.875rem] text-[var(--ink)]">
                            {formatCents(service.price_cents, org.currency, language)}
                          </span>
                        </div>

                        {/* Duração e descrição na mesma linha. Em linhas
                            separadas, a duração ficava sozinha a meio do
                            branco e o botão flutuava algures ao lado das
                            duas — nada se alinhava com nada.

                            No telemóvel o botão desce: ao lado, sobrava-lhe
                            um terço da largura e a descrição escrevia-se em
                            tiras de três palavras. */}
                        <div className="mt-1.5 flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                          <p className="min-w-0 max-w-md flex-1 text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
                            <span className="tabular">
                              {formatDuration(service.duration_minutes, language)}
                            </span>
                            {service.description ? ` · ${service.description}` : null}
                          </p>

                          {chosen ? (
                            /* Segunda vez no mesmo serviço tira-o: é o que
                               qualquer pessoa espera de uma ementa. */
                            <Link
                              href={funnelHref(here, {
                                cart: removeAt(clean, chosenAt),
                              })}
                              aria-label={`${dict.common.remove} · ${service.name}`}
                              // `sm:pl-3`: em linha, o avanço iguala o `px-3`
                              // do botão com moldura e os ícones das várias
                              // linhas ficam na mesma vertical. Empilhado no
                              // telemóvel, esse avanço era só uma indentação
                              // sem razão.
                              className="group inline-flex h-8 shrink-0 items-center gap-1.5 text-[0.75rem] text-[var(--accent)] transition-colors hover:text-[var(--bad)] sm:pl-3"
                            >
                              <Check size={14} className="group-hover:hidden" />
                              <X size={14} className="hidden group-hover:block" />
                              <span className="group-hover:hidden">
                                {dict.funnel.selected}
                              </span>
                              <span className="hidden group-hover:inline">
                                {dict.common.remove}
                              </span>
                            </Link>
                          ) : full ? null : (
                            <Link
                              href={funnelHref(here, {
                                cart: addLine(clean, service.id),
                              })}
                              // O nome do serviço só existe para quem lê o
                              // ecrã; para quem o ouve, vai no rótulo.
                              aria-label={`${addLabel} · ${service.name}`}
                              className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-[var(--line)] px-3 text-[0.75rem] text-[var(--ink-muted)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]"
                            >
                              <Plus size={14} />
                              {addLabel}
                            </Link>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </Reveal>
          ))}
        </div>

        {/* -------------------------------------------------- visita --- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-[var(--line)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-soft)]">
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
                            href={funnelHref(here, {
                              cart: removeAt(clean, index),
                            })}
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

            {/* Só no ecrã grande. No telemóvel a barra colada ao fundo já
                traz o total e o «continuar»; este botão aparecia-lhe um
                ecrã acima e a mesma decisão ficava pedida duas vezes. */}
            <div className="mt-6 hidden lg:block">
              {clean.length === 0 ? (
                // A mesma altura do botão a sério: quando a visita deixa
                // de estar vazia, o painel não dá um salto.
                <span className="flex h-[3.25rem] cursor-not-allowed items-center justify-center border border-[var(--line)] px-5 text-center text-sm text-[var(--ink-faint)]">
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

          {/* A nota é sobre a etiqueta «sem preferência», que só existe
              depois de haver um serviço escolhido. Com a visita vazia
              ficava a explicar uma coisa que ainda não está no ecrã. */}
          {clean.length > 0 ? (
            <p className="mt-4 text-[0.6875rem] leading-relaxed text-[var(--ink-faint)]">
              {dict.funnel.anyProfessionalHint}
            </p>
          ) : null}
        </aside>
      </div>

      {clean.length > 0 ? (
        <MobileVisitBar
          meta={`${clean.length} ${
            clean.length === 1 ? dict.common.service : dict.common.services
          } · ${formatDuration(totalMinutes, language)}`}
          total={formatCents(totalCents, org.currency, language)}
          href={funnelHref(`${here}/horarios`, { cart: clean })}
          label={dict.common.next}
        />
      ) : null}
    </FunnelShell>
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
