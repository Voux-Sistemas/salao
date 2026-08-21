import type { ReactNode } from 'react'
import Link from 'next/link'
import { getOrg } from '@/lib/org'
import { BRAND } from '@/lib/branding'
import { can, requireActor, type Actor } from '@/lib/auth/actor'
import { signOutAction } from '@/app/(auth)/entrar/actions'
import { initial } from '@/lib/text'
import { DeskNav, type NavItem } from '@/components/desk-nav'

/**
 * A moldura da operação: pele clara, densa, sem enfeites. A barra
 * depende do degrau — a profissional vê só a agenda dela.
 *
 * A área da equipa NÃO é traduzida.
 */
export async function DeskChrome({ children }: { children: ReactNode }) {
  const actor = await requireActor()
  const org = await getOrg()

  return (
    <div className="skin-desk flex min-h-screen flex-col bg-[var(--surface)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line-soft)] bg-[var(--surface-raised)]">
        <div className="mx-auto flex h-14 max-w-[110rem] items-center gap-6 px-4 sm:px-6">
          <Link
            href={actor.role === 'professional' ? '/agenda' : '/'}
            className="display shrink-0 text-sm uppercase tracking-[0.16em] text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
          >
            {org?.name ?? BRAND.fallbackName}
          </Link>

          <div className="min-w-0 flex-1">
            <DeskNav items={navFor(actor)} />
          </div>

          <AccountMenu actor={actor} />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}

/**
 * Hoje · Agenda · Avisos · Caixa · Clientes, mais Gestão. A
 * profissional vê só «A minha agenda»: sem caixa, sem clientes, sem
 * gestão.
 */
export function navFor(actor: Actor): NavItem[] {
  if (actor.role === 'professional') {
    return [{ href: '/agenda', label: 'A minha agenda' }]
  }

  const items: NavItem[] = [
    { href: '/', label: 'Hoje' },
    { href: '/agenda', label: 'Agenda' },
  ]
  if (can.seeNotices(actor)) items.push({ href: '/avisos', label: 'Avisos' })
  if (can.seeCash(actor)) items.push({ href: '/caixa', label: 'Caixa' })
  if (can.seeClients(actor)) items.push({ href: '/clientes', label: 'Clientes' })
  items.push({ href: '/admin', label: 'Gestão' })
  return items
}

const ROLE_LABEL = {
  support: 'Suporte',
  owner: 'Dona',
  manager: 'Gerente',
  professional: 'Profissional',
} as const

function AccountMenu({ actor }: { actor: Actor }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-[0.8125rem] text-[var(--ink)]">{actor.name}</p>
        <p className="text-[0.6875rem] uppercase tracking-wide text-[var(--ink-faint)]">
          {ROLE_LABEL[actor.role]}
        </p>
      </div>

      <span
        aria-hidden
        className="display flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[0.8125rem] text-[var(--ink-muted)]"
      >
        {initial(actor.name)}
      </span>

      <form action={signOutAction}>
        <button
          type="submit"
          className="text-[0.75rem] text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
        >
          Sair
        </button>
      </form>
    </div>
  )
}
