import type { ReactNode } from 'react'
import { LogoSeal, Ornament } from '@/components/brand'

/**
 * A PORTA.
 *
 * As duas telas de entrada — pedir o código e confirmá-lo — são a mesma
 * moldura: o logótipo em cima, um bilhete em porcelana ao centro com o
 * fio dourado na aresta, e o ornamento a fechar. Nada mais compete com
 * o campo que ela tem de preencher.
 */
export function Gate({
  eyebrow,
  title,
  subtitle,
  meta,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  subtitle: string
  /** Uma linha discreta entre o subtítulo e o formulário. */
  meta?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-[78vh] items-center justify-center px-5 py-14 sm:py-20">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <LogoSeal size="lg" className="animate-bloom" />
        </div>

        <div className="animate-rise delay-1 mt-7 border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-warm)]">
          <div className="h-1 bg-[var(--accent)]" />

          <div className="px-6 py-9 sm:px-9 sm:py-10">
            <p className="eyebrow text-center">{eyebrow}</p>
            <h1 className="display mt-2.5 text-center text-[1.6rem] leading-tight text-[var(--ink)] sm:text-[1.85rem]">
              {title}
            </h1>
            <p className="mx-auto mt-3 max-w-[19rem] text-center text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
              {subtitle}
            </p>

            {meta ? <div className="mt-4 text-center">{meta}</div> : null}

            <div className="mt-8">{children}</div>
          </div>
        </div>

        <div className="animate-fade delay-3 mt-9 flex justify-center text-[var(--line)]">
          <Ornament />
        </div>

        {footer ? (
          <div className="animate-fade delay-3 mt-5 text-center">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
