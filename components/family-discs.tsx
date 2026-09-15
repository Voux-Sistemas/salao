import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { sql } from '@/lib/db'
import type { Dictionary } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { Reveal } from '@/components/reveal'
import { ScrollDots } from '@/components/scroll-dots'
import { Photo } from '@/components/photo'

/**
 * AS FAMÍLIAS EM DISCOS — «O que fazemos».
 *
 * Nasceu na capa e desce agora também à página de cada loja, que
 * mostrava a lista inteira dos serviços aberta, família a família:
 * setenta nomes seguidos que ninguém lê de pé num telemóvel. A lista
 * completa vive em /servicos, e é para lá que cada disco leva.
 *
 * Mora num sítio só para as duas páginas dizerem o mesmo da mesma
 * maneira — e pede o catálogo ela própria, que é a única que o usa.
 */

type CatalogRow = {
  category_slug: string
  category_id: string
  category_name: string
  service_id: string
  name: string
  description: string | null
}

/**
 * As famílias que já têm fotografia em public/fotos/familias.
 *
 * Escrito à mão de propósito: o servidor não vai ao disco perguntar se
 * o ficheiro existe a cada pedido, e uma família sem fotografia mostra
 * o disco de ouro com a inicial em vez de uma imagem partida. Quando
 * chegar a oitava família, acrescenta-se aqui o nome do ficheiro.
 */
export const FAMILY_PHOTOS = new Set([
  'cabelo',
  'coloracao',
  'tratamentos-capilares',
  'barbearia',
  'maos-e-pes',
  'rosto',
  'corpo',
])

export async function FamilyDiscs({
  orgId,
  dict,
  language,
}: {
  orgId: string
  dict: Dictionary
  language: Language
}) {
  const catalog = await sql<CatalogRow[]>`
      select c.id as category_id,
             c.slug as category_slug,
             name_in(${language}, c.name, c.name_en, c.name_es) as category_name,
             s.id as service_id,
             name_in(${language}, s.name, s.name_en, s.name_es) as name,
             name_in(${language}, s.description,
                     s.description_en, s.description_es) as description
        from service s
        join service_category c on c.id = s.category_id and c.is_active
       where s.org_id = ${orgId} and s.is_active and s.bookable_online
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
            and st.org_id = ${orgId}
       )
       -- Ordenar pelo nome português mantém a mesma ordem nas três
       -- línguas, que é o que a casa reconhece ao telefone.
       order by c.sort_order, c.name, s.sort_order, s.name
    `

  const categories = new Map<string, { name: string; services: CatalogRow[] }>()
  for (const row of catalog) {
    const entry = categories.get(row.category_id) ?? {
      name: row.category_name,
      services: [],
    }
    entry.services.push(row)
    categories.set(row.category_id, entry)
  }

  /*
   * O nome sai da base já traduzido; o `slug` não se traduz e é ele que
   * encontra a fotografia em `public/fotos/familias`. Uma família sem
   * serviços activos não aparece — um disco que abre uma lista vazia é
   * pior do que um disco a menos.
   */
  const families = [...categories.entries()]
    .map(([id, entry]) => ({
      slug: catalog.find((row) => row.category_id === id)?.category_slug ?? '',
      name: entry.name,
      count: entry.services.length,
    }))
    .filter((family) => family.slug !== '' && family.count > 0)

  if (families.length === 0) return null

  return (
    <>
      {/*
        UM TÍTULO, E MAIS NADA ESCRITO.

        Aqui estavam três coisas a dizer a mesma: um rótulo em
        maiúsculas, uma frase de duas linhas, e um botão — tudo
        antes de se chegar às fotografias. As sete imagens por baixo
        dizem o que se faz aqui melhor e mais depressa do que
        qualquer frase, e o botão desceu para depois delas: pedi-lo
        antes era fazer uma pergunta antes de haver resposta.
      */}
      <Reveal>
        <h2 className="display text-balance text-center text-[1.5rem] leading-tight text-[var(--ink)] sm:text-[2rem]">
          {dict.home.servicesTitle}
        </h2>
      </Reveal>

      {/*
        No telemóvel as sete não cabem, e espremê-las em duas colunas
        dava discos do tamanho de uma moeda. Arrastam-se com o dedo,
        com encaixe — cada família pára no sítio, não a meio.
      */}
      <Reveal
        group
        className="scrollbar-none -mr-5 mt-6 flex snap-x snap-mandatory gap-[18px] overflow-x-auto pb-2 pr-5 sm:mr-0 sm:mt-9 sm:flex-wrap sm:justify-between sm:gap-5 sm:overflow-visible sm:pr-0"
      >
        {families.map((family) => (
          <Link
            key={family.slug}
            href="/servicos"
            className="toque group w-[5.75rem] shrink-0 snap-start text-center sm:w-[6.5rem]"
          >
            <span
              className="relative block aspect-square overflow-hidden rounded-full transition-transform duration-500 group-hover:scale-[1.04]"
              style={{
                boxShadow:
                  '0 0 0 1px var(--line), 0 0 0 5px var(--surface), 0 0 0 6px color-mix(in srgb, var(--gold) 55%, transparent)',
              }}
            >
              {FAMILY_PHOTOS.has(family.slug) ? (
                <>
                  <Photo
                    src={`/fotos/familias/${family.slug}.jpg`}
                    alt={family.name}
                  />
                  {/* Escurece o fundo do disco: sem isto, uma
                      fotografia clara encosta no creme da página e o
                      círculo desaparece. */}
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(to top, color-mix(in srgb, #131009 34%, transparent), transparent 58%)',
                    }}
                  />
                </>
              ) : (
                <span
                  aria-hidden
                  className="display absolute inset-0 grid place-items-center text-2xl text-[var(--accent)]"
                  style={{
                    background:
                      'linear-gradient(150deg, color-mix(in srgb, var(--gold) 22%, var(--surface-2)), var(--surface-2))',
                  }}
                >
                  {family.name.slice(0, 1)}
                </span>
              )}
            </span>

            {/* O nome guarda duas linhas de altura, para os discos
                ficarem todos à mesma altura. O número de serviços de
                cada família saiu: não dizia nada a quem escolhe. */}
            <span className="display mt-2.5 block min-h-[2.4em] text-[0.84375rem] leading-[1.2] text-[var(--ink)] sm:mt-3 sm:text-[0.875rem]">
              {family.name}
            </span>
          </Link>
        ))}
      </Reveal>
      <ScrollDots className="mt-2 sm:hidden" />

      <div className="mt-4 flex justify-center sm:mt-8">
        <Link
          href="/servicos"
          className="link-slide inline-flex items-center gap-0.5 text-[0.84375rem] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--action-strong)]"
        >
          {dict.home.servicesAll}
          <ChevronRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </>
  )
}
