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
   * O TELEFONE SAIU DAQUI, E NÃO SE PERDEU.
   *
   * Esteve neste rodapé de várias maneiras — em serifa grande, dentro
   * de uma pílula, com ícone à frente — e nenhuma resultou, porque um
   * número geral não é o número de lado nenhum. A ficha de cada loja,
   * na mesma página, dá o número DAQUELA casa; e quem quiser escrever
   * tem o «fale connosco» aqui em baixo, que abre o WhatsApp.
   */

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
        UMA MARGEM SÓ, DO PRINCÍPIO AO FIM.

        Cada bloco daqui estava a usar a largura que lhe apetecia: o nome
        começava na borda, os caminhos espalhavam-se por todo o ecrã com
        um buraco no meio, e a última linha empilhava-se num canto. Nada
        parecia estar ao lado de nada.

        Agora tudo arranca da mesma linha vertical, e só a porta da
        equipa se encosta à direita. O olho passa a ter uma margem
        para seguir em vez de quatro.

        E a página ganha CHÃO. A última linha sai de dentro do castanho
        para uma faixa clara própria: uma página que acaba na mesma banda
        em que estava a conversar continua a descer até acabar o ecrã, e
        esta faixa é o degrau que diz que ali acabou de propósito.
      */}
      <footer>
        <div className="band-dark fundo-casa border-t border-[var(--line-soft)]">
          <div className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-8 sm:pt-14">
            {/* O convite abre o fecho — mas nunca dentro do funil. */}
            <FooterInvite>
              {/*
                O ÚNICO BLOCO AO CENTRO, E DE PROPÓSITO.

                Tudo o resto encosta à esquerda. Este fica ao meio porque
                é o único que fala — um convite ao centro lê-se como um
                convite; alinhado com o resto, ficava a par de um menu.
              */}
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

            {/*
              A MARCA DE UM LADO, OS CAMINHOS DO OUTRO.

              O selo em cima, o nome por baixo, a frase da casa a fechar
              — e ao lado, os caminhos com o seu rótulo. É o empilhamento
              que a casa já tinha, e resulta por uma razão simples: a
              coluna da esquerda precisa de CORPO. Um selo sozinho ao pé
              de quatro linhas não tem o mesmo peso, e a banda fica a
              pender para a direita.

              A frase não é repetição da capa: quem chega a esta página
              pelo Google, direito a um serviço, nunca subiu à capa —
              esta é a única linha do rodapé que diz o que a casa faz.
            */}
            <div className="grid gap-8 sm:grid-cols-2 sm:items-start sm:gap-12">
              <div>
                <LogoSeal size="lg" />

                <p className="display mt-5 text-[0.875rem] uppercase tracking-[0.18em] text-[var(--ink)]">
                  {name}
                </p>
                <p className="mt-2.5 max-w-xs text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                  {dict.footer.tagline}
                </p>
              </div>

              {/*
                OS QUATRO CAMINHOS.

                O «fale connosco» vem primeiro de propósito: é o único
                dos quatro que resolve um problema em vez de mostrar uma
                página. Quem desce até aqui com uma pergunta encontra-o
                antes de tudo o resto — e sai do site para o WhatsApp,
                que é a resposta mais rápida que a casa consegue dar.
              */}
              <nav className="sm:justify-self-end">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">
                  {dict.footer.navLabel}
                </p>

                <div className="mt-4 grid justify-items-start gap-3.5 text-[0.875rem]">
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="toque text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                    >
                      {dict.home.contactCta}
                    </a>
                  ) : null}

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
                </div>
              </nav>
            </div>
          </div>
        </div>

        {/*
          A BASE.

          Fora do castanho, e sem nada de emocional lá dentro: quem
          assina à esquerda, a porta de serviço à direita. É a faixa que
          dá chão à página — e devolve o claro no fim sem trazer de volta
          uma banda vazia.
        */}
        <div className="border-t border-[var(--line-soft)] bg-[var(--surface-2)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5 sm:px-8">
            <p className="text-[0.6875rem] text-[var(--ink-muted)]">
              {/* No telemóvel o nome completo mais o botão não cabem na
                  mesma linha, e uma barra que se parte deixa de ser uma
                  base. O nome curto chega para assinar. */}
              <span className="sm:hidden">© {year} {BRAND.fallbackName}</span>
              <span className="hidden sm:inline">© {year} {BRAND.legalName}</span>
            </p>

            {/*
              A PORTA DA EQUIPA.

              O «entrar» do cabeçalho é a área da cliente; esta é outra, e
              é a que se abre mais vezes por dia. Aqui em baixo, com
              contorno e um cadeado a dizer de quem é — em cima, ao lado
              do outro «entrar», eram duas portas parecidas a levar a
              sítios diferentes.
            */}
            <Link
              href="/entrar"
              className="toque inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[0.6875rem] font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
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
