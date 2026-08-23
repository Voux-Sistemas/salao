import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { weeklyHours } from '@/lib/hours'
import { formatMinutes, today, weekdayOf } from '@/lib/time'
import { fill, getDictionary, getLanguage } from '@/lib/i18n'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import { ButtonLink } from '@/components/ui'
import { Ornament, Sprig } from '@/components/brand'
import { Reveal } from '@/components/reveal'
import { PriceLine } from '@/components/price-list'
import { Photo } from '@/components/photo'
import { CollapseGroup } from '@/components/collapse-group'
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
  image_url: string | null
  image_alt: string | null
}

/*
 * O CARTÃO DESTA CASA
 *
 * Este é um dos dois endereços que a dona cola numa conversa. Quando o
 * WhatsApp o abre para desenhar a pré-visualização, quem lê é um robô sem
 * cookie — por isso o texto fica em português, como o do layout.
 *
 * A imagem não vem aqui: sobe do `opengraph-image.png` da raiz.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { loja } = await params
  const unit = await getUnitBySlug(loja)
  if (!unit) return { title: 'Loja' }

  const place = unit.city ? `${unit.name} · ${unit.city}` : unit.name
  const description = unit.address_line
    ? `${unit.address_line}${unit.city ? `, ${unit.city}` : ''}. Marcação online, sem telefonemas.`
    : 'Marcação online, sem telefonemas.'

  return {
    title: unit.name,
    description,
    alternates: { canonical: `/loja/${unit.slug}` },
    openGraph: {
      type: 'website',
      title: place,
      description,
      url: `/loja/${unit.slug}`,
    },
    twitter: { card: 'summary_large_image', title: place, description },
  }
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

/** A semana começa a segunda; domingo (0) fica para o fim. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default async function StorePage({ params }: Params) {
  const { loja } = await params
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])

  // Loja que não existe e loja a que não se chega dão a mesma resposta.
  if (!unit) notFound()

  const [dict, language, photos, prices, week] = await Promise.all([
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
             p.duration_minutes, p.price_cents,
             s.image_url, s.image_alt
        from service s
        join service_category c on c.id = s.category_id and c.is_active
        cross join lateral effective_service_pricing(s.id, ${unit.id}::uuid, null::uuid) p
       where s.org_id = ${org.id} and s.is_active and s.bookable_online
       order by c.sort_order, c.name, s.sort_order, s.name
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

      {/* ------------------------------------------------ a abertura ---
          Uma casa mostra-se de longe. A fotografia que abria esta página
          era um terço de uma grelha com margens dos dois lados — cabia
          num cartão de visita. Agora ocupa a largura toda e é a primeira
          coisa que se vê depois do nome: quem chega percebe onde vai
          pôr os pés antes de ler uma única palavra.

          Em retrato o corte é 4/3, senão a sala vira uma faixa de dois
          dedos; no monitor abre para 21/9, que é onde a fotografia
          respira. */}
      {hero ? (
        <section className="overflow-hidden bg-[var(--surface-raised)]">
          <div className="aspect-[4/3] w-full sm:aspect-[21/9]">
            <Photo src={hero.url} alt={hero.alt ?? unit.name} eager />
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
            <div className="mt-10 grid gap-x-20 gap-y-10 sm:mt-14 sm:grid-cols-2 sm:gap-y-14">
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
                      price={formatCents(service.price_cents, org.currency, language)}
                      description={service.description}
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

      {/* -------------------------------------------------- a galeria ---
          As restantes fotografias da casa, aos pares e grandes. Um
          mosaico de miniaturas diz "temos fotografias"; isto diz como é
          lá dentro, que é a pergunta a que a página responde.

          Quando sobra uma — Valongo tem cinco depois da abertura — ela
          fecha a secção em faixa larga em vez de ficar órfã ao lado de
          um buraco. */}
      {rest.length > 0 ? (
        <section className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mt-20 border-t border-[var(--line-soft)] pt-14">
            <Reveal className="text-center">
              <p className="eyebrow eyebrow-gold">{dict.home.galleryEyebrow}</p>
              <h2 className="display mt-4 text-3xl sm:text-4xl">
                {dict.home.galleryTitle}
              </h2>
              <Ornament className="mt-7" />
            </Reveal>

            <Reveal group className="mt-12 grid gap-3 sm:mt-16 sm:grid-cols-2">
              {rest.map((photo, index) => {
                const sozinha =
                  rest.length % 2 === 1 && index === rest.length - 1
                return (
                  <figure
                    key={photo.id}
                    className={
                      'group overflow-hidden bg-[var(--surface-raised)] ' +
                      (sozinha
                        ? 'aspect-[3/2] sm:col-span-2 sm:aspect-[21/9]'
                        : 'aspect-[4/3]')
                    }
                  >
                    <Photo
                      src={photo.url}
                      alt={photo.alt ?? unit.name}
                      className="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.05]"
                    />
                  </figure>
                )
              })}
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
