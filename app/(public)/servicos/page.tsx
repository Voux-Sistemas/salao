import type { Metadata } from 'next'
import { sql } from '@/lib/db'
import { getOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { env } from '@/lib/env'
import { Reveal } from '@/components/reveal'
import { Photo } from '@/components/photo'
import { FAMILY_PHOTOS } from '@/components/family-discs'
import { ServiceFamily } from '@/components/service-family'

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
  category_slug: string
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
 *
 * E SEM BOTÃO DE MARCAR NO FIM: o rodapé, logo por baixo, abre com
 * «Reserve o seu momento» e o seu «Marcar agora». Eram dois convites
 * iguais, um em cima do outro.
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
               c.slug as category_slug,
               name_in(${language}, c.name, c.name_en, c.name_es) as category_name,
               s.id as service_id,
               name_in(${language}, s.name, s.name_en, s.name_es) as name,
               name_in(${language}, s.description,
                       s.description_en, s.description_es) as description
          from service s
          join service_category c on c.id = s.category_id and c.is_active
         where s.org_id = ${org.id} and s.is_active and s.bookable_online
         /*
          * E QUE ALGUÉM SAIBA FAZER.
          *
          * A montra é uma promessa: o que está aqui, a casa faz. Um
          * serviço sem ninguém com a habilidade levava a cliente ao
          * funil para lhe dizer, três ecrãs depois, que não havia
          * horas — em nenhum dia, para sempre. Aqui a pergunta é da
          * organização inteira, não de uma loja: basta que alguém o
          * faça nalguma casa para valer a pena mostrá-lo.
          */
         and exists (
           select 1
             from staff_skill ss
             join staff st on st.id = ss.staff_id
            where ss.service_id = s.id
              and st.is_active
              and st.accepts_online_booking
              and st.org_id = ${org.id}
         )
         -- Ordenar pelo nome português mantém a mesma ordem nas três
         -- línguas, que é o que a casa reconhece ao telefone.
         order by c.sort_order, c.name, s.sort_order, s.name
      `
    : []

  const families = new Map<string, { slug: string; name: string; services: Row[] }>()
  for (const row of rows) {
    let family = families.get(row.category_id)
    if (!family) {
      family = { slug: row.category_slug, name: row.category_name, services: [] }
      families.set(row.category_id, family)
    }
    family.services.push(row)
  }

  return (
    <div className="mx-auto max-w-6xl px-3.5 pt-8 pb-10 sm:px-8 sm:pt-16 sm:pb-20">
      <Reveal className="mb-[18px] text-center sm:mb-10">
        <h1 className="display text-balance text-[1.625rem] leading-tight text-[var(--ink)] sm:text-[2.5rem]">
          {dict.home.servicesTitle}
        </h1>
        <p className="mx-auto mt-1.5 max-w-md text-[0.8125rem] leading-relaxed text-[var(--ink-muted)] sm:mt-3 sm:text-[0.9375rem]">
          {dict.home.servicesSubtitle}
        </p>
      </Reveal>

      {/* Uma coluna no telemóvel, duas no tablet, três no computador. As
          colunas de texto (e não uma grelha) deixam cada cartão com a
          altura da sua lista, sem buracos ao lado dos mais curtos. */}
      {rows.length === 0 ? null : (
        <div className="sm:columns-2 sm:gap-4 lg:columns-3">
          {[...families.values()].map((family) => (
            <ServiceFamily
              key={family.slug || family.name}
              title={family.name}
              media={
                FAMILY_PHOTOS.has(family.slug) ? (
                  <Photo src={`/fotos/familias/${family.slug}.jpg`} alt="" />
                ) : (
                  <span
                    aria-hidden
                    className="display absolute inset-0 grid place-items-center text-lg text-[var(--accent)]"
                    style={{
                      background:
                        'linear-gradient(150deg, color-mix(in srgb, var(--gold) 22%, var(--surface-2)), var(--surface-2))',
                    }}
                  >
                    {family.name.slice(0, 1)}
                  </span>
                )
              }
            >
              {family.services.map((service) => (
                <li
                  key={service.service_id}
                  className="border-t border-[var(--line-soft)] py-2.5 text-[0.875rem] leading-[19px] text-[#4A4238] sm:py-[9px]"
                >
                  {service.name}
                  {service.description ? (
                    <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
                      {service.description}
                    </span>
                  ) : null}
                </li>
              ))}
            </ServiceFamily>
          ))}
        </div>
      )}
    </div>
  )
}
