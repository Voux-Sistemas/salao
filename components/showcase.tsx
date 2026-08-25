import Link from 'next/link'
import { sql } from '@/lib/db'
import { listUnits, type Org, type Unit } from '@/lib/org'
import { weekDigest, weeklyHours } from '@/lib/hours'
import { getDictionary, getLanguage, type Dictionary } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { formatPhone } from '@/lib/text'
import { ButtonLink } from '@/components/ui'
import { LogoMark, Ornament } from '@/components/brand'
import { Reveal } from '@/components/reveal'
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

  return (
    <article className="lift group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
      {/* A cara da casa antes da morada dela. Quem escolhe entre duas
          lojas escolhe pelo sítio, não pelo código postal. */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--surface)]">
        {cover ? (
          <Photo
            src={cover.url}
            alt={cover.alt ?? unit.name}
            className="transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <PhotoFallback seed={unit.name} />
        )}

        {/*
          O ESTADO POR CIMA DA FOTOGRAFIA.

          Estava numa caixa ao lado do nome, a empurrar a linha do
          título e a disputar-lhe a atenção. Aqui é onde o olho já está
          — e o vidro fumado deixa-o legível sobre qualquer imagem, seja
          a montra clara de Valongo ou a parede escura da Maia.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[color-mix(in_srgb,#131009_38%,transparent)] to-transparent to-45%"
        />
        {/*
          O `band-dark` NÃO É DECORAÇÃO AQUI: É O QUE O TORNA LEGÍVEL.

          O Badge pinta-se com a cor do próprio tom sobre transparente,
          e foi feito para assentar no creme da página. Sobre uma
          fotografia — a montra clara de Valongo, por exemplo — o tom
          neutro ficava tinta esbatida sobre fundo esbatido.

          Envolvê-lo em `band-dark` faz os tokens virarem para a paleta
          escura, e o vidro fumado por baixo dá-lhe um chão constante:
          o distintivo passa a ler-se igual seja qual for a fotografia.
        */}
        <div className="band-dark absolute right-3 top-3 rounded-full border border-[color-mix(in_srgb,var(--ink)_18%,transparent)] bg-[color-mix(in_srgb,var(--surface)_66%,transparent)] px-1 py-0.5 backdrop-blur-md">
          <UnitStatusBadge unit={unit} dict={dict} language={language} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <h3 className="display text-[1.5rem] leading-tight text-[var(--ink)]">
          {unit.name}
        </h3>

        {/* A morada lê-se como um endereço: alinhada à esquerda, por
            baixo do nome, e não como uma coluna de números. */}
        {unit.address_line ? (
          <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
            {unit.address_line}
            <br />
            {[unit.postal_code, unit.city].filter(Boolean).join(' ')}
          </p>
        ) : null}

        <a
          href={mapsUrl(unit)}
          target="_blank"
          rel="noreferrer"
          className="link-slide toque mt-2 inline-flex w-fit items-center gap-1.5 text-[0.8125rem] text-[var(--accent)]"
        >
          {dict.unit.directions}
          <span aria-hidden className="text-[0.6875rem] opacity-70">
            ↗
          </span>
        </a>

        {/*
          OS DOIS FACTOS, LADO A LADO.

          Eram uma lista de definições com o rótulo à esquerda e o valor
          à direita — o olho a saltar de ponta a ponta do ecrã em cada
          linha. Em duas caixinhas, cada rótulo fica por cima do seu
          valor e lê-se de uma vez.
        */}
        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--line-soft)] bg-[var(--line-soft)]">
          {unit.phone ? (
            <div className="bg-[var(--surface)] px-3.5 py-3">
              <dt className="eyebrow">{dict.unit.phoneLabel}</dt>
              <dd className="tabular mt-1 text-[0.8125rem] text-[var(--ink)]">
                {/* Sem o +351: numa caixa estreita gasta um quinto da
                    largura para dizer o que toda a gente cá sabe. O
                    link leva-o por dentro, para quem ligar de fora. */}
                <a
                  href={`tel:${unit.phone.replace(/\s/g, '')}`}
                  className="toque transition-colors hover:text-[var(--accent)]"
                >
                  {formatPhone(unit.phone).replace(/^\+351\s*/, '')}
                </a>
              </dd>
            </div>
          ) : null}

          <div className="bg-[var(--surface)] px-3.5 py-3">
            <dt className="eyebrow">
              {semana ? semana.days : dict.unit.closedNow}
            </dt>
            <dd className="tabular mt-1 text-[0.8125rem] text-[var(--ink)]">
              {semana ? semana.hours : '—'}
            </dd>
          </div>
        </dl>

        {/* As duas acções na forma da casa — a mesma pílula dos
            serviços e do fecho. */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href={`/agendar/${unit.slug}`}
            className="pilula-casa toque justify-center sm:justify-start"
          >
            {dict.home.houseBook}
          </Link>
          <Link
            href={`/loja/${unit.slug}`}
            className="toque inline-flex h-[2.875rem] items-center justify-center rounded-full border border-[var(--line)] px-6 text-[0.8125rem] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink-faint)]"
          >
            {dict.home.houseVisit}
          </Link>
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
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
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
            className="scrollbar-none -mr-5 mt-9 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 pr-5 sm:mr-0 sm:flex-wrap sm:justify-between sm:overflow-visible sm:pr-0"
          >
            {families.map((family) => (
              <Link
                key={family.slug}
                href="/servicos"
                className="toque group w-[6.5rem] shrink-0 snap-start text-center"
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

                <span className="display mt-3 block min-h-[2.5em] text-[0.875rem] leading-tight text-[var(--ink)]">
                  {family.name}
                </span>
                <span className="tabular mt-1 block text-[0.6875rem] text-[var(--ink-faint)]">
                  {family.count}
                </span>
              </Link>
            ))}
          </Reveal>

        </div>
      </section>

      {/* ------------------------------------------------ manifesto --- */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <Reveal>
          <Ornament />
          <p className="eyebrow mt-10">{dict.home.manifestoEyebrow}</p>
        </Reveal>
        <Reveal delay={120}>
          <p className="display mt-6 text-balance text-[1.25rem] leading-[1.45] sm:text-[2rem]">
            {dict.home.manifesto}
          </p>
        </Reveal>
      </section>

      {/* ------------------------------------------------ as casas ---- */}
      <section id="casas" className="scroll-mt-16 border-t border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <Reveal className="mb-10">
            <p className="eyebrow eyebrow-gold">{dict.home.storesTitle}</p>
            <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
              {dict.unit.listLead}
            </p>
          </Reveal>

          <Reveal group className="grid gap-6 lg:grid-cols-2">
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
