import { sql } from '@/lib/db'
import { listUnits, type Org } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { ButtonLink } from '@/components/ui'
import { LogoMark } from '@/components/brand'
import { Reveal } from '@/components/reveal'
import { Photo } from '@/components/photo'
import { FamilyDiscs } from '@/components/family-discs'
import { HouseCard } from '@/components/house-card'

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

type PhotoRow = {
  id: string
  unit_id: string
  unit_name: string
  url: string
  alt: string | null
}

/**
 * As marcas que entram nos tratamentos da casa. Saíram do preçário —
 * «Tratamento Truss», «Coloração (inoa)», «Tratamento plex» — e não de
 * uma lista de marcas bonitas. Mudar aqui muda a fita.
 */
const BRANDS = ['Truss', 'Brae', 'L’Oréal', 'Inoa', 'Plex', 'BaByliss']

export async function Showcase({ org }: { org: Org }) {
  // A língua vem antes de tudo o resto: o catálogo sai da base já
  // traduzido, e a consulta precisa de saber para quem escreve.
  const language = await getLanguage()

  const [dict, units, photos] = await Promise.all([
    getDictionary(),
    listUnits(),
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
          <FamilyDiscs orgId={org.id} dict={dict} language={language} />
        </div>
      </section>

      {/*
        A FRASE «A CASA» SAIU.

        Vivia aqui, entre os serviços e as casas: um raminho, um rótulo em
        maiúsculas e quatro linhas grandes, soltas do que vinha antes e do
        que vinha depois. Na capa lia-se como uma interrupção. Dos
        serviços passa-se agora direto às casas.
      */}
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

          {/* No computador os dois cartões ficam numa faixa um pouco mais
              estreita do que a página: à largura toda, com a fotografia a
              crescer com eles, cada cartão parecia um cartaz. */}
          <Reveal group className="grid gap-3.5 sm:gap-6 lg:mx-auto lg:max-w-[62.5rem] lg:grid-cols-2">
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
