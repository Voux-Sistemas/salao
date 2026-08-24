import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { expectedCents, loadMovements, openSession } from '@/lib/cash'
import { formatCents } from '@/lib/money'
import { Empty } from '@/components/ui'
import { StoreChooser } from '@/components/store-chooser'

export const metadata: Metadata = { title: 'Caixa' }

/** Sem loja no endereço isto é um seletor — e diz já quem está aberta. */
export default async function CaixaChooser() {
  const actor = await requireManagement()
  const units = await unitsFor(actor)

  const only = units[0]
  if (units.length === 1 && only) redirect(`/caixa/${only.slug}`)

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

  const drawers = await Promise.all(
    units.map(async (unit) => {
      const session = await openSession(unit.id)
      if (!session) return { unit, open: false, cents: 0 }
      const movements = await loadMovements(session.id)
      return { unit, open: true, cents: expectedCents(session, movements) }
    }),
  )

  return (
    <StoreChooser
      title="Caixa"
      hint="Cada loja tem a sua gaveta, o seu dia e o seu fecho."
      cta="Abrir a gaveta"
      stores={drawers.map(({ unit, open, cents }) => ({
        href: `/caixa/${unit.slug}`,
        name: unit.name,
        meta: unit.city ?? unit.address_line ?? unit.timezone,
        badge: { label: open ? 'Aberta' : 'Fechada', tone: open ? 'ok' : 'neutral' },
        line: open
          ? `Na gaveta, esperado ${formatCents(cents)}`
          : 'Por abrir hoje.',
      }))}
    />
  )
}
