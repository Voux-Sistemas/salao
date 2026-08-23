import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { sql } from '@/lib/db'
import { getOrg, listUnits, type Unit } from '@/lib/org'
import { openingWindows, type Window } from '@/lib/hours'
import { formatMinutes, today } from '@/lib/time'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { ButtonLink, Empty, Eyebrow } from '@/components/ui'
import { Ornament, Sprig } from '@/components/brand'
import { Reveal } from '@/components/reveal'
import { UnitStatusBadge } from '@/components/unit-status-badge'
import { formatPhone, sameWord } from '@/lib/text'

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return { title: dict.tabs.stores }
}

type Photo = { unit_id: string; url: string; alt: string | null }

function mapsUrl(unit: Unit) {
  const address = [unit.address_line, unit.postal_code, unit.city]
    .filter(Boolean)
    .join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(address || unit.name)}`
}

export default async function StoresPage() {
  const org = await getOrg()
  if (!org) redirect('/comecar')

  const [dict, language, units] = await Promise.all([
    getDictionary(),
    getLanguage(),
    listUnits(),
  ])

  const [photos, windows] = await Promise.all([
    units.length === 0
      ? Promise.resolve<Photo[]>([])
      : sql<Photo[]>`
          select distinct on (unit_id) unit_id, url, alt
            from unit_photo
           where unit_id = any(${units.map((u) => u.id)}::uuid[])
           order by unit_id, sort_order, created_at
        `,
    Promise.all(
      units.map(
        async (unit) =>
          [unit.id, await openingWindows(unit.id, today(unit.timezone))] as [
            string,
            Window[],
          ],
      ),
    ),
  ])
  const cover = new Map(photos.map((p) => [p.unit_id, p]))
  const todayByUnit = new Map(windows)

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <div className="max-w-2xl">
        <Eyebrow className="eyebrow-gold animate-rise">{dict.home.housesEyebrow}</Eyebrow>
        <h1 className="display animate-rise delay-1 mt-4 text-4xl sm:text-5xl">
          {dict.home.housesTitle}
        </h1>
        <p className="animate-rise delay-2 mt-5 max-w-md text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
          {dict.unit.listLead}
        </p>
      </div>

      {units.length === 0 ? (
        <Empty title={dict.unit.noStores} hint={dict.unit.noStoresHint} />
      ) : (
        <Reveal group className="mt-14 grid gap-8 lg:grid-cols-2">
          {units.map((unit) => {
            const photo = cover.get(unit.id)
            const todayWindows = todayByUnit.get(unit.id) ?? []
            return (
              <article
                key={unit.id}
                className="lift flex h-full flex-col border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]"
              >
                <Link href={`/loja/${unit.slug}`} className="block">
                  {photo ? (
                    <div className="aspect-[5/2] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.alt ?? unit.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="band-dark relative flex aspect-[5/2] items-center justify-center overflow-hidden">
                      <Sprig
                        size={120}
                        className="absolute -left-4 top-6 rotate-12 scale-x-[-1] text-[var(--accent)] opacity-25"
                      />
                      <span className="display-italic text-5xl text-[var(--accent)]">
                        {unit.name}
                      </span>
                      <Sprig
                        size={120}
                        className="absolute -right-4 bottom-6 rotate-[-12deg] text-[var(--accent)] opacity-25"
                      />
                    </div>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-6 sm:p-10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      {/* A cidade só entra se disser algo que o nome não diga:
                          a casa de Cascais chama-se Cascais e fica em Cascais,
                          e o cartão lia «CASCAIS / Cascais» por baixo da faixa
                          que já traz «Cascais» escrito à mão. */}
                      {sameWord(unit.city, unit.name) ? null : (
                        <p className="eyebrow eyebrow-gold mb-2">{unit.city}</p>
                      )}
                      <h2 className="display text-[1.75rem] leading-tight">
                        <Link
                          href={`/loja/${unit.slug}`}
                          className="transition-colors hover:text-[var(--accent)]"
                        >
                          {unit.name}
                        </Link>
                      </h2>
                    </div>
                    <UnitStatusBadge unit={unit} dict={dict} language={language} />
                  </div>

                  <dl className="mt-6 flex-1 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)] text-[0.875rem]">
                    {unit.address_line ? (
                      <div className="flex items-baseline justify-between gap-6 py-3">
                        <dt className="eyebrow shrink-0">{dict.unit.address}</dt>
                        <dd className="text-right leading-relaxed text-[var(--ink-muted)]">
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
                        </dd>
                      </div>
                    ) : null}
                    {unit.phone ? (
                      <div className="flex items-baseline justify-between gap-6 py-3">
                        <dt className="eyebrow shrink-0">{dict.unit.phoneLabel}</dt>
                        <dd className="text-right text-[var(--ink-muted)]">
                          <a
                            href={`tel:${unit.phone.replace(/\s/g, '')}`}
                            className="tabular transition-colors hover:text-[var(--ink)]"
                          >
                            {formatPhone(unit.phone)}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex items-baseline justify-between gap-6 py-3">
                      <dt className="eyebrow shrink-0">{dict.funnel.today}</dt>
                      <dd className="text-right text-[var(--ink-muted)]">
                        {todayWindows.length === 0 ? (
                          <span className="text-[var(--ink-faint)]">
                            {dict.unit.closedToday}
                          </span>
                        ) : (
                          <span className="tabular">
                            {todayWindows
                              .map(
                                (w) =>
                                  `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`,
                              )
                              .join(' · ')}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {/* No telemóvel os dois botões ficavam encavalitados e de
                      larguras diferentes, encostados à esquerda do cartão.
                      Empilhados a toda a largura leem-se como o que são: a
                      escolha que fecha o cartão. */}
                  <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                    <ButtonLink
                      href={`/agendar/${unit.slug}`}
                      className="w-full sm:w-auto"
                    >
                      {dict.home.houseBook}
                    </ButtonLink>
                    <ButtonLink
                      href={`/loja/${unit.slug}`}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      {dict.home.houseVisit}
                    </ButtonLink>
                  </div>
                </div>
              </article>
            )
          })}
        </Reveal>
      )}

      <div className="mt-20 text-center">
        <Ornament />
      </div>
    </div>
  )
}
