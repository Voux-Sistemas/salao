'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  IconAgenda,
  IconBell,
  IconCash,
  IconClients,
  IconDay,
  IconManage,
} from '@/components/desk-icons'

const ICONS = {
  hoje: IconDay,
  agenda: IconAgenda,
  avisos: IconBell,
  caixa: IconCash,
  clientes: IconClients,
  gestao: IconManage,
} as const

export type NavIconName = keyof typeof ICONS

export type NavItem = {
  href: string
  label: string
  /** Glifo para as barras com ícone (rail e bottom). */
  icon?: NavIconName
  /** Rótulo curto para caber debaixo do ícone. */
  short?: string
}

/**
 * A navegação da operação, em três encarnações:
 *
 *   bar     fita horizontal de texto (sub-navegação, ex.: Gestão)
 *   rail    a coluna estreita do balcão, ícone em cima do rótulo
 *   bottom  a barra fixa do fundo, no telemóvel
 *
 * A comparação é pelo primeiro segmento: `/agenda/chiado/...` continua
 * a ser Agenda.
 */
export function DeskNav({
  items,
  variant = 'bar',
}: {
  items: NavItem[]
  variant?: 'bar' | 'rail' | 'bottom'
}) {
  const pathname = usePathname()

  if (variant === 'rail') {
    return (
      <nav className="flex w-full flex-col">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon ? ICONS[item.icon] : IconDay
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative flex w-full flex-col items-center gap-1.5 py-3.5 transition-colors',
                active
                  ? 'text-[var(--accent-strong)]'
                  : 'text-[var(--ink-faint)] hover:text-[var(--ink)]',
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-9 w-[2px] -translate-y-1/2 bg-[var(--accent)]"
                />
              ) : null}
              <Icon className="h-[1.35rem] w-[1.35rem]" />
              <span className="text-[0.5625rem] font-medium uppercase tracking-[0.1em]">
                {item.short ?? item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    )
  }

  if (variant === 'bottom') {
    return (
      // A folga do indicador do iPhone vai por fora da fila de ícones: a
      // barra cresce por baixo, em vez de espremer os rótulos.
      <nav style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex min-h-[4.5rem] items-stretch justify-around">
          {items.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon ? ICONS[item.icon] : IconDay
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2.5 transition-colors',
                  active
                    ? 'text-[var(--accent-strong)]'
                    : 'text-[var(--ink-faint)]',
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-0 h-[2px] w-9 bg-[var(--accent)]"
                  />
                ) : null}
                <Icon className="h-[1.3rem] w-[1.3rem]" />
                <span className="max-w-full truncate px-1 text-[0.5625rem] font-medium uppercase tracking-[0.08em]">
                  {item.short ?? item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

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
