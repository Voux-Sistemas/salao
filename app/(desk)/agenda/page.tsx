import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireActor, unitsFor } from '@/lib/auth/actor'
import { listUnitCovers } from '@/lib/org'
import { Empty } from '@/components/ui'
import { StoreChooser } from '@/components/store-chooser'

export const metadata: Metadata = { title: 'Agenda' }

/**
 * O ecrã sem loja é um SELETOR, não um ecrã vazio. Quem só tem uma
 * loja nunca chega a vê-lo.
 */
export default async function AgendaChooser() {
  const actor = await requireActor()
  const units = await unitsFor(actor)

  const only = units[0]
  if (units.length === 1 && only) redirect(`/agenda/${only.slug}`)

  if (units.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Empty
          title="Sem lojas"
          hint="Ainda não há loja atribuída a esta conta. Fale com quem gere a rede."
        />
      </div>
    )
  }

  // A capa de cada casa numa consulta só, e não uma por ficha.
  const covers = await listUnitCovers()

  return (
    <StoreChooser
      title="Agenda"
      hint="Em que casa quer entrar? O dia de cada uma corre no fuso da casa."
      cta="Ver o dia"
      stores={units.map((unit) => ({
        href: `/agenda/${unit.slug}`,
        name: unit.name,
        meta: unit.city ?? unit.address_line ?? unit.timezone,
        photo: covers.get(unit.id) ?? null,
      }))}
    />
  )
}
