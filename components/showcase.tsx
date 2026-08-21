import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { sql } from '@/lib/db'
import { listUnits, type Org } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import { ButtonLink, Eyebrow } from '@/components/ui'
import { UnitStatusBadge } from '@/components/unit-status-badge'

/**
 * A montra. A raiz `/` é duas coisas: isto para quem não tem sessão, e o
 * painel do dia para quem tem.
 *
 * O botão principal em qualquer destas telas é MARCAR.
 */

type CatalogRow = {
  category_id: string
  category_name: string
  service_id: string
  name: string
  description: string | null
  duration_minutes: number
  base_price_cents: number
}

type TeamRow = {
  id: string
  name: string
  bio: string | null
  avatar_url: string | null
}

export async function Showcase({ org }: { org: Org }) {
  const [dict, language, units, catalog, team] = await Promise.all([
    getDictionary(),
    getLanguage(),
    listUnits(),
    sql<CatalogRow[]>`
      select c.id as category_id, c.name as category_name,
             s.id as service_id, s.name, s.description,
             s.duration_minutes, s.base_price_cents
        from service s
        join service_category c on c.id = s.category_id and c.is_active
       where s.org_id = ${org.id} and s.is_active and s.bookable_online
       order by c.sort_order, c.name, s.sort_order, s.name
    `,
    sql<TeamRow[]>`
      select id, name, bio, avatar_url
        from staff
       where org_id = ${org.id} and is_active and accepts_online_booking
       order by sort_order, name
    `,
  ])

  const categories = new Map<string, { name: string; services: CatalogRow[] }>()
  for (const row of catalog) {
    const entry = categories.get(row.category_id) ?? {
      name: row.category_name,
      services: [],
    }
    entry.services.push(row)
    categories.set(row.category_id, entry)
  }

  return (
    <>
      {/* -------------------------------------------------- herói --- */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-20 pb-24 sm:pt-32 sm:pb-32">
        <Eyebrow>{dict.home.eyebrow}</Eyebrow>
        <h1 className="display mt-5 text-[2.75rem] leading-[1.05] sm:text-[4.5rem] sm:leading-[0.98] max-w-3xl">
          {dict.home.title.split('\n').map((line, index) => (
            <span key={index} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-7 max-w-md text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
          {dict.home.subtitle}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <ButtonLink href="/agendar" size="lg">
            {dict.home.cta}
          </ButtonLink>
          <ButtonLink href="/loja" size="lg" variant="outline">
            {dict.home.ctaSecondary}
          </ButtonLink>
        </div>
      </section>

      {/* -------------------------------------------------- lojas --- */}
      {units.length > 0 ? (
        <section className="border-t border-[var(--line-soft)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-20">
            <Eyebrow>{dict.home.storesTitle}</Eyebrow>
            <div className="mt-8 grid gap-px bg-[var(--line-soft)] sm:grid-cols-2">
              {units.map((unit) => (
                <Link
                  key={unit.id}
                  href={`/loja/${unit.slug}`}
                  className="group bg-[var(--surface)] p-7 sm:p-9 transition-colors hover:bg-[var(--surface-raised)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="display text-2xl group-hover:text-[var(--accent)] transition-colors">
                      {unit.name}
                    </h3>
                    <UnitStatusBadge unit={unit} dict={dict} language={language} />
                  </div>
                  {unit.address_line ? (
                    <p className="mt-4 flex items-start gap-2 text-[0.8125rem] text-[var(--ink-muted)]">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span>
                        {unit.address_line}
                        {unit.city ? `, ${unit.city}` : ''}
                      </span>
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------- serviços --- */}
      {categories.size > 0 ? (
        <section className="border-t border-[var(--line-soft)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-20">
            <Eyebrow>{dict.home.servicesTitle}</Eyebrow>
            <p className="mt-3 text-[0.8125rem] text-[var(--ink-faint)] max-w-md">
              {dict.home.servicesSubtitle}
            </p>

            <div className="mt-12 grid gap-x-14 gap-y-14 sm:grid-cols-2">
              {[...categories.values()].map((category) => (
                <div key={category.name}>
                  <h3 className="display text-xl text-[var(--accent)]">
                    {category.name}
                  </h3>
                  <ul className="mt-5 space-y-3.5">
                    {category.services.map((service) => (
                      <li
                        key={service.service_id}
                        className="flex items-baseline gap-3 border-b border-[var(--line-soft)] pb-3.5"
                      >
                        <span className="text-sm text-[var(--ink)]">
                          {service.name}
                        </span>
                        <span className="flex-1 border-b border-dotted border-[var(--line-soft)] translate-y-[-3px]" />
                        <span className="tabular text-[0.75rem] text-[var(--ink-faint)]">
                          {formatDuration(service.duration_minutes, language)}
                        </span>
                        <span className="tabular text-sm text-[var(--ink-muted)] whitespace-nowrap">
                          {dict.common.from}{' '}
                          {formatCents(service.base_price_cents, org.currency, language)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------- equipa --- */}
      {team.length > 0 ? (
        <section className="border-t border-[var(--line-soft)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-20">
            <Eyebrow>{dict.home.teamTitle}</Eyebrow>
            <div className="mt-8 grid gap-8 grid-cols-2 sm:grid-cols-4">
              {team.map((person) => (
                <div key={person.id}>
                  <div className="aspect-[4/5] bg-[var(--surface-raised)] border border-[var(--line-soft)] overflow-hidden">
                    {person.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.avatar_url}
                        alt={person.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <span className="display text-3xl text-[var(--ink-faint)]">
                          {person.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-[var(--ink)]">{person.name}</p>
                  {person.bio ? (
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
                      {person.bio}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------- chamada ----- */}
      <section className="border-t border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-20 text-center">
          <h2 className="display text-3xl sm:text-4xl">{dict.home.cta}</h2>
          <div className="mt-8">
            <ButtonLink href="/agendar" size="lg">
              {dict.nav.book}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}
