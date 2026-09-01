import type { ReactNode } from 'react'
import { can, requireGestao } from '@/lib/auth/actor'
import { DeskNav, type NavItem } from '@/components/desk-nav'

/**
 * GESTÃO: Unidades · Serviços · Equipa.
 *
 * As duas primeiras são da dona — são decisões de rede. A Equipa
 * também a gerente pode mexer, mas só nas lojas dela. O que a pessoa
 * não pode gerir nem sequer aparece. A raiz (/admin) é o painel: a
 * rede em números antes de qualquer decisão.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const actor = await requireGestao()

  /*
    O PAINEL É UM SEPARADOR COMO OS OUTROS.

    Faltava aqui, e o controlo segmentado abria sem nenhum segmento
    aceso — que é o desenho de uma coisa avariada. Pior: entrada nos
    Serviços, não havia porta de volta aos números senão pela coluna
    da esquerda. Está primeiro porque é a raiz e porque é por onde se
    entra: vê-se como vai a casa, e só depois se muda alguma coisa.
  */
  const tabs: NavItem[] = [{ href: '/admin', label: 'Painel' }]
  if (can.manageUnits(actor)) {
    tabs.push({ href: '/admin/unidades', label: 'Unidades' })
  }
  if (can.manageCatalog(actor)) {
    tabs.push({ href: '/admin/servicos', label: 'Serviços' })
  }
  if (can.manageTeam(actor)) {
    tabs.push({ href: '/admin/equipe', label: 'Equipa' })
  }
  /* O balcão é da dona: é o login DELA que fica no tablet, e são os
     aparelhos DELA que a página lista. A gerente não tem nada aqui. */
  if (can.manageCatalog(actor)) {
    tabs.push({ href: '/admin/balcao', label: 'Balcão' })
  }
  /* Por último, e só para quem monta o sistema: é a porta que a dona
     não precisa de saber que existe. */
  if (can.manageMasters(actor)) {
    tabs.push({ href: '/admin/sistema', label: 'Sistema' })
  }

  return (
    // Mais largo do que o resto do balcão de propósito: um painel de
    // controlo compara colunas, e a 5xl a grelha de quatro indicadores
    // ficava com cartões da largura de um botão.
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/*
        A moldura diz só onde se está — «Gestão» e as portas. A frase
        que estava aqui («a rede em números») descrevia o painel, e
        aparecia por cima da Equipa e dos Serviços a falar de outra
        coisa. Cada página passa a trazer a sua, junto ao título dela.
      */}
      <header className="surge mb-6">
        <div className="mb-5">
          <h1 className="display text-[1.75rem] leading-none text-[var(--ink)]">
            Gestão
          </h1>
          <span aria-hidden className="fio-casa mt-3" />
        </div>
        <DeskNav items={tabs} />
      </header>
      {children}
    </div>
  )
}
