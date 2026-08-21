'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

export type NavItem = { href: string; label: string }

/**
 * A barra da operação. Sublinha a secção onde se está — a comparação é
 * pelo primeiro segmento, porque `/agenda/estufa/comanda/…` continua a
 * ser Agenda.
 */
export function DeskNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={clsx(
            'relative whitespace-nowrap px-3 py-2 text-[0.8125rem] transition-colors',
            isActive(pathname, item.href)
              ? 'text-[var(--ink)] after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-[var(--accent)]'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
