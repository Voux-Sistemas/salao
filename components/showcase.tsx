import { sql } from '@/lib/db'
import { listUnits, type Org, type Unit } from '@/lib/org'
import { openingWindows, type Window } from '@/lib/hours'
import { formatDuration, formatMinutes, today } from '@/lib/time'
import { getDictionary, getLanguage, type Dictionary } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { formatCents } from '@/lib/money'
import { formatPhone } from '@/lib/text'
import { ButtonLink } from '@/components/ui'
import { LogoMark, Monogram, Ornament } from '@/components/brand'
import { Reveal } from '@/components/reveal'
import { PriceLine } from '@/components/price-list'
import { CollapseGroup } from '@/components/collapse-group'
import { UnitStatusBadge } from '@/components/unit-status-badge'

/**
 * A montra: o primeiro (e às vezes único) contacto de uma cliente com a
 * casa. Tom de hotel boutique — muito ar, serifas grandes, ouro em fio.
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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function mapsUrl(unit: Unit) {
  const address = [unit.address_line, unit.postal_code, unit.city]
    .filter(Boolean)
    .join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(address || unit.name)}`
}

/** Uma linha da ficha da casa: rótulo à esquerda, valor à direita. */
function HouseRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="eyebrow shrink-0">{label}</dt>
      <dd className="text-right text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
        {children}
      </dd>
    </div>
  )
}

