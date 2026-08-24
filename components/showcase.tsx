import { sql } from '@/lib/db'
import { listUnits, type Org, type Unit } from '@/lib/org'
import { openingWindows, type Window } from '@/lib/hours'
import { formatDuration, formatMinutes, today } from '@/lib/time'
import { fill, getDictionary, getLanguage, type Dictionary } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { formatCents } from '@/lib/money'
import { formatPhone } from '@/lib/text'
import { ButtonLink } from '@/components/ui'
import { LogoMark, Ornament } from '@/components/brand'
import { Reveal } from '@/components/reveal'
import { PriceLine } from '@/components/price-list'
import { CollapseGroup } from '@/components/collapse-group'
import { UnitStatusBadge } from '@/components/unit-status-badge'
import { Photo, PhotoFallback } from '@/components/photo'

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
  image_url: string | null
  image_alt: string | null
}

type PhotoRow = {
  id: string
  unit_id: string
  unit_name: string
  url: string
  alt: string | null
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
  cover,
  todayWindows,
  dict,
  language,
}: {
  unit: Unit
  cover: PhotoRow | null
  todayWindows: Window[]
  dict: Dictionary
  language: Language
}) {
  return (
    <article className="lift group flex h-full flex-col overflow-hidden border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
      {/* A cara da casa antes da morada dela. Quem escolhe entre duas
          lojas escolhe pelo sítio, não pelo código postal. */}
      <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--surface)]">
        {cover ? (
          <Photo
            src={cover.url}
            alt={cover.alt ?? unit.name}
            className="transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <PhotoFallback seed={unit.name} />
        )}
      </div>

      <div className="flex flex-1 flex-col p-8 sm:p-10">
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
                className="link-slide toque text-[0.8125rem] text-[var(--accent)]"
              >
                {dict.unit.directions}
              </a>
            </HouseRow>
          ) : null}
          {unit.phone ? (
            <HouseRow label={dict.unit.phoneLabel}>
              <a
                href={`tel:${unit.phone.replace(/\s/g, '')}`}
                className="tabular toque transition-colors hover:text-[var(--ink)]"
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
      </div>
    </article>
  )
}

