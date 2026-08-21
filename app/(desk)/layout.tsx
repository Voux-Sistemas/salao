import { DeskChrome } from '@/components/desk-chrome'

// A operação lê o estado da casa a cada pedido. Nada pré-renderiza.
export const dynamic = 'force-dynamic'

export default function DeskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DeskChrome>{children}</DeskChrome>
}
