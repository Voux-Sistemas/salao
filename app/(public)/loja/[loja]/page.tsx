import { notFound } from 'next/navigation'
import { Mail, MapPin, Phone } from 'lucide-react'
import { sql } from '@/lib/db'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import { ButtonLink, Eyebrow } from '@/components/ui'
import { UnitStatusBadge } from '@/components/unit-status-badge'
import { HoursTable } from '@/components/hours-table'

type Params = { params: Promise<{ loja: string }> }

type Photo = { id: string; url: string; alt: string | null }

type PriceRow = {
  category_id: string
  category_name: string
  service_id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
}

type TeamRow = {
  id: string
  name: string
  bio: string | null
  avatar_url: string | null
}

export async function generateMetadata({ params }: Params) {
  const { loja } = await params
  const unit = await getUnitBySlug(loja)
  return { title: unit?.name ?? 'Loja' }
}

/** Um endereço que se possa abrir no telemóvel e seguir a pé. */
function directionsUrl(
  latitude: string | null,
  longitude: string | null,
  address: string,
) {
  const query = latitude && longitude ? `${latitude},${longitude}` : address
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export default async function StorePage({ params }: Params) {
  const { loja } = await params
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])

  // Loja que não existe e loja a que não se chega dão a mesma resposta.
  if (!unit) notFound()

  const [dict, language, photos, prices, team] = await Promise.all([
    getDictionary(),
    getLanguage(),
    sql<Photo[]>`
      select id, url, alt
        from unit_photo
       where unit_id = ${unit.id}
       order by sort_order, created_at
    `,
    sql<PriceRow[]>`
      select c.id as category_id, c.name as category_name,
             s.id as service_id, s.name, s.description,
             p.duration_minutes, p.price_cents
        from service s
        join service_category c on c.id = s.category_id and c.is_active
        cross join lateral effective_service_pricing(s.id, ${unit.id}::uuid, null::uuid) p
       where s.org_id = ${org.id} and s.is_active and s.bookable_online
       order by c.sort_order, c.name, s.sort_order, s.name
    `,
    sql<TeamRow[]>`
      select st.id, st.name, st.bio, st.avatar_url
        from staff st
        join staff_unit su on su.staff_id = st.id and su.unit_id = ${unit.id}
       where st.org_id = ${org.id}
         and st.is_active
         and st.accepts_online_booking
       order by st.sort_order, st.name
    `,
  ])

  const categories = new Map<string, { name: string; services: PriceRow[] }>()
  for (const row of prices) {
    const entry = categories.get(row.category_id) ?? {
      name: row.category_name,
      services: [],
    }
    entry.services.push(row)
    categories.set(row.category_id, entry)
  }

  const addressParts = [
    unit.address_line,
    [unit.postal_code, unit.city].filter(Boolean).join(' '),
  ].filter((part): part is string => Boolean(part))
  const address = addressParts.join(', ')

  const [hero, ...rest] = photos

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 py-14 sm:py-20">
      {/* ------------------------------------------------ cabeçalho --- */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>{org.name}</Eyebrow>
          <h1 className="display mt-4 text-4xl sm:text-5xl">{unit.name}</h1>
          <div className="mt-5">
            <UnitStatusBadge unit={unit} dict={dict} language={language} />
          </div>
        </div>
        <ButtonLink href={`/agendar/${unit.slug}`} size="lg">
          {dict.unit.book}
        </ButtonLink>
      </header>

      {/* ---------------------------------------------------- fotos --- */}
      {hero ? (
        <div className="mt-10 grid gap-px bg-[var(--line-soft)] sm:grid-cols-3">
          <div className="sm:col-span-2 aspect-[3/2] overflow-hidden bg-[var(--surface-raised)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero.url}
              alt={hero.alt ?? unit.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="hidden sm:grid grid-rows-2 gap-px">
            {rest.slice(0, 2).map((photo) => (
              <div key={photo.id} className="overflow-hidden bg-[var(--surface-raised)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.alt ?? unit.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ------------------------- morada · contactos · horário --- */}
      <section className="mt-14 grid gap-10 sm:grid-cols-3 border-t border-[var(--line-soft)] pt-10">
        <div>
          <Eyebrow>{dict.unit.address}</Eyebrow>
          {address ? (
            <>
              <p className="mt-4 flex items-start gap-2 text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span>{address}</span>
              </p>
              <a
                href={directionsUrl(unit.latitude, unit.longitude, address)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-[0.8125rem] text-[var(--accent)] hover:underline underline-offset-4"
              >
                {dict.unit.directions} →
              </a>
            </>
          ) : (
            <p className="mt-4 text-[0.875rem] text-[var(--ink-faint)]">—</p>
          )}
        </div>

        <div>
          <Eyebrow>{dict.unit.contacts}</Eyebrow>
          <div className="mt-4 space-y-2 text-[0.875rem] text-[var(--ink-muted)]">
            {unit.phone ? (
              <p className="flex items-center gap-2">
                <Phone size={15} className="shrink-0" />
                <a
                  href={`tel:${unit.phone.replace(/\s/g, '')}`}
                  className="tabular hover:text-[var(--ink)]"
                >
                  {unit.phone}
                </a>
              </p>
            ) : null}
            {unit.email ? (
              <p className="flex items-center gap-2">
                <Mail size={15} className="shrink-0" />
                <a href={`mailto:${unit.email}`} className="hover:text-[var(--ink)] break-all">
                  {unit.email}
                </a>
              </p>
            ) : null}
            {!unit.phone && !unit.email ? (
              <p className="text-[var(--ink-faint)]">—</p>
            ) : null}
          </div>
        </div>

        <div>
          <Eyebrow>{dict.unit.hours}</Eyebrow>
          <div className="mt-3">
            <HoursTable
              unitId={unit.id}
              language={language}
              closedLabel={dict.unit.closedNow}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- preçário --- */}
      {categories.size > 0 ? (
        <section className="mt-16 border-t border-[var(--line-soft)] pt-10">
          <Eyebrow>{dict.unit.priceList}</Eyebrow>
          <div className="mt-8 grid gap-x-14 gap-y-12 sm:grid-cols-2">
            {[...categories.values()].map((category) => (
              <div key={category.name}>
                <h2 className="display text-xl text-[var(--accent)]">{category.name}</h2>
                <ul className="mt-5 space-y-3.5">
                  {category.services.map((service) => (
                    <li
                      key={service.service_id}
                      className="border-b border-[var(--line-soft)] pb-3.5"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="text-sm text-[var(--ink)]">{service.name}</span>
                        <span className="flex-1 translate-y-[-3px] border-b border-dotted border-[var(--line-soft)]" />
                        <span className="tabular text-[0.75rem] text-[var(--ink-faint)]">
                          {formatDuration(service.duration_minutes, language)}
                        </span>
                        <span className="tabular whitespace-nowrap text-sm text-[var(--ink-muted)]">
                          {formatCents(service.price_cents, org.currency, language)}
                        </span>
                      </div>
                      {service.description ? (
                        <p className="mt-1 max-w-md text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
                          {service.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------- equipa --- */}
      {team.length > 0 ? (
        <section className="mt-16 border-t border-[var(--line-soft)] pt-10">
          <Eyebrow>{dict.unit.team}</Eyebrow>
          <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {team.map((person) => (
              <div key={person.id}>
                <div className="aspect-[4/5] overflow-hidden border border-[var(--line-soft)] bg-[var(--surface-raised)]">
                  {person.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.avatar_url}
                      alt={person.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
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
        </section>
      ) : null}

      {/* -------------------------------------------------- chamada --- */}
      <section className="mt-16 border-t border-[var(--line-soft)] pt-16 text-center">
        <h2 className="display text-3xl">{dict.home.cta}</h2>
        <div className="mt-8">
          <ButtonLink href={`/agendar/${unit.slug}`} size="lg">
            {dict.unit.book}
          </ButtonLink>
        </div>
      </section>
    </div>
  )
}