export async function Showcase({ org }: { org: Org }) {
  // A língua vem antes de tudo o resto: o preçário sai da base já
  // traduzido, e a consulta precisa de saber para quem escreve.
  const language = await getLanguage()

  const [dict, units, catalog, photos] = await Promise.all([
    getDictionary(),
    listUnits(),
    sql<CatalogRow[]>`
      select c.id as category_id,
             name_in(${language}, c.name, c.name_en, c.name_es) as category_name,
             s.id as service_id,
             name_in(${language}, s.name, s.name_en, s.name_es) as name,
             name_in(${language}, s.description,
                     s.description_en, s.description_es) as description,
             s.duration_minutes, s.base_price_cents,
             s.image_url, s.image_alt
        from service s
        join service_category c on c.id = s.category_id and c.is_active
       where s.org_id = ${org.id} and s.is_active and s.bookable_online
       -- Ordenar pelo nome português mantém a mesma ordem nas três
       -- línguas, que é o que a casa reconhece ao telefone.
       order by c.sort_order, c.name, s.sort_order, s.name
    `,
    // As fotografias das duas casas, pela ordem em que a dona as pôs.
    // Servem três sítios desta página: o fundo do herói, a ficha de
    // cada casa e a galeria — por isso vêm todas numa consulta só.
    sql<PhotoRow[]>`
      select p.id, p.unit_id, u.name as unit_name, p.url, p.alt
        from unit_photo p
        join unit u on u.id = p.unit_id and u.is_active
       order by u.sort_order, u.name, p.sort_order
    `,
  ])

  // A primeira fotografia de cada casa é a capa dela; a primeira de
  // todas abre a página. Se um dia não houver nenhuma, o herói volta ao
  // que era — tipografia sobre a banda escura — e nada parte.
  const coverOf = new Map<string, PhotoRow>()
  for (const photo of photos) {
    if (!coverOf.has(photo.unit_id)) coverOf.set(photo.unit_id, photo)
  }
  const heroPhoto = photos[0]

  // As cidades por cima do título saem das lojas que existem. Estavam
  // escritas à mão no dicionário e diziam "Chiado · Cascais", que é de
  // outro salão: um sítio onde a morada nunca pode estar errada.
  const cities = [...new Set(units.map((u) => u.city).filter(Boolean))].join(' · ')

  const houses = await Promise.all(
    units.map(async (unit) => ({
      unit,
      cover: coverOf.get(unit.id) ?? null,
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
        {/* A casa a sério por trás do nome dela. A fotografia entra em
            surdina — escurecida e sem contraste a mais — porque o que
            tem de se ler aqui é o título; ela está lá para dizer que
            isto é um sítio verdadeiro, não um modelo de página. */}
        {heroPhoto ? (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Photo
              src={heroPhoto.url}
              alt=""
              eager
              className="scale-105 opacity-40 [filter:saturate(0.8)]"
            />
            {/* Duas camadas: uma escurece tudo por igual, a outra puxa o
                fundo ao centro para as letras assentarem em preto. */}
            <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--surface)_58%,transparent)]" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 70% 55% at 50% 45%, color-mix(in srgb, var(--surface) 72%, transparent), transparent 75%)',
              }}
            />
          </div>
        ) : null}

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
            {cities || dict.home.heroEyebrow}
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
            {houses.map(({ unit, cover, todayWindows }) => (
              <HouseCard
                key={unit.id}
                unit={unit}
                cover={cover}
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
                      thumb={{
                        url: service.image_url,
                        alt:
                          service.image_alt ??
                          fill(dict.home.servicePhotoAlt, {
                            service: service.name,
                          }),
                      }}
                    />
                  ))}
                </CollapseGroup>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------- a galeria -------- */}
      {photos.length > 0 ? (
        <section className="border-t border-[var(--line-soft)]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <Reveal className="text-center">
              <p className="eyebrow eyebrow-gold">{dict.home.galleryEyebrow}</p>
              <h2 className="display mt-4 text-3xl sm:text-4xl">
                {dict.home.galleryTitle}
              </h2>
              <Ornament className="mt-8" />
            </Reveal>

            {/* A primeira ocupa quatro lugares — é a que se vê de longe.
                `auto-rows-fr` obriga todas as filas à mesma altura, senão
                a grande esticava-se e as pequenas encolhiam por baixo.
                `dense` é seguro de propósito: se um dia a dona apagar
                metade das fotografias, o mosaico fecha os buracos em vez
                de deixar um vazio no meio. */}
            <Reveal
              group
              className="mt-12 grid auto-rows-fr grid-flow-row-dense grid-cols-2 gap-2 sm:mt-16 sm:grid-cols-4 sm:gap-3"
            >
              {photos.map((photo, index) => (
                <figure
                  key={photo.id}
                  className={
                    'group relative overflow-hidden bg-[var(--surface-raised)] ' +
                    (index === 0
                      ? 'col-span-2 aspect-[4/3] sm:row-span-2 sm:aspect-auto'
                      : 'aspect-square')
                  }
                >
                  <Photo
                    src={photo.url}
                    alt={photo.alt ?? photo.unit_name}
                    className="transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
                  />
                  {/* O nome da casa só aparece a pairar, e só no monitor:
                      ao telemóvel não há rato para o revelar e uma tarja
                      permanente por cima de nove fotografias é ruído. */}
                  <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-[color-mix(in_srgb,var(--surface)_88%,transparent)] to-transparent px-4 pb-3 pt-10 text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--ink-muted)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 sm:block">
                    {photo.unit_name}
                  </figcaption>
                </figure>
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
