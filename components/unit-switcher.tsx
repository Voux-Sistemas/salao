import Link from 'next/link'
import clsx from 'clsx'
import type { Unit } from '@/lib/org'

/**
 * Nas secções que são por loja, a loja está na barra de endereços e há
 * este seletor em cima: um comutador segmentado, com um losango dourado
 * a assinalar a casa activa. Quem só tem uma loja não vê seletor nenhum.
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
    <div className="inline-flex items-center gap-[3px] rounded-[2px] border border-[var(--line)] bg-[var(--surface-2)] p-[3px]">
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
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'inline-flex items-center rounded-[1px] px-3 py-1.5 text-[0.8125rem] transition-colors',
        active
          ? 'bg-[var(--surface-raised)] text-[var(--ink)] shadow-[0_1px_3px_rgba(28,25,23,0.1)]'
          : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="mr-1.5 inline-block h-1 w-1 rotate-45 bg-[var(--gold)]"
        />
      ) : null}
      {children}
    </Link>
  )
}
