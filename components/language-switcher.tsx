'use client'

import { Fragment } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { LANGUAGES, LANGUAGE_LABEL, LANGUAGE_SHORT, type Language } from '@/lib/i18n/config'

/**
 * Três links, um cookie. Guarda o caminho actual — INCLUINDO a barra de
 * endereço — para que trocar de língua a meio do funil não perca o que
 * já foi escolhido.
 *
 * ÂNCORAS SIMPLES, NÃO <Link>. E é aqui que isto se decide.
 *
 * O `/idioma` não é uma página: é um atendedor que grava o cookie e
 * devolve a visita para onde estava. Com um <Link>, quem seguia o
 * desvio era o encaminhador do lado do navegador — e esse já tinha a
 * página de destino guardada em memória, desenhada ANTES de o cookie
 * existir. O cookie ficava gravado, o servidor passava a responder na
 * língua nova, e o ecrã continuava em português até a visita mudar de
 * página outra vez. Ou seja: o selector parecia partido, e a segunda
 * vez é que funcionava.
 *
 * Uma âncora normal faz o navegador ir buscar o documento inteiro. Não
 * há memória velha para servir, e a língua muda ao primeiro toque.
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
          <a
            href={`/idioma?lang=${language}&next=${encodeURIComponent(next)}`}
            hrefLang={language}
            aria-current={language === current ? 'true' : undefined}
            title={LANGUAGE_LABEL[language]}
            className={clsx(
              // Três letras minúsculas dão um alvo de 30x25 — mais pequeno
              // que a ponta de um polegar. A caixa de toque cresce para os
              // 44px de altura ao telemóvel sem a letra crescer com ela; no
              // monitor, onde há rato, volta ao aperto de sempre.
              'inline-flex min-h-11 items-center px-2 text-[0.6875rem] uppercase tracking-[0.16em] transition-colors sm:min-h-0 sm:px-1.5 sm:py-1',
              language === current
                ? 'text-[var(--accent)]'
                : 'text-[var(--ink-faint)] hover:text-[var(--ink)]',
            )}
          >
            {LANGUAGE_SHORT[language]}
          </a>
        </Fragment>
      ))}
    </div>
  )
}
