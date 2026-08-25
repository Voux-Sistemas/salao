import type { Metadata } from 'next'
import { DeskChrome } from '@/components/desk-chrome'
import { getActor } from '@/lib/auth/actor'
import { closedFor, maintenance } from '@/lib/maintenance'
import {
  MaintenanceBanner,
  MaintenanceScreen,
} from '@/components/maintenance-screen'

// A operação lê o estado da casa a cada pedido. Nada pré-renderiza.
export const dynamic = 'force-dynamic'

/*
 * A área da equipa não é um sítio público. Isto desce a todas as páginas
 * de baixo — cada uma continua a pôr o seu próprio título por cima.
 *
 * Não é segurança: quem entra sem senha é travado pela sessão, não por
 * uma etiqueta. É higiene — evita que um dia o nome de uma cliente
 * apareça numa pesquisa por causa de um endereço que alguém partilhou.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DeskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  /*
   * O BALCÃO FECHA COM O RESTO.
   *
   * A casa em obras fecha para toda a gente, e a equipa é «toda a
   * gente» — é justamente para ninguém mexer enquanto se mexe. Quem
   * monta o sistema atravessa, e leva uma faixa em cima para não se
   * esquecer de que a deixou fechada.
   */
  const actor = await getActor()
  const state = await closedFor(actor)
  if (state) return <MaintenanceScreen state={state} />

  const open = actor?.role === 'master' ? await maintenance() : null

  return (
    <>
      {open?.since ? <MaintenanceBanner since={open.since} /> : null}
      <DeskChrome>{children}</DeskChrome>
    </>
  )
}
