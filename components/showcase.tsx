import Link from 'next/link'
import { ChevronRight, MapPin } from 'lucide-react'
import { sql } from '@/lib/db'
import { listUnits, type Org, type Unit } from '@/lib/org'
import { weekDigest, weeklyHours } from '@/lib/hours'
import { getDictionary, getLanguage, type Dictionary } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { formatPhone } from '@/lib/text'
import { ButtonLink } from '@/components/ui'
import { LogoMark, Ornament } from '@/components/brand'
import { Reveal } from '@/components/reveal'
import { ScrollDots } from '@/components/scroll-dots'
import { BAND_GROUND } from '@/components/funnel-stage'
import { UnitStatusBadge } from '@/components/unit-status-badge'
import { Photo, PhotoFallback } from '@/components/photo'

/**
 * A montra: o primeiro (e às vezes único) contacto de uma cliente com a
 * casa. Tom de hotel boutique — muito ar, serifas grandes, ouro em fio.
 * O botão principal em qualquer destas telas é MARCAR.
 *
 * AQUI NÃO SE FALA DE DINHEIRO. O preçário saiu: uma montra que abre
 * com uma tabela de preços vende-se pelo preço, e esta casa vende-se
 * pelas mãos e pelo sítio. Os serviços continuam todos à vista — só o
 * nome, como uma ementa de casa boa — e o valor aparece onde tem de
 * aparecer, na marcação, já com a loja e a profissional escolhidas, que
 * é quando ele é um número verdadeiro e não um «a partir de».
 */

type CatalogRow = {
  category_slug: string
  category_id: string
  category_name: string
  service_id: string
  name: string
  description: string | null
}

type PhotoRow = {
  id: string
  unit_id: string
  unit_name: string
  url: string
  alt: string | null
}

/**
 * As famílias que já têm fotografia em public/fotos/familias.
 *
 * Escrito à mão de propósito: o servidor não vai ao disco perguntar se
 * o ficheiro existe a cada pedido, e uma família sem fotografia mostra
 * o disco de ouro com a inicial em vez de uma imagem partida. Quando
 * chegar a oitava família, acrescenta-se aqui o nome do ficheiro.
 */
const FAMILY_PHOTOS = new Set([
  'cabelo',
  'coloracao',
  'tratamentos-capilares',
  'barbearia',
  'maos-e-pes',
  'rosto',
  'corpo',
])

/**
 * As marcas que entram nos tratamentos da casa. Saíram do preçário —
 * «Tratamento Truss», «Coloração (inoa)», «Tratamento plex» — e não de
 * uma lista de marcas bonitas. Mudar aqui muda a fita.
 */
const BRANDS = ['Truss', 'Brae', 'L’Oréal', 'Inoa', 'Plex', 'BaByliss']

