import type { Metadata } from 'next'
import { sql } from '@/lib/db'
import { getOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { env } from '@/lib/env'
import { ButtonLink } from '@/components/ui'
import { CollapseGroup } from '@/components/collapse-group'
import { Reveal } from '@/components/reveal'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const [org, dict] = await Promise.all([getOrg(), getDictionary()])
  const name = org?.name ?? 'Nohora Ramirez'
  return {
    title: dict.nav.services,
    description: dict.footer.tagline,
    alternates: { canonical: `${env.siteUrl}/servicos` },
    openGraph: {
      title: `${dict.nav.services} · ${name}`,
      description: dict.footer.tagline,
      url: `${env.siteUrl}/servicos`,
    },
  }
}

type Row = {
  category_id: string
  category_name: string
  service_id: string
  name: string
  description: string | null
}

/**
 * O PREÇÁRIO, COM PORTA PRÓPRIA.
 *
 * Estava numa aba a meio da montra, a disputar espaço com as lojas —
 * como se «onde ficam» e «o que fazem» fossem duas vistas da mesma
 * coisa. Não são: uma cliente precisa das duas para marcar, e a que
 * estava escondida era justamente a que se procura no Google.
 *
 * Aqui tem endereço, tem título e entra nos motores de busca. A montra
 * passa a mostrar só as famílias, e manda para cá quem quiser a lista.
 *
 * SEM PREÇOS, de propósito — foi a casa que o decidiu. Uma ementa sem
 * valores deixa uma pergunta no ar, e a resposta é a marcação: é lá que
 * o preço aparece, já com a loja e a profissional escolhidas.
 */
export default async function ServicosPage() {
  const [org, dict, language] = await Promise.all([
    getOrg(),
    getDictionary(),
    getLanguage(),
  ])

  const rows = org
    ? await sql<Row[]>`
        select c.id as category_id,
               name_in(${language}, c.name, c.name_en, c.name_es) as category_name,
               s.id as service_id,
               name_in(${language}, s.name, s.name_en, s.name_es) as name,
               name_in(${language}, s.description,
                       s.description_en, s.description_es) as description
          from service s
          join service_category c on c.id = s.category_id and c.is_active
         where s.org_id = ${org.id} and s.is_active and s.bookable_online
         -- Ordenar pelo nome português mantém a mesma ordem nas três
         -- línguas, que é o que a casa reconhece ao telefone.
         order by c.sort_order, c.name, s.sort_order, s.name
      `
    : []

  const families = new Map<string, { name: string; services: Row[] }>()
  for (const row of rows) {
    let family = families.get(row.category_id)
    if (!family) {
      family = { name: row.category_name, services: [] }
      families.set(row.category_id, family)
    }
    family.services.push(row)
  }

  const total = rows.length

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
      <Reveal>
        <p className="eyebrow eyebrow-gold">{dict.nav.services}</p>
        <h1 className="display mt-4 text-[2rem] leading-tight text-[var(--ink)] sm:text-[2.5rem]">
          {dict.home.servicesTitle}
        </h1>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
          {dict.home.servicesSubtitle}
        </p>
      </Reveal>

      {total === 0 ? null : (
        <>
          <div className="mt-12 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
            {[...families.values()].map((family) => (
              <CollapseGroup
                key={family.name}
                title={family.name}
                count={family.services.length}
              >
                {family.services.map((service) => (
                  <li key={service.service_id} className="mt-3.5 first:mt-0">
                    <p className="text-[0.9375rem] leading-snug text-[var(--ink)]">
                      {service.name}
                    </p>
                    {service.description ? (
                      <p className="mt-1 max-w-sm text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
                        {service.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </CollapseGroup>
            ))}
          </div>

          {/* A pergunta que uma lista sem preços deixa no ar responde-se
              aqui, e não noutra página. */}
          <div className="mt-14 text-center">
            <ButtonLink href="/agendar" size="lg">
              {dict.home.cta}
            </ButtonLink>
          </div>
        </>
      )}
    </div>
  )
}
