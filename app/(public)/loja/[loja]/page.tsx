import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { sql } from '@/lib/db'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { weeklyHours, type Window } from '@/lib/hours'
import { formatMinutes, today, weekdayOf } from '@/lib/time'
import { fill, getDictionary, getLanguage } from '@/lib/i18n'
import { Reveal } from '@/components/reveal'
import { Photo } from '@/components/photo'
import { FamilyDiscs } from '@/components/family-discs'
import { UnitStatusBadge } from '@/components/unit-status-badge'
import { formatPhone, sameWord } from '@/lib/text'

type Params = { params: Promise<{ loja: string }> }

type Photo = { id: string; url: string; alt: string | null }

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

const hoursLabel = (windows: Window[]) =>
  windows
    .map((w) => `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`)
    .join(' · ')

/*
 * O HORÁRIO EM FRASES, NÃO EM SETE LINHAS.
 *
 * A semana vinha dia a dia: sete linhas iguais em Valongo, seis iguais e
 * um domingo na Maia. Dias seguidos com o mesmo horário juntam-se numa
 * linha — «Segunda a sábado 09:00–20:00», «Domingo Fechado» — e a linha
 * onde cai o dia de hoje fica em ouro.
 */
function weekRows(
  week: Map<number, Window[]>,
  names: readonly string[],
  rangeTemplate: string,
  lowerSecond: boolean,
  todayWeekday: number,
) {
  const rows: { days: string; hours: string; today: boolean }[] = []
  let start = 0
  while (start < WEEK_ORDER.length) {
    const hours = hoursLabel(week.get(WEEK_ORDER[start]!) ?? [])
    let end = start
    while (
      end + 1 < WEEK_ORDER.length &&
      hoursLabel(week.get(WEEK_ORDER[end + 1]!) ?? []) === hours
    ) {
      end++
    }
    const first = names[WEEK_ORDER[start]!]!
    const last = names[WEEK_ORDER[end]!]!
    rows.push({
      days:
        start === end
          ? first
          : fill(rangeTemplate, { from: first, to: lowerSecond ? last.toLowerCase() : last }),
      hours,
      today: WEEK_ORDER.slice(start, end + 1).includes(todayWeekday),
    })
    start = end + 1
  }
  return rows
}

