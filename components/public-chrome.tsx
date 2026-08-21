import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { getOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { getClientActor } from '@/lib/auth/client-actor'
import { BRAND } from '@/lib/branding'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ButtonLink } from '@/components/ui'

/**
 * A moldura da superfície da cliente: pele escura, serifada, com o
 * botão de marcar sempre à vista. É o mesmo cabeçalho da montra, da
 * página da loja e do funil.
 */
export async function PublicChrome({
  children,
  compact = false,
}: {
  children: ReactNode
  compact?: boolean
}) {
  const [org, dict, language, client] = await Promise.all([
    getOrg(),
    getDictionary(),
    getLanguage(),
    getClientActor(),
  ])

  const name = org?.name ?? BRAND.fallbackName

  return (
    <div className="skin-salon min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="display text-[1.0625rem] sm:text-lg tracking-[0.14em] uppercase text-[var(--ink)] hover:text-[var(--accent)] transition-colors"
          >
            {name}
          </Link>

          <nav className="flex items-center gap-1 sm:gap-3">
            {!compact ? (
              <Link
                href="/loja"
                className="hidden sm:block px-2 text-[0.8125rem] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
              >
                {dict.nav.stores}
              </Link>
            ) : null}

            <Link
              href={client ? '/conta' : '/conta/entrar'}
              className="px-2 text-[0.8125rem] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
            >
              {client ? dict.nav.account : dict.nav.signIn}
            </Link>

            <Suspense fallback={null}>
              <LanguageSwitcher current={language} />
            </Suspense>

            <ButtonLink href="/agendar" size="sm" className="ml-1 sm:ml-2">
              {dict.nav.book}
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--line-soft)] mt-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="display text-sm tracking-[0.14em] uppercase text-[var(--ink-muted)]">
            {name}
          </p>
          <div className="flex items-center gap-5 text-[0.75rem] text-[var(--ink-faint)]">
            <Link href="/loja" className="hover:text-[var(--ink-muted)] transition-colors">
              {dict.nav.stores}
            </Link>
            <Link href="/agendar" className="hover:text-[var(--ink-muted)] transition-colors">
              {dict.nav.book}
            </Link>
            <Link href="/entrar" className="hover:text-[var(--ink-muted)] transition-colors">
              Equipa
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
