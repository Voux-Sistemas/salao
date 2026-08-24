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
 *   bar     controlo segmentado (sub-navegação, ex.: Gestão)
 *   rail    a coluna estreita do balcão, ícone em cima do rótulo
 *   bottom  a barra fixa do fundo, no telemóvel
 *
 * ONDE SE ESTÁ MARCA-SE COM FORMA, NÃO SÓ COM COR. Antes era um fio de
 * dois píxeis ao lado do ícone e a palavra em versaletes espaçados —
 * lia-se como um índice de livro, e num ecrã a que se volta cinquenta
 * vezes por dia o sítio onde se está tem de saltar à vista sem procura.
 * Agora o item aceso é um bloco com fundo próprio: reconhece-se pela
 * mancha, antes de se ler seja o que for.
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
      <nav className="flex w-full flex-col gap-0.5 px-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon ? ICONS[item.icon] : IconDay
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex w-full flex-col items-center gap-1 rounded-[var(--radius-sm)] py-2.5 transition-colors',
                active
                  ? 'bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-[var(--accent)]'
                  : 'text-[var(--ink-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
              )}
            >
              <Icon className="h-[1.3rem] w-[1.3rem]" />
              <span className="max-w-full truncate px-0.5 text-[0.625rem] font-semibold">
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
        <div className="flex min-h-[4.25rem] items-stretch justify-around px-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon ? ICONS[item.icon] : IconDay
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2.5 transition-colors',
                  active ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]',
                )}
              >
                {/* A pastilha por trás do ícone é o que diz onde se está.
                    Ocupa altura fixa esteja acesa ou não, para os rótulos
                    de todas as portas ficarem na mesma linha. */}
                <span
                  className={clsx(
                    'flex h-7 w-14 items-center justify-center rounded-full transition-colors',
                    active
                      ? 'bg-[color-mix(in_srgb,var(--accent)_13%,transparent)]'
                      : 'bg-transparent',
                  )}
                >
                  <Icon className="h-[1.3rem] w-[1.3rem]" />
                </span>
                <span
                  className={clsx(
                    'max-w-full truncate px-1 text-[0.625rem]',
                    active ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {item.short ?? item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  /*
   * O controlo segmentado. Os separadores vivem dentro de uma caixa
   * afundada e o que está aberto sobe ao branco — é o gesto que toda a
   * gente já conhece dos telemóveis, e diz «uma destas» sem precisar de
   * legenda. `w-max` porque a caixa tem de ser do tamanho dos
   * separadores, não da largura toda: esticada, o fundo afundado
   * atravessava a página como uma tarja.
   */
  return (
    <div className="-mx-1 overflow-x-auto px-1 py-0.5">
      <nav className="flex w-max items-center gap-1 rounded-[var(--radius)] bg-[var(--surface-2)] p-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-[0.8125rem] font-medium transition-all',
                active
                  ? 'bg-[var(--surface-raised)] text-[var(--ink)] shadow-[0_1px_2px_rgba(15,21,32,0.10)]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
