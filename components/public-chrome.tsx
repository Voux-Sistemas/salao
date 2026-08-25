import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { getOrg, listUnits } from '@/lib/org'
import { getDictionary, getLanguage, LANGUAGE_TAG } from '@/lib/i18n'
import { getClientActor } from '@/lib/auth/client-actor'
import { BRAND } from '@/lib/branding'
import { LanguageSwitcher } from '@/components/language-switcher'
import { LogoSeal } from '@/components/brand'
import { ButtonLink } from '@/components/ui'
import { FooterInvite } from '@/components/footer-invite'
import { formatPhone } from '@/lib/text'

/**
 * A moldura da superfície pública: um cabeçalho fixo e fino, em vidro
 * fumado sobre o herói escuro (ou em porcelana translúcida nas páginas
 * interiores), e um rodapé em banda escura com a marca, os caminhos
 * e a porta da equipa. As moradas vivem na página, não aqui.
 */

export async function PublicChrome({
  children,
  compact = false,
  hero = false,
}: {
  children: ReactNode
  compact?: boolean
  /** Página com herói escuro no topo: o cabeçalho vira vidro fumado. */
  hero?: boolean
}) {
  const [org, dict, language, client, units] = await Promise.all([
    getOrg(),
    getDictionary(),
    getLanguage(),
    getClientActor(),
    listUnits(),
  ])

  const name = org?.name ?? BRAND.fallbackName
  const whatsapp =
    org?.whatsapp_phone ?? units.find((u) => u.whatsapp_phone)?.whatsapp_phone ?? null
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(dict.footer.whatsappMessage)}`
    : null
  const year = new Date().getFullYear()

  /*
   * UM NÚMERO, OU UM POR LOJA — E É A BASE QUE DECIDE.
   *
   * Hoje as duas casas atendem no mesmo telefone. Isso não é uma regra
   * do salão, é o estado de agora: no dia em que a Maia tiver linha
   * própria, esta comparação passa a falhar sozinha e cada número volta
   * para baixo da sua loja, sem ninguém ter de vir aqui mudar nada.
   */
  const houses = units.slice(0, 2)
  const digits = houses.map((unit) => (unit.phone ?? '').replace(/\D/g, ''))
  const housePhone =
    houses.length > 0 &&
    digits.every((d) => d !== '' && d === digits[0])
      ? houses[0]!.phone
      : null

  return (
    /*
      O `lang` VIVE AQUI, E NÃO NO <html>.

      O <html> da raiz diz `pt-PT` e fica quieto: é a língua da área da
      equipa, que não se traduz, e mudá-lo obrigava a raiz inteira a ler
      o cookie. A montra, essa, muda de língua — e um leitor de ecrã que
      apanhe texto inglês declarado como português pronuncia-o com
      fonemas portugueses, que é o mesmo que não o ler. O atributo vale
      para a sub-árvore onde é posto; posto aqui, cobre a superfície
      pública inteira e não toca no balcão.
    */
    <div
      lang={LANGUAGE_TAG[language]}
      className="skin-salon flex min-h-screen flex-col bg-[var(--surface)]"
    >
      {/* ------------------------------------------------ cabeçalho --- */}
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-50 border-b border-[var(--line-soft)] backdrop-blur-md',
          hero && 'band-dark',
        )}
        style={{
          background: hero
            ? 'color-mix(in srgb, var(--surface) 74%, transparent)'
            : 'color-mix(in srgb, var(--surface) 85%, transparent)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <LogoSeal size="sm" />
            <span className="display hidden text-[0.8125rem] uppercase tracking-[0.18em] text-[var(--ink)] transition-colors group-hover:text-[var(--accent)] min-[480px]:block sm:text-[0.9375rem]">
              {name}
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-1 sm:gap-4">
            {/*
              «ONDE» E «O QUÊ» SÃO DUAS PERGUNTAS, E CADA UMA TEM A SUA
              PORTA.

              Os serviços viviam escondidos numa aba a meio da página:
              quem chegasse a perguntar o que se faz aqui tinha de rolar
              até lá e adivinhar que a segunda aba era essa. No menu, a
              pergunta responde-se sem rolar nada.
            */}
            {!compact ? (
              <>
                <Link
                  href="/loja"
                  className="link-slide hidden text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] md:block"
                >
                  {dict.nav.stores}
                </Link>
                <Link
                  href="/servicos"
                  className="link-slide hidden text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] md:block"
                >
                  {dict.nav.services}
                </Link>
              </>
            ) : null}

            <Link
              href={client ? '/conta' : '/conta/entrar'}
              className="link-slide hidden text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] sm:block"
            >
              {client ? dict.nav.account : dict.nav.signIn}
            </Link>

            <Suspense fallback={null}>
              <LanguageSwitcher current={language} />
            </Suspense>

            {/* O botão continua com o mesmo ar; só o dedo é que ganha
                mais oito pixéis de altura onde não há rato. */}
            <ButtonLink
              href="/agendar"
              size="sm"
              variant="outline"
              className="ml-1 min-h-11 sm:min-h-0"
            >
              {dict.nav.book}
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main className={clsx('flex-1', !hero && 'pt-16')}>{children}</main>

      {/* --------------------------------------------------- rodapé --- */}
      {/*
        A ESCALA: 8 · 12 · 20 · 32.

        Aqui viviam um `mt-3` cinco vezes, um `mt-6` três, dois `mt-4`,
        um `mt-5`, um `gap-12`, um `pt-16`, um `pt-20` e um `pt-6` —
        cada bloco a escolher o seu espaço a olho, e o resultado a
        ler-se como desarrumação mesmo com o conteúdo certo.

        Quatro degraus, e mais nenhum. O espaço deixa de ser uma decisão
        de cada vez e passa a dizer o quanto duas coisas se pertencem:
        8 entre uma coisa e a legenda dela, 12 entre irmãos de uma
        lista, 20 entre assuntos vizinhos, 32 entre blocos.

        E AS MORADAS SAÍRAM. A secção «onde estamos», na mesma página,
        já dá a morada, o horário de hoje, o «como chegar» e o botão de
        marcar de cada loja. Escrevê-las outra vez aqui — com horários e
        tudo — dava dois ecrãs de rodapé num telemóvel para repetir o
        que estava dois dedos acima. Quem quer a morada tem o «nossas
        lojas» aqui ao lado.
      */}
      {/* --------------------------------------------------- rodapé --- */}
      {/*
        O FECHO, EM OITO COISAS.

        Tinha catorze, e seis delas estavam escritas noutro sítio da
        mesma página: a legenda do convite dizia o que o título já dizia,
        o «fale connosco» duplicava o ícone do WhatsApp, a frase da marca
        está na capa, e o rótulo «navegar» apresentava quatro palavras
        que se apresentam sozinhas. Nada disso desapareceu do site —
        deixou de estar escrito duas vezes.

        O que sobra são três assuntos, por esta ordem: o convite, quem
        somos e como se fala connosco, e por onde se anda. Cabe num ecrã
        de telemóvel, que é o que faz uma página ACABAR em vez de
        continuar a descer.

        O fundo é o `.fundo-casa` do globals.css — o calor da madeira
        sem a fotografia da sala, que competia com o texto.
      */}
      <footer className="band-dark fundo-casa border-t border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-5 pb-6 pt-12 sm:px-8 sm:pt-14">
          {/* O convite abre o fecho — mas nunca dentro do funil. */}
          <FooterInvite>
            <div className="pb-9 text-center">
              <h2 className="display text-balance text-[1.375rem] leading-tight sm:text-[2rem]">
                {dict.home.finalTitle1}{' '}
                <span className="display-italic text-[var(--accent)]">
                  {dict.home.finalTitleItalic}
                </span>
                {dict.home.finalTitle2}
              </h2>
              <div className="mt-5">
                <ButtonLink href="/agendar" size="lg">
                  {dict.home.cta}
                </ButtonLink>
              </div>
            </div>
            <div className="mb-9 h-px bg-[var(--line-soft)]" />
          </FooterInvite>

          <div className="grid gap-7 sm:grid-cols-2 sm:items-start sm:gap-12">
            <div>
              {/* O selo ao lado do nome, e não por cima: eram duas
                  linhas para dizer uma coisa. */}
              <div className="flex items-center gap-3.5">
                <LogoSeal />
                <p className="display text-[0.8125rem] uppercase leading-snug tracking-[0.18em] text-[var(--ink)]">
                  {name}
                </p>
              </div>

              {/*
                O NÚMERO E OS ÍCONES SÃO O MESMO ASSUNTO.

                As maneiras de falar com a casa. Estavam em linhas
                separadas, com o número a parecer um título e os ícones
                uma secção; a par, leem-se como o que são.
              */}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                {housePhone ? (
                  <a
                    href={`tel:${housePhone.replace(/\s/g, '')}`}
                    className="display toque tabular text-[1.25rem] text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                  >
                    {formatPhone(housePhone)}
                  </a>
                ) : null}

                <div className="flex items-center gap-2.5">
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={dict.footer.whatsapp}
                      title={dict.footer.whatsapp}
                      className="toque grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                        aria-hidden
                        className="h-[1.05rem] w-[1.05rem]"
                      >
                        <path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20.5l1.8-5.2A8.5 8.5 0 1 1 21 11.5z" />
                      </svg>
                    </a>
                  ) : null}

                  {BRAND.social.instagram ? (
                    <a
                      href={BRAND.social.instagram}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={dict.footer.instagram}
                      title={dict.footer.instagram}
                      className="toque grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        aria-hidden
                        className="h-[1.05rem] w-[1.05rem]"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            {/*
              OS CAMINHOS NUMA LINHA CORRIDA.

              Eram uma lista de pé com um rótulo por cima — o peso de uma
              secção para um menu de rodapé. Três palavras a par leem-se
              de relance. E o «marcar hora» saiu daqui: o botão grande
              está dez centímetros acima e faz exactamente isso.
            */}
            <nav className="flex flex-wrap gap-x-6 gap-y-2.5 text-[0.8125rem] sm:justify-end">
              {[
                { href: '/loja', label: dict.footer.links.stores },
                { href: '/servicos', label: dict.footer.links.services },
                {
                  href: client ? '/conta' : '/conta/entrar',
                  label: dict.footer.links.account,
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="toque text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line-soft)] pt-4">
            <p className="text-[0.6875rem] text-[var(--ink-muted)]">
              © {year} {BRAND.legalName}
            </p>

            {/*
              A PORTA DA EQUIPA VÊ-SE.

              O «entrar» do cabeçalho é a área da cliente; esta é outra,
              e é a que se abre mais vezes por dia. Fica no rodapé, onde
              uma porta de serviço pertence, mas com contorno e um
              cadeado a dizer de quem é.
            */}
            <Link
              href="/entrar"
              className="toque inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] px-3.5 py-1.5 text-[0.6875rem] font-medium text-[var(--ink-muted)] transition-colors hover:border-[var(--line)] hover:text-[var(--ink)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
                className="h-3 w-3 shrink-0"
              >
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              {dict.footer.staffAccess}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