export default async function StorePage({ params }: Params) {
  const { loja } = await params
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])

  // Loja que não existe e loja a que não se chega dão a mesma resposta.
  if (!unit) notFound()

  const language = await getLanguage()

  const [dict, photos, week] = await Promise.all([
    getDictionary(),
    sql<Photo[]>`
      select id, url, alt
        from unit_photo
       where unit_id = ${unit.id}
       order by sort_order, created_at
    `,
    weeklyHours(unit.id),
  ])

  const address = [
    unit.address_line,
    [unit.postal_code, unit.city].filter(Boolean).join(' '),
  ]
    .filter((part): part is string => Boolean(part))
    .join(', ')

  // No topo a cidade só se escreve se não for já o nome da casa: por
  // baixo de «Valongo» em letra grande, «…, Valongo» era eco.
  const heroAddress = [
    unit.address_line,
    unit.city && !sameWord(unit.city, unit.name) ? unit.city : null,
  ]
    .filter(Boolean)
    .join(', ')

  const [hero, ...rest] = photos
  const rows = weekRows(
    week,
    dict.common.weekdaysLong,
    dict.unit.dayRange,
    language !== 'en',
    weekdayOf(today(unit.timezone)),
  )

  const whatsappHref = unit.whatsapp_phone
    ? `https://wa.me/${unit.whatsapp_phone.replace(/\D/g, '')}?text=${encodeURIComponent(dict.footer.whatsappMessage)}`
    : null

  return (
    <>
      {/* ------------------------------------------------ cabeçalho ---
          A casa apresenta-se na banda escura, como sempre: o nome grande,
          a morada, o estado e os dois gestos. Os raminhos saíram — com a
          fotografia logo por baixo, não tinham onde respirar — e os
          botões passam a redondos, como no resto do site. */}
      <section className="band-dark relative overflow-hidden">
        <div className="relative mx-auto max-w-6xl px-[22px] pt-[34px] pb-[30px] sm:px-8 sm:py-20">
          <p className="eyebrow eyebrow-gold animate-rise">
            {org.name}
            {unit.city && !sameWord(unit.city, unit.name) ? ` · ${unit.city}` : ''}
          </p>
          <h1 className="display animate-rise delay-1 mt-2.5 text-[2.875rem] leading-none sm:mt-4 sm:text-6xl">
            {unit.name}
          </h1>
          {heroAddress ? (
            <p className="animate-rise delay-2 mt-3 max-w-md text-[0.84375rem] leading-5 text-[var(--ink-muted)] sm:mt-5 sm:text-[0.9375rem] sm:leading-relaxed">
              {heroAddress}
            </p>
          ) : null}
          {/* O estado numa pílula de vidro, a mesma dos cartões das casas. */}
          <div className="animate-rise delay-3 mt-3.5 sm:mt-5">
            <span className="inline-flex h-7 items-center rounded-full bg-[rgba(242,237,226,0.08)] px-3 text-[#F2EDE2] shadow-[inset_0_0_0_1px_rgba(242,237,226,0.14)]">
              <UnitStatusBadge unit={unit} dict={dict} language={language} variant="dot" />
            </span>
          </div>
          <div className="animate-rise delay-4 mt-[22px] flex gap-2 sm:mt-8 sm:gap-3">
            <Link
              href={`/agendar/${unit.slug}`}
              className="botao toque flex h-12 flex-1 items-center justify-center rounded-full bg-[var(--action)] px-8 text-[0.9375rem] font-semibold text-[var(--action-ink)] transition-colors hover:bg-[var(--action-strong)] sm:flex-none"
            >
              {dict.home.houseBook}
            </Link>
            {address ? (
              <a
                href={directionsUrl(unit.latitude, unit.longitude, address)}
                target="_blank"
                rel="noreferrer"
                className="toque inline-flex h-12 shrink-0 items-center gap-[5px] rounded-full px-4 text-[0.84375rem] font-medium text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(242,237,226,0.25)] transition-colors hover:bg-[rgba(242,237,226,0.06)] sm:px-5"
              >
                <MapPin size={15} strokeWidth={1.8} aria-hidden />
                {dict.unit.directions}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ a abertura ---
          Uma casa mostra-se de longe: a fotografia ocupa a largura toda e
          é a primeira coisa que se vê depois do nome. Em retrato o corte é
          4/3, senão a sala vira uma faixa de dois dedos; no monitor abre
          para 21/9, que é onde a fotografia respira. */}
      {hero ? (
        <section className="overflow-hidden bg-[var(--surface-raised)]">
          <div className="aspect-[4/3] w-full sm:aspect-[21/9]">
            <Photo src={hero.url} alt={hero.alt ?? unit.name} eager />
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------- horário ---
          Eram três colunas soltas — Morada, Contactos, Horário da semana
          — com rótulos em maiúsculas e sete linhas de dias. Agora é um
          cartão só: o horário em cima, a morada e os dois gestos que
          interessam (ligar, escrever) por baixo. No monitor ficam lado a
          lado dentro do mesmo cartão. */}
      <section className="mx-auto max-w-6xl px-3.5 sm:px-8">
        <Reveal className="mt-4 rounded-[22px] bg-[var(--surface-raised)] px-4 pt-4 pb-3.5 shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:mt-10 sm:grid sm:grid-cols-2 sm:gap-12 sm:rounded-[26px] sm:p-9">
          <div>
            <h2 className="display flex items-center gap-2 text-[1.1875rem] leading-tight text-[var(--ink)] sm:text-[1.5rem]">
              <Clock size={17} strokeWidth={1.8} className="text-[var(--accent)]" aria-hidden />
              {dict.unit.hours}
            </h2>
            <dl className="mt-2.5 sm:mt-4">
              {rows.map((row) => (
                <div
                  key={row.days}
                  className={
                    'flex items-baseline justify-between gap-4 border-t border-[var(--line-soft)] py-[9px] text-[0.875rem] ' +
                    (row.today
                      ? 'font-semibold text-[var(--accent-strong)]'
                      : 'text-[#4A4238]')
                  }
                >
                  <dt>
                    {row.days}
                    {row.today ? (
                      <span className="ml-1.5 text-[0.625rem] tracking-[0.14em] text-[var(--accent)] uppercase">
                        {dict.funnel.today}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="tabular text-right">
                    {row.hours === '' ? (
                      <span className="font-normal text-[var(--ink-faint)]">
                        {dict.unit.closedNow}
                      </span>
                    ) : (
                      row.hours
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-3 border-t border-[var(--line-soft)] pt-3.5 sm:mt-0 sm:border-t-0 sm:border-l sm:pt-1 sm:pl-12">
            {address ? (
              <p className="flex items-start gap-2 text-[0.84375rem] leading-[19px] text-[#4A4238] sm:text-[0.9375rem] sm:leading-6">
                <MapPin size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[var(--accent)] sm:mt-1" aria-hidden />
                <span>{address}</span>
              </p>
            ) : null}
            {unit.email ? (
              <p className="mt-2 flex items-start gap-2 text-[0.84375rem] leading-[19px] text-[#4A4238] sm:text-[0.9375rem] sm:leading-6">
                <Mail size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[var(--accent)] sm:mt-1" aria-hidden />
                <a href={`mailto:${unit.email}`} className="break-all transition-colors hover:text-[var(--ink)]">
                  {unit.email}
                </a>
              </p>
            ) : null}

            {unit.phone || whatsappHref ? (
              <div className="mt-3.5 flex gap-2 sm:mt-6 sm:gap-3">
                {unit.phone ? (
                  <a
                    href={`tel:${unit.phone.replace(/\s/g, '')}`}
                    className="toque inline-flex h-[42px] flex-1 items-center justify-center gap-1.5 rounded-full text-[0.84375rem] font-medium text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(111,85,47,0.3)] transition-colors hover:bg-[rgba(142,111,65,0.07)] sm:h-11 sm:flex-none sm:px-6"
                  >
                    <Phone size={15} strokeWidth={1.8} aria-hidden />
                    {/* No telemóvel o botão liga; no computador não há
                        para onde ligar, e o que serve é ver o número. */}
                    <span className="sm:hidden">{dict.unit.call}</span>
                    <span className="tabular hidden sm:inline">{formatPhone(unit.phone)}</span>
                  </a>
                ) : null}
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="toque inline-flex h-[42px] flex-1 items-center justify-center gap-1.5 rounded-full text-[0.84375rem] font-medium text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(111,85,47,0.3)] transition-colors hover:bg-[rgba(142,111,65,0.07)] sm:h-11 sm:flex-none sm:px-6"
                  >
                    <MessageCircle size={15} strokeWidth={1.8} aria-hidden />
                    WhatsApp
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------- o que fazemos ---
          A lista inteira dos serviços, família a família, saiu daqui:
          ficam os discos da capa, e cada um leva a /servicos, onde a
          lista completa já vive. */}
      <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-20">
        <FamilyDiscs orgId={org.id} dict={dict} language={language} />
      </section>

      {/* -------------------------------------------------- a galeria ---
          As restantes fotografias da casa: a primeira em faixa larga, as
          outras aos pares, de cantos redondos. Quando sobra uma no fim,
          fecha também em faixa larga em vez de ficar órfã ao lado de um
          buraco. */}
      {rest.length > 0 ? (
        <section className="mx-auto max-w-6xl px-3.5 pt-10 sm:px-8 sm:pt-20">
          <Reveal className="text-center">
            <h2 className="display text-balance text-[1.5rem] leading-tight text-[var(--ink)] sm:text-[2rem]">
              {dict.home.galleryEyebrow}
            </h2>
          </Reveal>

          <Reveal group className="mt-4 grid grid-cols-2 gap-2 sm:mt-9 sm:gap-3">
            {rest.map((photo, index) => {
              const larga =
                index === 0 ||
                ((rest.length - 1) % 2 === 1 && index === rest.length - 1)
              return (
                <figure
                  key={photo.id}
                  className={
                    'group overflow-hidden rounded-[18px] bg-[var(--surface-raised)] sm:rounded-[22px] ' +
                    (larga ? 'col-span-2 aspect-[9/5] sm:aspect-[21/9]' : 'aspect-[11/10] sm:aspect-[4/3]')
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
        </section>
      ) : null}

      {/* -------------------------------------------------- chamada ---
          O único convite a marcar no fim desta página: o do rodapé não
          aparece aqui (ver FooterInvite), e este leva direto à loja. */}
      <section className="band-dark mt-10 sm:mt-24">
        <div className="mx-auto max-w-4xl px-5 py-[34px] text-center sm:px-8 sm:py-20">
          <Reveal>
            <h2 className="display text-balance text-[1.5rem] leading-tight sm:text-[2.5rem]">
              {dict.home.finalTitle1}{' '}
              <span className="display-italic text-[var(--accent)]">
                {dict.home.finalTitleItalic}
              </span>
              {dict.home.finalTitle2}
            </h2>
            <div className="mt-3.5 sm:mt-7">
              <Link
                href={`/agendar/${unit.slug}`}
                className="botao toque inline-flex h-[46px] items-center justify-center rounded-full bg-[var(--action)] px-8 text-[0.90625rem] font-semibold text-[var(--action-ink)] transition-colors hover:bg-[var(--action-strong)] sm:h-12 sm:text-[0.9375rem]"
              >
                {dict.home.houseBook}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
