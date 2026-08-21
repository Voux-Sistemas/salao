import { redirect } from 'next/navigation'
import { getOrg } from '@/lib/org'
import { getActor, unitsFor } from '@/lib/auth/actor'
import { PublicChrome } from '@/components/public-chrome'
import { DeskChrome } from '@/components/desk-chrome'
import { Showcase } from '@/components/showcase'
import { DayPanel } from '@/components/day-panel'

export const dynamic = 'force-dynamic'

/**
 * A raiz é DUAS COISAS: a montra para quem não tem sessão, e o painel
 * do dia para quem tem. A profissional não tem painel — cai na agenda
 * dela, que é a casa dela.
 */
export default async function Home() {
  const org = await getOrg()
  // Sem rede criada, o sistema está por instalar.
  if (!org) redirect('/comecar')

  const actor = await getActor()

  if (!actor) {
    return (
      <PublicChrome>
        <Showcase org={org} />
      </PublicChrome>
    )
  }

  if (actor.role === 'professional') redirect('/agenda')

  const units = await unitsFor(actor)

  return (
    <DeskChrome>
      <DayPanel actor={actor} org={org} units={units} />
    </DeskChrome>
  )
}
