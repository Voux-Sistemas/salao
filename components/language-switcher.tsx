'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { LANGUAGES, LANGUAGE_LABEL, LANGUAGE_SHORT, type Language } from '@/lib/i18n/config'

/**
 * Três links, um cookie. Guarda o caminho actual — INCLUINDO a barra de
 * endereço — para que trocar de língua a meio do funil não perca o que
 * já foi escolhido.
 */
export function LanguageSwitcher({ current }: { current: Language }) {
  const pathname = usePathname()
  const params = useSearchParams()

  const query = params.toString()
  const next = query ? `${pathname}?${query}` : pathname

  return (
    <div className="flex items-center" role="group" aria-label={LANGUAGE_LABEL[current]}>
      {LANGUAGES.map((language, index) => (
        <Fragment key={language}>
          {index > 0 ? (
            <span aria-hidden className="text-[0.625rem] text-[var(--ink-faint)]">
              ·
            </span>
          ) : null}
          <Link
            href={`/idioma?lang=${language}&next=${encodeURIComponent(next)}`}
            hrefLang={language}
            aria-current={language === current ? 'true' : undefined}
            title={LANGUAGE_LABEL[language]}
            className={clsx(
              'px-1.5 py-1 text-[0.6875rem] uppercase tracking-[0.16em] transition-colors',
              language === current
                ? 'text-[var(--accent)]'
                : 'text-[var(--ink-faint)] hover:text-[var(--ink)]',
            )}
          >
            {LANGUAGE_SHORT[language]}
          </Link>
        </Fragment>
      ))}
    </div>
  )
}