function HouseCard({
  unit,
  todayWindows,
  dict,
  language,
}: {
  unit: Unit
  todayWindows: Window[]
  dict: Dictionary
  language: Language
}) {
  return (
    <article className="lift flex h-full flex-col border border-[var(--line-soft)] bg-[var(--surface-raised)] p-8 shadow-[var(--shadow-soft)] sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-gold">{unit.city ?? ''}</p>
          <h3 className="display mt-2 text-[1.75rem] leading-tight">{unit.name}</h3>
        </div>
        <UnitStatusBadge unit={unit} dict={dict} language={language} />
      </div>

      <dl className="mt-7 flex-1 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
        {unit.address_line ? (
          <HouseRow label={dict.unit.address}>
            {unit.address_line}
            {unit.city ? `, ${unit.city}` : ''}
            <br />
            <a
              href={mapsUrl(unit)}
              target="_blank"
              rel="noreferrer"
              className="link-slide text-[0.8125rem] text-[var(--accent)]"
            >
              {dict.unit.directions}
            </a>
          </HouseRow>
        ) : null}
        {unit.phone ? (
          <HouseRow label={dict.unit.phoneLabel}>
            <a
              href={`tel:${unit.phone.replace(/\s/g, '')}`}
              className="tabular transition-colors hover:text-[var(--ink)]"
            >
              {formatPhone(unit.phone)}
            </a>
          </HouseRow>
        ) : null}
        <HouseRow label={dict.funnel.today}>
          {todayWindows.length === 0 ? (
            <span className="text-[var(--ink-faint)]">{dict.unit.closedToday}</span>
          ) : (
            <span className="tabular">
              {todayWindows
                .map((w) => `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`)
                .join(' · ')}
            </span>
          )}
        </HouseRow>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href={`/agendar/${unit.slug}`}>{dict.home.houseBook}</ButtonLink>
        <ButtonLink href={`/loja/${unit.slug}`} variant="outline">
          {dict.home.houseVisit}
        </ButtonLink>
      </div>
    </article>
  )
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
    // Alcunha, nunca o nome verdadeiro: a montra é a primeira coisa que
    // um estranho vê. Ordenar pelo nome real entregava-o na mesma.
    sql<TeamRow[]>`
      select distinct s.id, coalesce(s.public_alias, s.name) as name,
             s.bio, s.avatar_url, s.sort_order
        from staff s
       where s.org_id = ${org.id} and s.is_active
         and (s.accepts_online_booking
              or exists (select 1 from staff_role r
                          where r.staff_id = s.id and r.role = 'professional'))
       order by s.sort_order, coalesce(s.public_alias, s.name)
    `,
  ])

  const houses = await Promise.all(
    units.map(async (unit) => ({
      unit,
      todayWindows: await openingWindows(unit.id, today(unit.timezone)),
    })),
  )

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
      {/* ---------------------------------------------------- herói --- */}
      <section className="band-dark relative overflow-hidden">
        {/* respiração dourada atrás do logótipo */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(closest-side, color-mix(in srgb, var(--gold) 13%, transparent), transparent)',
          }}
        />
        <div className="relative mx-auto flex min-h-[92svh] max-w-5xl flex-col items-center justify-center px-5 pb-24 pt-28 text-center sm:px-8">
          <LogoMark size="xl" className="animate-bloom" />
          <p className="eyebrow eyebrow-gold animate-rise delay-2 mt-10">
            {dict.home.heroEyebrow}
          </p>
          <h1 className="display-hero animate-rise delay-3 mt-6 max-w-4xl text-balance">
            {dict.home.heroTitle1}{' '}
            <span className="display-italic text-[var(--accent)]">
              {dict.home.heroTitleItalic}
            </span>
            {dict.home.heroTitle2}
          </h1>
          <p className="animate-rise delay-4 mt-8 max-w-md text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
            {dict.home.subtitle}
          </p>
          <div className="animate-rise delay-5 mt-11 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/agendar" size="lg">
              {dict.home.cta}
            </ButtonLink>
            <ButtonLink href="#casas" size="lg" variant="outline">
              {dict.home.ctaSecondary}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ manifesto --- */}
      <section className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8 sm:py-32">
        <Reveal>
          <Ornament />
          <p className="eyebrow mt-10">{dict.home.manifestoEyebrow}</p>
        </Reveal>
        <Reveal delay={120}>
          <p className="display mt-6 text-balance text-2xl leading-[1.4] sm:text-[2rem]">
            {dict.home.manifesto}
          </p>
        </Reveal>
      </section>

      {/* ----------------------------------------------- as casas ----- */}
      <section id="casas" className="scroll-mt-20 border-t border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <p className="eyebrow eyebrow-gold">{dict.home.housesEyebrow}</p>
            <h2 className="display mt-4 text-3xl sm:text-4xl">{dict.home.housesTitle}</h2>
            <span className="grow-rule mt-6" />
          </Reveal>
          <Reveal group className="mt-12 grid gap-6 lg:grid-cols-2">
            {houses.map(({ unit, todayWindows }) => (
              <HouseCard
                key={unit.id}
                unit={unit}
                todayWindows={todayWindows}
                dict={dict}
                language={language}
              />
            ))}
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------- o menu ----- */}
      {categories.size > 0 ? (
        <section className="border-t border-[var(--line-soft)]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <Reveal className="text-center">
              <p className="eyebrow eyebrow-gold">{dict.home.servicesEyebrow}</p>
              <h2 className="display mt-4 text-3xl sm:text-4xl">
                {dict.home.servicesTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[0.8125rem] text-[var(--ink-faint)]">
                {dict.home.servicesSubtitle}
              </p>
              <Ornament className="mt-8" />
            </Reveal>

            <div className="mt-12 grid gap-x-20 gap-y-10 sm:mt-16 sm:grid-cols-2 sm:gap-y-16">
              {[...categories.values()].map((category) => (
                <CollapseGroup
                  key={category.name}
                  title={category.name}
                  count={category.services.length}
                >
                  {category.services.map((service) => (
                    <PriceLine
                      key={service.service_id}
                      name={service.name}
                      duration={formatDuration(service.duration_minutes, language)}
                      price={formatCents(service.base_price_cents, org.currency, language)}
                      from={dict.common.from}
                    />
                  ))}
                </CollapseGroup>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------- a equipa --- */}
      {team.length > 0 ? (
        <section className="border-t border-[var(--line-soft)]">
          <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 sm:py-28">
            <Reveal>
              <p className="eyebrow eyebrow-gold">{dict.home.teamEyebrow}</p>
              <h2 className="display mt-4 text-3xl sm:text-4xl">{dict.home.teamTitle}</h2>
            </Reveal>
            <Reveal
              group
              className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-14"
            >
              {team.map((person) => (
                // A 11rem a apresentação partia-se em quatro tiras estreitas
                // e lia-se como uma legenda avariada. A 13rem cabe em duas
                // linhas — e quatro pessoas, com o intervalo, ainda entram
                // de uma vez nos 60rem da secção.
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

      {/* ------------------------------------------ chamada final ----- */}
      <section className="band-dark">
        <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8 sm:py-32">
          <Reveal>
            <p className="eyebrow eyebrow-gold">{dict.home.finalEyebrow}</p>
            <h2 className="display mt-5 text-balance text-4xl sm:text-5xl">
              {dict.home.finalTitle1}{' '}
              <span className="display-italic text-[var(--accent)]">
                {dict.home.finalTitleItalic}
              </span>
              {dict.home.finalTitle2}
            </h2>
            <p className="mt-6 text-[0.9375rem] text-[var(--ink-muted)]">
              {dict.home.finalSubtitle}
            </p>
            <div className="mt-10">
              <ButtonLink href="/agendar" size="lg">
                {dict.home.cta}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
