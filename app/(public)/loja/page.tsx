import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin, Phone } from 'lucide-react'
import { sql } from '@/lib/db'
import { getOrg, listUnits } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { ButtonLink, Empty, Eyebrow } from '@/components/ui'
import { UnitStatusBadge } from '@/components/unit-status-badge'

export const metadata = { title: 'Lojas' }

type Photo = { unit_id: string; url: string; alt: string | null }

export default async function StoresPage() {
  const org = await getOrg()
  if (!org) redirect('/comecar')

  const [dict, language, units] = await Promise.all([
    getDictionary(),
    getLanguage(),
    listUnits(),
  ])

  const photos =
    units.length === 0
      ? []
      : await sql<Photo[]>`
          select distinct on (unit_id) unit_id, url, alt
            from unit_photo
           where unit_id = any(${units.map((u) => u.id)}::uuid[])
           order by unit_id, sort_order, created_at
        `
  const cover = new Map(photos.map((p) => [p.unit_id, p]))

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-24">
      <Eyebrow>{dict.nav.stores}</Eyebrow>
      <h1 className="display mt-4 text-4xl sm:text-5xl">{dict.home.storesTitle}</h1>

      {units.length === 0 ? (
        <Empty title={dict.unit.noStores} hint={dict.unit.noStoresHint} />
      ) : (
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          {units.map((unit) => {
            const photo = cover.get(unit.id)
            return (
              <article key={unit.id} className="group">
                <Link href={`/loja/${unit.slug}`} className="block">
                  <div className="aspect-[3/2] overflow-hidden border border-[var(--line-soft)] bg-[var(--surface-raised)]">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.url}
                        alt={photo.alt ?? unit.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="display text-4xl text-[var(--ink-faint)]">
                          {unit.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="mt-5 flex items-start justify-between gap-4">
                  <h2 className="display text-2xl">
                    <Link
                      href={`/loja/${unit.slug}`}
                      className="transition-colors hover:text-[var(--accent)]"
                    >
                      {unit.name}
                    </Link>
                  </h2>
                  <UnitStatusBadge unit={unit} dict={dict} language={language} />
                </div>

                <div className="mt-3 space-y-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
                  {unit.address_line ? (
                    <p className="flex items-start gap-2">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span>
                        {unit.address_line}
                        {unit.city ? `, ${unit.city}` : ''}
                      </span>
                    </p>
                  ) : null}
                  {unit.phone ? (
                    <p className="flex items-center gap-2">
                      <Phone size={14} className="shrink-0" />
                      <span className="tabular">{unit.phone}</span>
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <ButtonLink href={`/agendar/${unit.slug}`} size="sm">
                    {dict.unit.book}
                  </ButtonLink>
                  <ButtonLink href={`/loja/${unit.slug}`} size="sm" variant="quiet">
                    {dict.unit.priceList}
                  </ButtonLink>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
