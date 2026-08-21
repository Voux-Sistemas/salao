import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { expectedCents, loadMovements, openSession } from '@/lib/cash'
import { formatCents } from '@/lib/money'
import { Badge, Card, Empty } from '@/components/ui'

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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="display mb-6 text-2xl text-[var(--ink)]">Que loja?</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {drawers.map(({ unit, open, cents }) => (
          <Link key={unit.id} href={`/caixa/${unit.slug}`}>
            <Card className="px-4 py-5 transition-colors hover:border-[var(--accent)]">
              <div className="flex items-start justify-between gap-3">
                <p className="display text-lg text-[var(--ink)]">{unit.name}</p>
                <Badge tone={open ? 'ok' : 'neutral'}>
                  {open ? 'Aberta' : 'Fechada'}
                </Badge>
              </div>
              <p className="tabular mt-0.5 text-[0.8125rem] text-[var(--ink-muted)]">
                {open
                  ? `Na gaveta, esperado ${formatCents(cents)}`
                  : 'Por abrir hoje'}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
