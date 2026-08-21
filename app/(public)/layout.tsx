import { PublicChrome } from '@/components/public-chrome'

// Estas páginas lêem o estado da casa a cada pedido: horários, preços,
// disponibilidade. Nada disto pré-renderiza.
export const dynamic = 'force-dynamic'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PublicChrome>{children}</PublicChrome>
}
