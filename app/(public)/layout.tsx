import { PublicChrome } from '@/components/public-chrome'
import { getActor } from '@/lib/auth/actor'
import { closedFor } from '@/lib/maintenance'
import { getOrg } from '@/lib/org'
import { MaintenanceScreen } from '@/components/maintenance-screen'

// Estas páginas lêem o estado da casa a cada pedido: horários, preços,
// disponibilidade. Nada disto pré-renderiza.
export const dynamic = 'force-dynamic'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  /*
   * A CASA FECHADA PARA OBRAS TRAVA AQUI, E NÃO EM CADA PÁGINA.
   *
   * É a montra, o funil de marcação e a área da cliente — tudo o que
   * está por baixo deste layout. Trava-se em cima porque uma marcação a
   * meio é precisamente o que se quer evitar: se cada página decidisse
   * por si, bastava uma esquecer-se para a porta ficar entreaberta.
   *
   * Quem monta o sistema atravessa; o `closedFor` é que sabe disso.
   */
  const state = await closedFor(await getActor())
  if (state) {
    const org = await getOrg()
    return <MaintenanceScreen state={state} phone={org?.whatsapp_phone ?? null} />
  }

  return <PublicChrome>{children}</PublicChrome>
}
