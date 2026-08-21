import Link from 'next/link'
import clsx from 'clsx'
import type { Unit } from '@/lib/org'

/**
 * Nas secções que são por loja, a loja está na barra de endereços e há
 * este seletor em cima. Quem só tem uma loja não vê seletor nenhum.
 */
export function UnitSwitcher({
  units,
  current,
  base,
  allLabel = 'Todas',
  showAll = true,
  suffix = '',
}: {
  units: Unit[]
  /** slug da loja escolhida, ou null quando se está em «Todas». */
  current: string | null
  /** prefixo do endereço, por exemplo `/caixa`. */
  base: string
  allLabel?: string
  showAll?: boolean
  /** o que vem a seguir à loja, por exemplo `/encaixe`. */
  suffix?: string
}) {
  if (units.length < 2) return null

  return (
    <div className="flex items-center gap-1">
      {showAll ? (
        <Tab href={base} active={current === null}>
          {allLabel}
        </Tab>
      ) : null}
      {units.map((unit) => (
        <Tab
          key={unit.id}
          href={`${base}/${unit.slug}${suffix}`}
          active={current === unit.slug}
        >
          {unit.name}
        </Tab>
      ))}
    </div>
  )
}

function Tab({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'rounded-[2px] border px-3 py-1.5 text-[0.8125rem] transition-colors',
        active
          ? 'border-[var(--accent)] text-[var(--accent)]'
          : 'border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--ink-faint)] hover:text-[var(--ink)]',
      )}
    >
      {children}
    </Link>
  )
}
