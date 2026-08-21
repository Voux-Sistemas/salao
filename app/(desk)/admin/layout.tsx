import type { ReactNode } from 'react'
import { can, requireManagement } from '@/lib/auth/actor'
import { DeskNav, type NavItem } from '@/components/desk-nav'

/**
 * GESTÃO: Unidades · Serviços · Comissões · Equipa.
 *
 * As três primeiras são da dona — são decisões de rede. A Equipa
 * também a gerente pode mexer, mas só nas lojas dela. O que a pessoa
 * não pode gerir nem sequer aparece.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const actor = await requireManagement()

  const tabs: NavItem[] = []
  if (can.manageUnits(actor)) {
    tabs.push({ href: '/admin/unidades', label: 'Unidades' })
  }
  if (can.manageCatalog(actor)) {
    tabs.push({ href: '/admin/servicos', label: 'Serviços' })
  }
  if (can.manageCommissions(actor)) {
    tabs.push({ href: '/admin/comissoes', label: 'Comissões' })
  }
  if (can.manageTeam(actor)) {
    tabs.push({ href: '/admin/equipe', label: 'Equipa' })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-[var(--line-soft)] pb-2">
        <h1 className="display mb-3 text-2xl text-[var(--ink)]">Gestão</h1>
        <DeskNav items={tabs} />
      </header>
      {children}
    </div>
  )
}
