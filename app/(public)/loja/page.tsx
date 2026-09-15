import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { sql } from '@/lib/db'
import { getOrg, listUnits } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { Empty } from '@/components/ui'
import { Reveal } from '@/components/reveal'
import { HouseCard } from '@/components/house-card'

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return { title: dict.tabs.stores }
}

type Photo = { unit_id: string; url: string; alt: string | null }

/*
 * AS NOSSAS CASAS — os mesmos cartões da capa.
 *
 * Esta página tinha o seu próprio cartão: claro, de cantos vivos, com
 * uma etiqueta quadrada e três linhas de ficha (morada, telefone, hoje).
 * Quem vinha da capa, onde as casas já estão em café com luz, chegava
 * aqui e via outras casas. Agora é o mesmo cartão e o mesmo título
 * centrado; o que esta página acrescenta à capa é só não ter mais nada
 * à volta.
 */
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
    <div className="mx-auto max-w-6xl px-3.5 pt-8 pb-10 sm:px-8 sm:pt-16 sm:pb-20">
      <Reveal className="mb-6 text-center sm:mb-10">
        <h1 className="display text-balance text-[1.625rem] leading-tight text-[var(--ink)] sm:text-[2.5rem]">
          {dict.home.housesHeading}
        </h1>
        <p className="mx-auto mt-1.5 max-w-md text-[0.8125rem] leading-relaxed text-[var(--ink-muted)] sm:mt-3 sm:text-[0.9375rem]">
          {dict.unit.listLead}
        </p>
      </Reveal>

      {units.length === 0 ? (
        <Empty title={dict.unit.noStores} hint={dict.unit.noStoresHint} />
      ) : (
        <Reveal group className="grid gap-3.5 sm:gap-6 lg:mx-auto lg:max-w-[62.5rem] lg:grid-cols-2">
          {units.map((unit) => (
            <HouseCard
              key={unit.id}
              unit={unit}
              cover={cover.get(unit.id) ?? null}
              dict={dict}
              language={language}
            />
          ))}
        </Reveal>
      )}
    </div>
  )
}
