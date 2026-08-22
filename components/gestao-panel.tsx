import Link from 'next/link'
import clsx from 'clsx'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui'

/**
 * AS PEÇAS DOS ECRÃS DE GESTÃO.
 *
 * Cada assunto vive num cartão com título em serifa e uma linha de
 * explicação — a página deixa de ser uma pilha de caixas iguais e
 * passa a ler-se como um índice. Servem o servidor e o cliente.
 */

/** Cartão de secção: título display pequeno + descrição em --ink-muted. */
export function Panel({
  title,
  hint,
  aside,
  flush = false,
  className,
  children,
}: {
  title: string
  hint?: string
  /** Canto direito do cabeçalho — um total, uma ligação. */
  aside?: ReactNode
  /** Sem acolchoado no corpo — para listas que trazem o seu. */
  flush?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={clsx('overflow-hidden', className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--line-soft)] px-5 pb-3.5 pt-4 sm:px-6">
        <div className="min-w-0">
          <h3 className="display text-lg text-[var(--ink)]">{title}</h3>
          {hint ? (
            <p className="mt-0.5 max-w-2xl text-[0.75rem] leading-relaxed text-[var(--ink-muted)]">
              {hint}
            </p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      {flush ? children : <div className="px-5 py-5 sm:px-6">{children}</div>}
    </Card>
  )
}

/** Cabeçalho de página: título display, uma linha, e o CTA à direita. */
export function PageIntro({
  title,
  lead,
  action,
}: {
  title: string
  lead?: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h2 className="display text-[1.75rem] leading-tight text-[var(--ink)]">
          {title}
        </h2>
        {lead ? (
          <p className="mt-1 max-w-2xl text-[0.8125rem] text-[var(--ink-muted)]">
            {lead}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
    </header>
  )
}

/** Regresso à lista, sempre com a mesma voz. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
    >
      <ArrowLeft size={14} />
      {label}
    </Link>
  )
}

/** Linha de cabeçalho de uma tabela de gestão. */
export function TableHeader({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={clsx(
        'hidden items-center gap-x-4 px-5 py-2.5 sm:grid sm:px-6',
        'text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
