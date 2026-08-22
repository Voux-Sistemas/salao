import type { Metadata } from 'next'
import { DeskChrome } from '@/components/desk-chrome'

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

export default function DeskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DeskChrome>{children}</DeskChrome>
}
