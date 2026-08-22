import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { weeklyHours } from '@/lib/hours'
import { formatMinutes, today, weekdayOf } from '@/lib/time'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import { ButtonLink } from '@/components/ui'
import { Monogram, Ornament, Sprig } from '@/components/brand'
import { Reveal } from '@/components/reveal'
import { UnitStatusBadge } from '@/components/unit-status-badge'
import { formatPhone, sameWord } from '@/lib/text'

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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** A semana começa a segunda; domingo (0) fica para o fim. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default async function StorePage({ params }: Params) {
  const { loja } = await params
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])

  // Loja que não existe e loja a que não se chega dão a mesma resposta.
  if (!unit) notFound()

  const [dict, language, photos, prices, team, week] = await Promise.all([
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
    weeklyHours(unit.id),
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
  const todayWeekday = weekdayOf(today(unit.timezone))
  const weekdayNames = dict.common.weekdaysLong

  return (
    <>
      {/* ------------------------------------------------ cabeçalho ---
          A casa apresenta-se em carvão quente, como na montra e nos
          cartões da lista. Em porcelana esta abertura não tinha âncora
          nenhuma: era um título a flutuar em papel vazio. */}
      <section className="band-dark relative overflow-hidden">
        <Sprig
          size={220}
          className="pointer-events-none absolute -left-12 top-6 rotate-12 scale-x-[-1] text-[var(--accent)] opacity-[0.13]"
        />
        <Sprig
          size={220}
          className="pointer-events-none absolute -right-12 bottom-6 rotate-[-12deg] text-[var(--accent)] opacity-[0.13]"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-3xl">
            {/* A cidade só acrescenta se não for já o nome da casa — senão
                lia-se «NOHORA RAMIREZ · CASCAIS» logo por cima de «Cascais». */}
            <p className="eyebrow eyebrow-gold animate-rise">
              {org.name}
              {unit.city && !sameWord(unit.city, unit.name)
                ? ` · ${unit.city}`
                : ''}
            </p>
            <h1 className="display animate-rise delay-1 mt-5 text-[2.75rem] leading-[1.02] sm:text-6xl">
              {unit.name}
            </h1>
            {address ? (
              <p className="animate-rise delay-2 mt-6 max-w-md text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                {address}
              </p>
            ) : null}
            <div className="animate-rise delay-3 mt-6">
              <UnitStatusBadge unit={unit} dict={dict} language={language} />
            </div>
            <div className="animate-rise delay-4 mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href={`/agendar/${unit.slug}`} size="lg">
                {dict.unit.book}
              </ButtonLink>
              {address ? (
                <a
                  href={directionsUrl(unit.latitude, unit.longitude, address)}
                  target="_blank"
                  rel="noreferrer"
                  className="link-slide px-2 text-[0.875rem] text-[var(--accent)]"
                >
                  {dict.unit.directions}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- fotos --- */}
      {hero ? (
        <section className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mt-12 grid gap-px bg-[var(--line-soft)] sm:grid-cols-3">
            <div className="aspect-[3/2] overflow-hidden bg-[var(--surface-raised)] sm:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.url}
                alt={hero.alt ?? unit.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="hidden grid-rows-2 gap-px sm:grid">
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
        </section>
      ) : null}

      {/* ---------------------- morada · contactos · horário --------- */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal
          group
          className="mt-16 grid gap-12 sm:grid-cols-3"
        >
          <div>
            <p className="eyebrow eyebrow-gold">{dict.unit.address}</p>
            {address ? (
              <>
                <p className="mt-5 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
                  {unit.address_line}
                  <br />
                  {[unit.postal_code, unit.city].filter(Boolean).join(' ')}
                </p>
                <a
                  href={directionsUrl(unit.latitude, unit.longitude, address)}
                  target="_blank"
                  rel="noreferrer"
                  className="link-slide mt-4 inline-block text-[0.8125rem] text-[var(--accent)]"
                >
                  {dict.unit.directions}
                </a>
              </>
            ) : (
              <p className="mt-5 text-[0.9375rem] text-[var(--ink-faint)]">—</p>
            )}
          </div>

          <div>
            <p className="eyebrow eyebrow-gold">{dict.unit.contacts}</p>
            <div className="mt-5 space-y-2.5 text-[0.9375rem] text-[var(--ink-muted)]">
              {unit.phone ? (
                <p>
                  <span className="eyebrow mr-3">{dict.unit.phoneLabel}</span>
                  <a
                    href={`tel:${unit.phone.replace(/\s/g, '')}`}
                    className="tabular transition-colors hover:text-[var(--ink)]"
                  >
                    {formatPhone(unit.phone)}
                  </a>
                </p>
              ) : null}
              {unit.email ? (
                <p className="break-all">
                  <a
                    href={`mailto:${unit.email}`}
                    className="link-slide transition-colors hover:text-[var(--ink)]"
                  >
                    {unit.email}
                  </a>
                </p>
              ) : null}
              {unit.whatsapp_phone ? (
                <p>
                  <a
                    href={`https://wa.me/${unit.whatsapp_phone.replace(/\D/g, '')}?text=${encodeURIComponent(dict.footer.whatsappMessage)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="link-slide text-[0.8125rem] text-[var(--accent)]"
                  >
                    {dict.footer.whatsapp}
                  </a>
                </p>
              ) : null}
              {!unit.phone && !unit.email && !unit.whatsapp_phone ? (
                <p className="text-[var(--ink-faint)]">—</p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="eyebrow eyebrow-gold">{dict.unit.weekHours}</p>
            <dl className="mt-5 text-[0.8125rem]">
              {WEEK_ORDER.map((weekday) => {
                const windows = week.get(weekday) ?? []
                const isToday = weekday === todayWeekday
                return (
                  <div
                    key={weekday}
                    className="flex items-baseline justify-between gap-4 border-b border-dotted border-[var(--line-soft)] py-2 last:border-0"
                  >
                    <dt
                      className={
                        isToday
                          ? 'font-medium text-[var(--accent)]'
                          : 'text-[var(--ink-muted)]'
                      }
                    >
                      {weekdayNames[weekday]}
                      {isToday ? (
                        <span className="eyebrow eyebrow-gold ml-2 text-[0.5625rem]">
                          {dict.funnel.today}
                        </span>
                      ) : null}
                    </dt>
                    <dd
                      className={
                        isToday
                          ? 'tabular text-right text-[var(--accent)]'
                          : 'tabular text-right text-[var(--ink)]'
                      }
                    >
                      {windows.length === 0 ? (
                        <span className="text-[var(--ink-faint)]">
                          {dict.unit.closedNow}
                        </span>
                      ) : (
                        windows
                          .map(
                            (w) =>
                              `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`,
                          )
                          .join(' · ')
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------- preçário --- */}
      {categories.size > 0 ? (
        <section className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mt-20 border-t border-[var(--line-soft)] pt-14">
            <Reveal className="text-center">
              <p className="eyebrow eyebrow-gold">{dict.home.servicesEyebrow}</p>
              <h2 className="display mt-4 text-3xl sm:text-4xl">{dict.unit.priceList}</h2>
              <Ornament className="mt-7" />
            </Reveal>
            <div className="mt-14 grid gap-x-20 gap-y-14 sm:grid-cols-2">
              {[...categories.values()].map((category) => (
                <Reveal key={category.name}>
                  <h3 className="display text-[1.375rem] text-[var(--accent)]">
                    {category.name}
                  </h3>
                  <ul className="mt-6 space-y-5">
                    {category.services.map((service) => (
                      <li key={service.service_id}>
                        <div className="flex items-baseline gap-3">
                          <span className="text-[0.9375rem] text-[var(--ink)]">
                            {service.name}
                          </span>
                          <span className="flex-1 translate-y-[-3px] border-b border-dotted border-[var(--line)]" />
                          <span className="tabular text-[0.75rem] text-[var(--ink-faint)]">
                            {formatDuration(service.duration_minutes, language)}
                          </span>
                          <span className="tabular whitespace-nowrap text-[0.9375rem] text-[var(--ink-muted)]">
                            {formatCents(service.price_cents, org.currency, language)}
                          </span>
                        </div>
                        {service.description ? (
                          <p className="mt-1.5 max-w-md text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
                            {service.description}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------- equipa --- */}
      {team.length > 0 ? (
        <section className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="mt-20 border-t border-[var(--line-soft)] pt-14 text-center">
            <Reveal>
              <p className="eyebrow eyebrow-gold">{dict.home.teamEyebrow}</p>
              <h2 className="display mt-4 text-3xl sm:text-4xl">{dict.unit.team}</h2>
            </Reveal>
            <Reveal
              group
              className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-12"
            >
              {team.map((person) => (
                // A mesma medida da montra: larga o suficiente para a
                // apresentação caber em duas linhas. Ver showcase.tsx.
                <div key={person.id} className="w-40 sm:w-52">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--surface-raised)]">
                    {person.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.avatar_url}
                        alt={person.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Monogram
                        initials={initialsOf(person.name)}
                        className="text-[1.75rem] text-[var(--accent)]"
                      />
                    )}
                  </div>
                  <p className="display mt-5 text-lg">{person.name}</p>
                  {person.bio ? (
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                      {person.bio}
                    </p>
                  ) : null}
                </div>
              ))}
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------- chamada --- */}
      <section className="band-dark mt-24">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 sm:py-28">
          <Reveal>
            <p className="eyebrow eyebrow-gold">{dict.home.finalEyebrow}</p>
            <h2 className="display mt-5 text-balance text-3xl sm:text-5xl">
              {dict.home.finalTitle1}{' '}
              <span className="display-italic text-[var(--accent)]">
                {dict.home.finalTitleItalic}
              </span>
              {dict.home.finalTitle2}
            </h2>
            <div className="mt-9">
              <ButtonLink href={`/agendar/${unit.slug}`} size="lg">
                {dict.unit.book}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
