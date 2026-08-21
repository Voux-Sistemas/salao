import Link from 'next/link'
import clsx from 'clsx'
import type { ComponentProps, ReactNode } from 'react'

/**
 * As peças de que o resto do sistema é feito. Escritas uma vez, servem
 * as duas peles (.skin-salon e .skin-desk) porque só falam pelos nomes
 * das fichas de cor — nunca por cores literais.
 */

// ---------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------

type Variant = 'primary' | 'outline' | 'quiet' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors ' +
  'disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap'

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] rounded-[2px]',
  md: 'h-10 px-5 text-sm rounded-[2px]',
  lg: 'h-12 px-7 text-[0.9375rem] rounded-[2px] tracking-wide',
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]',
  outline:
    'border border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
  quiet:
    'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-sunken)]',
  danger:
    'border border-[color-mix(in_srgb,var(--bad)_40%,transparent)] text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]',
}

export function buttonClass(
  variant: Variant = 'primary',
  size: Size = 'md',
  className?: string,
) {
  return clsx(BASE, SIZES[size], VARIANTS[variant], className)
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

// ---------------------------------------------------------------------
// Superfícies
// ---------------------------------------------------------------------

export function Card({
  className,
  children,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={clsx(
        'bg-[var(--surface-raised)] border border-[var(--line-soft)] rounded-[2px]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('eyebrow', className)}>{children}</p>
}

export function Divider({ className }: { className?: string }) {
  return <div className={clsx('rule my-8', className)} />
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="text-center py-16 px-6">
      <p className="display text-xl text-[var(--ink)]">{title}</p>
      {hint ? (
        <p className="mt-2 text-sm text-[var(--ink-muted)] max-w-sm mx-auto">{hint}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[0.8125rem] font-medium text-[var(--ink)]"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[0.75rem] text-[var(--bad)]">{error}</p>
      ) : hint ? (
        <p className="text-[0.75rem] text-[var(--ink-muted)]">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL =
  'w-full bg-[var(--surface)] border border-[var(--line)] rounded-[2px] px-3 ' +
  'text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] ' +
  'focus:border-[var(--accent)] transition-colors'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={clsx(CONTROL, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={clsx(CONTROL, 'py-2 min-h-24', className)} {...props} />
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={clsx(CONTROL, 'h-10 appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  )
}

// ---------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad'

const TONES: Record<Tone, string> = {
  neutral: 'border-[var(--line)] text-[var(--ink-muted)]',
  accent: 'border-[var(--accent)] text-[var(--accent)]',
  ok: 'border-[color-mix(in_srgb,var(--ok)_45%,transparent)] text-[var(--ok)]',
  warn: 'border-[color-mix(in_srgb,var(--warn)_45%,transparent)] text-[var(--warn)]',
  bad: 'border-[color-mix(in_srgb,var(--bad)_45%,transparent)] text-[var(--bad)]',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 border rounded-[2px] px-1.5 py-0.5',
        'text-[0.6875rem] tracking-wide uppercase',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------
// Mensagens de resultado de uma acção
// ---------------------------------------------------------------------

export function Notice({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  const colour = {
    neutral: 'var(--ink-muted)',
    accent: 'var(--accent)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
  }[tone]

  return (
    <p
      className="text-sm px-3 py-2 rounded-[2px] border"
      style={{
        color: colour,
        borderColor: `color-mix(in srgb, ${colour} 35%, transparent)`,
        background: `color-mix(in srgb, ${colour} 8%, transparent)`,
      }}
    >
      {children}
    </p>
  )
}