function mapsUrl(unit: Unit) {
  const address = [unit.address_line, unit.postal_code, unit.city]
    .filter(Boolean)
    .join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(address || unit.name)}`
}

/**
 * A FICHA DE UMA CASA.
 *
 * Tinha o nome escrito duas vezes — a cidade por cima e o nome por
 * baixo, e nesta rede são a mesma palavra —, a morada alinhada à
 * direita em três linhas de margem esquerda irregular, e uma lista de
 * definições que mandava o olho de uma ponta à outra do ecrã em cada
 * linha. Era isso o desarrumado, não a quantidade de coisas.
 *
 * E o horário dizia «hoje». O «hoje» muda conforme a hora a que se olha
 * para ele, e ficava a contradizer o distintivo do estado mesmo quando
 * ambos estavam certos: «abre amanhã às 09:00» por cima de «hoje
 * 09:00–21:00». Passa a dizer a semana, que não muda; o ESTADO vive no
 * distintivo, o HORÁRIO vive na ficha, e nunca se pisam.
 */
async function HouseCard({
  unit,
  cover,
  dict,
  language,
}: {
  unit: Unit
  cover: PhotoRow | null
  dict: Dictionary
  language: Language
}) {
  const digest = weekDigest(
    await weeklyHours(unit.id),
    dict.common.weekdaysShort,
    dict.unit.closedNow,
  )
  const open = digest.filter((row) => row.hours !== dict.unit.closedNow)
  const semana = open[0] ?? null

  // A cidade só se escreve quando não é o próprio nome da casa.
  const sameAsName =
    unit.city && unit.city.trim().toLowerCase() === unit.name.trim().toLowerCase()
  const address = [unit.address_line, sameAsName ? null : unit.city].filter(Boolean).join(', ')

  /*
    O CARTÃO ESCURO DA CASA — a opção B do mockup «As nossas casas».

    Era um cartão claro com a foto, uma etiqueta quadrada em maiúsculas
    por cima, e o nome, a morada, duas caixinhas e dois botões por baixo,
    tudo no creme da página: lia-se como uma ficha, e a casa dizia que
    era feio. Agora a fotografia fica em cima, limpa e com cantos
    redondos — sem texto por cima a disputar com o letreiro de Valongo —
    e por baixo a mesma faixa escura que o funil usa, com os detalhes em
    ouro. Quem vê a capa já reconhece o desenho quando vai marcar.
  */
  return (
    <article
      className="band-dark lift group flex h-full flex-col overflow-hidden rounded-[26px] shadow-[inset_0_0_0_1px_rgba(211,184,126,0.16),0_24px_44px_-26px_rgba(34,29,23,0.55)]"
      style={{ background: BAND_GROUND }}
    >
      <div className="relative mx-2 mt-2 aspect-[16/10] overflow-hidden rounded-[20px] bg-[#2A2420]">
        {cover ? (
          <Photo
            src={cover.url}
            alt={cover.alt ?? unit.name}
            className="transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <PhotoFallback seed={unit.name} />
        )}

        {/* O estado por cima da fotografia, num vidro fumado: lê-se igual
            sobre a montra clara de Valongo e sobre a parede escura da Maia. */}
        <span className="absolute top-2.5 left-2.5 inline-flex h-[26px] items-center rounded-full bg-[rgba(20,16,9,0.38)] px-[11px] text-[#F2EDE2] shadow-[inset_0_0_0_1px_rgba(242,237,226,0.18)] backdrop-blur-md">
          <UnitStatusBadge unit={unit} dict={dict} language={language} variant="dot" />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-[18px] pt-4 pb-[18px] sm:px-6 sm:pt-5 sm:pb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="display text-[1.875rem] leading-[1.05] text-[#F7F2E8] sm:text-[2.125rem]">
            {unit.name}
          </h3>
          <Link
            href={`/loja/${unit.slug}`}
            className="toque inline-flex shrink-0 items-center gap-0.5 text-[0.78125rem] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:text-[0.8125rem]"
          >
            {dict.home.houseVisit}
            <ChevronRight size={13} strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {address ? (
          <p className="mt-2 flex gap-1.5 text-[0.78125rem] leading-[17px] text-[var(--ink-muted)] sm:text-[0.8125rem] sm:leading-[19px]">
            <MapPin size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
            <span>{address}</span>
          </p>
        ) : null}

        {/* Os dois factos lado a lado, cada rótulo por cima do seu valor. */}
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-[rgba(242,237,226,0.08)]">
          <div className="bg-[rgba(20,16,9,0.6)] px-3 py-[9px]">
            <dt className="text-[0.59375rem] tracking-[0.18em] text-[#8F8472] uppercase">
              {semana ? semana.days : dict.unit.closedNow}
            </dt>
            <dd className="tabular mt-0.5 text-[0.8125rem] text-[#EDE6D8]">
              {semana ? semana.hours : '—'}
            </dd>
          </div>
          {unit.phone ? (
            <div className="bg-[rgba(20,16,9,0.6)] px-3 py-[9px]">
              <dt className="text-[0.59375rem] tracking-[0.18em] text-[#8F8472] uppercase">
                {dict.unit.phoneLabel}
              </dt>
              <dd className="tabular mt-0.5 text-[0.8125rem] text-[#EDE6D8]">
                {/* Sem o +351: numa caixa estreita gasta um quinto da
                    largura para dizer o que toda a gente cá sabe. O link
                    leva-o por dentro, para quem ligar de fora. */}
                <a
                  href={`tel:${unit.phone.replace(/\s/g, '')}`}
                  className="toque transition-colors hover:text-[var(--accent)]"
                >
                  {formatPhone(unit.phone).replace(/^\+351\s*/, '')}
                </a>
              </dd>
            </div>
          ) : (
            <div className="bg-[rgba(20,16,9,0.6)]" />
          )}
        </dl>

        <div className="mt-3.5 flex gap-2 sm:mt-5">
          <Link
            href={`/agendar/${unit.slug}`}
            className="botao toque flex h-[46px] flex-1 items-center justify-center rounded-full bg-[#C6A96B] text-[0.90625rem] font-semibold text-[#1E1811] transition-colors hover:bg-[#D3B87E] sm:h-12 sm:text-[0.9375rem]"
          >
            {dict.home.houseBook}
          </Link>
          <a
            href={mapsUrl(unit)}
            target="_blank"
            rel="noreferrer"
            className="toque inline-flex h-[46px] shrink-0 items-center gap-[5px] rounded-full px-4 text-[0.84375rem] font-medium text-[#F2EDE2] shadow-[inset_0_0_0_1px_rgba(242,237,226,0.22)] transition-colors hover:bg-[rgba(242,237,226,0.06)] sm:h-12 sm:px-5"
          >
            <MapPin size={15} strokeWidth={1.8} aria-hidden />
            {dict.unit.directions}
          </a>
        </div>
      </div>
    </article>
  )
}

export async function Showcase({ org }: { org: Org }) {
  // A língua vem antes de tudo o resto: o catálogo sai da base já
  // traduzido, e a consulta precisa de saber para quem escreve.
  const language = await getLanguage()

  const [dict, units, catalog, photos] = await Promise.all([
    getDictionary(),
    listUnits(),
    // Só o que se mostra: nome, categoria e a linha de descrição. O
    // preço e a duração ficaram para o funil de marcação — pedi-los aqui
    // era pagar a travessia para os deitar fora deste lado.
    sql<CatalogRow[]>`
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

  /*
   * O HORÁRIO DEIXOU DE SE PEDIR AQUI.
   *
   * Cada ficha pedia as janelas de HOJE, e o cartão dizia «hoje
   * 09:00–21:00» — uma frase que muda conforme a hora a que se olha
   * para ela, e que ficava a contradizer o distintivo do estado. O
   * cartão passa a pedir a semana, que não muda.
   */
  const houses = units.map((unit) => ({
    unit,
    cover: coverOf.get(unit.id) ?? null,
  }))

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
   * AS FAMÍLIAS, PARA OS DISCOS.
   *
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

  // «Fale connosco» é o WhatsApp da casa, e é uma conversa que ela
  // começa — não há automatismo nenhum do outro lado, só a mensagem já
  // escrita à espera do «enviar». Sem WhatsApp configurado, é o telefone
  // da primeira loja que o tem; sem isso, o botão não aparece de todo,
  // que é melhor do que um convite que não leva a lado nenhum.
  const whatsapp =
    org.whatsapp_phone ?? units.find((u) => u.whatsapp_phone)?.whatsapp_phone ?? null
  const phone = units.find((u) => u.phone)?.phone ?? null
  const contactHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(dict.footer.whatsappMessage)}`
    : phone
      ? `tel:${phone.replace(/\s/g, '')}`
      : null

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
          {/* UM BOTÃO SÓ. Havia um segundo, «As nossas casas», que levava
              à secção logo por baixo: no telemóvel ficava cortado na dobra,
              com outra largura, e disputava a atenção com o que interessa
              — marcar. As casas continuam a um gesto de distância.

              E SÓ ISSO MUDOU. Chegou a encolher-se o logótipo e o ar à
              volta para caber tudo no primeiro ecrã, e a capa perdeu a
              hierarquia: o logótipo colado ao cabeçalho e um botão da
              largura do ecrã. Com um botão só, o desenho de sempre cabe. */}
          <div className="animate-rise delay-5 mt-11 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/agendar" size="lg">
              {dict.home.cta}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ------------------------------ o que se faz nesta casa ------- */}
      {/*
        SETE FAMÍLIAS, SETE FOTOGRAFIAS.

        Estavam numa aba a disputar espaço com as lojas, como se «o quê»
        e «onde» fossem duas vistas da mesma coisa. E estavam escritas:
        sessenta e sete nomes de serviço em lista, que ninguém lê de pé
        num telemóvel. Uma fotografia dentro de um círculo diz o que é
        antes de se ler o nome por baixo — e o anel é o mesmo do selo da
        casa, para isto não parecer o carrossel de categorias de uma
        loja qualquer.
      */}
      <section
        id="servicos"
        className="scroll-mt-16 border-t border-[var(--line-soft)]"
      >
        <div className="mx-auto max-w-6xl px-5 pt-10 pb-2 sm:px-8 sm:pt-16 sm:pb-6">
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
        </div>
      </section>

      {/* ------------------------------------------------ manifesto --- */}
      {/* O espaço entre os discos e «A casa» era de quase meio ecrã no
          telemóvel: parecia que a página tinha acabado. */}
      <section className="mx-auto max-w-3xl px-5 pt-9 pb-14 text-center sm:px-8 sm:py-20">
        <Reveal>
          <Ornament className="scale-75 sm:scale-100" />
          <p className="eyebrow mt-4 sm:mt-10">{dict.home.manifestoEyebrow}</p>
        </Reveal>
        <Reveal delay={120}>
          <p className="display mt-3 text-balance text-[1.1875rem] leading-[1.45] sm:mt-6 sm:text-[2rem]">
            {dict.home.manifesto}
          </p>
        </Reveal>
      </section>

      {/* ------------------------------------------------ as casas ---- */}
      <section id="casas" className="scroll-mt-16 border-t border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-3.5 py-10 sm:px-8 sm:py-20">
          {/* Um título centrado, como o de «O que fazemos»: as duas
              secções da capa falam da mesma maneira. */}
          <Reveal className="mb-6 text-center sm:mb-10">
            <h2 className="display text-balance text-[1.5rem] leading-tight text-[var(--ink)] sm:text-[2rem]">
              {dict.home.housesHeading}
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-[0.8125rem] leading-relaxed text-[var(--ink-muted)] sm:mt-3 sm:text-[0.9375rem]">
              {dict.unit.listLead}
            </p>
          </Reveal>

          <Reveal group className="grid gap-3.5 sm:gap-6 lg:grid-cols-2">
            {houses.map(({ unit, cover }) => (
              <HouseCard
                key={unit.id}
                unit={unit}
                cover={cover}
                dict={dict}
                language={language}
              />
            ))}
          </Reveal>

        </div>
      </section>

      {/* ------------------------------------------------- as marcas -- */}
      {/*
        NÃO É ENFEITE, É PROVA.

        Truss, Brae, Inoa, Plex — saíram do preçário da casa, não de uma
        lista de marcas bonitas. Quem procura salão olha para isto para
        saber com que produto lhe vão tocar no cabelo, e é a pergunta
        que uma galeria de fotografias não responde.

        A fita anda sozinha e pára quando o rato lhe assenta em cima —
        para se conseguir ler o nome em que se está a olhar. Quem tiver o
        sistema a pedir menos movimento vê uma fila parada, que se
        arrasta com o dedo (ver `.fita-marcas` no globals.css).
      */}
      <section className="border-t border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
          <p className="eyebrow eyebrow-gold mb-7 text-center">
            {dict.home.brandsEyebrow}
          </p>

          <div className="fita-janela">
            <div className="fita-marcas">
              {[0, 1].map((copia) => (
                <div key={copia} className="fita-grupo" aria-hidden={copia === 1}>
                  {BRANDS.map((brand) => (
                    <span
                      key={brand}
                      className="display whitespace-nowrap text-xl text-[var(--ink-faint)] sm:text-2xl"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </>
  )
}
