'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { LANGUAGES, LANGUAGE_LABEL, LANGUAGE_SHORT, type Language } from '@/lib/i18n/config'

/**
 * A LÍNGUA, EM PEQUENO: «PT ⌄», e ao tocar abre as três.
 *
 * Eram as três siglas sempre à vista — «PT · EN · ES» — ao lado dos
 * botões, na mesma cor de tudo o resto, e o cabeçalho lia-se como uma
 * fila de coisas iguais. Quem muda de língua fá-lo uma vez; o resto das
 * visitas é só ocupar lugar. Fica a sigla da língua de agora, e a lista
 * abre por baixo com os nomes por extenso.
 *
 * É um <details>: abre e fecha sem JavaScript. O efeito só serve para o
 * fechar quando se toca fora dele, que é o que toda a gente espera.
 *
 * Cada língua continua a ser uma ligação para /idioma, com a página de
 * volta no `next`: mudar de língua não perde o sítio onde se estava.
 */
export function LanguageSwitcher({ current }: { current: Language }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const menu = useRef<HTMLDetailsElement>(null)

  const query = params.toString()
  const next = query ? `${pathname}?${query}` : pathname

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const el = menu.current
      if (el?.open && !el.contains(event.target as Node)) el.open = false
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <details ref={menu} className="group relative">
      <summary
        aria-label={LANGUAGE_LABEL[current]}
        className="flex min-h-11 cursor-pointer list-none items-center gap-0.5 px-1.5 text-[0.6875rem] tracking-[0.14em] text-[var(--ink-muted)] uppercase transition-colors select-none hover:text-[var(--ink)] sm:min-h-0 sm:py-1 [&::-webkit-details-marker]:hidden"
      >
        {LANGUAGE_SHORT[current]}
        <ChevronDown
          size={11}
          strokeWidth={2.2}
          aria-hidden
          className="transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="absolute top-full right-0 z-10 mt-1.5 flex w-40 flex-col rounded-[14px] bg-[#FBF8F1] p-1.5 text-[0.84375rem] text-[#221D17] shadow-[0_0_0_1px_rgba(34,29,23,0.06),0_14px_32px_-16px_rgba(34,29,23,0.35)]">
        {LANGUAGES.map((language) => {
          const active = language === current
          return (
            <a
              key={language}
              href={`/idioma?lang=${language}&next=${encodeURIComponent(next)}`}
              hrefLang={language}
              aria-current={active ? 'true' : undefined}
              className={clsx(
                'flex h-9 items-center justify-between rounded-[9px] px-2.5 transition-colors',
                active ? 'bg-[rgba(198,169,107,0.12)] font-medium' : 'hover:bg-[rgba(34,29,23,0.04)]',
              )}
            >
              {LANGUAGE_LABEL[language]}
              {active ? <Check size={13} strokeWidth={2.2} className="text-[#8E6F41]" aria-hidden /> : null}
            </a>
          )
        })}
      </div>
    </details>
  )
}
