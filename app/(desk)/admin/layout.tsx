import type { ReactNode } from 'react'
import { can, requireManagement } from '@/lib/auth/actor'
import { DeskNav, type NavItem } from '@/components/desk-nav'

/**
 * GESTÃO: Unidades · Serviços · Comissões · Equipa.
 *
 * As três primeiras são da dona — são decisões de rede. A Equipa
 * também a gerente pode mexer, mas só nas lojas dela. O que a pessoa
 * não pode gerir nem sequer aparece. A raiz (/admin) é o painel: a
 * rede em números antes de qualquer decisão.
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
    // Mais largo do que o resto do balcão de propósito: um painel de
    // controlo compara colunas, e a 5xl a grelha de quatro indicadores
    // ficava com cartões da largura de um botão.
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <div className="mb-4">
          <h1 className="display text-[1.75rem] leading-none text-[var(--ink)]">
            Gestão
          </h1>
          <p className="mt-2 text-[0.8125rem] text-[var(--ink-muted)]">
            A rede em números — e as portas por onde se muda o que eles
            dizem.
          </p>
        </div>
        <DeskNav items={tabs} />
      </header>
      {children}
    </div>
  )
}
