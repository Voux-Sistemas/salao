import Link from 'next/link'
import clsx from 'clsx'
import type { Dictionary } from '@/lib/i18n'

/**
 * Quatro passos e um recibo. Os passos já dados são ligações — voltar
 * atrás funciona, porque o que foi escolhido viaja no endereço.
 */
export function FunnelSteps({
  current,
  dict,
  hrefs,
}: {
  current: 1 | 2 | 3 | 4
  dict: Dictionary
  /** Endereço de cada passo já percorrido; null desliga a ligação. */
  hrefs?: (string | null)[]
}) {
  const labels = [
    dict.funnel.steps.store,
    dict.funnel.steps.service,
    dict.funnel.steps.time,
    dict.funnel.steps.confirm,
  ]

  return (
    <ol className="flex items-center gap-2 text-[0.6875rem] tracking-[0.14em] uppercase">
      {labels.map((label, index) => {
        const step = index + 1
        const done = step < current
        const href = done ? (hrefs?.[index] ?? null) : null
        const content = (
          <span
            className={clsx(
              'transition-colors',
              step === current
                ? 'text-[var(--accent)]'
                : done
                  ? 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  : 'text-[var(--ink-faint)]',
            )}
          >
            <span className="tabular">{step}</span>
            <span className="hidden sm:inline"> · {label}</span>
          </span>
        )

        return (
          <li key={label} className="flex items-center gap-2">
            {href ? <Link href={href}>{content}</Link> : content}
            {step < labels.length ? (
              <span aria-hidden className="text-[var(--line)]">
                —
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
