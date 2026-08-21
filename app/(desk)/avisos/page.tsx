import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Avisos' }

/** O ecrã sem loja é um seletor, não um ecrã vazio. */
export default async function AvisosChooser() {
  const actor = await requireManagement()
  const units = await unitsFor(actor)

  const only = units[0]
  if (units.length === 1 && only) redirect(`/avisos/${only.slug}`)

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="display mb-6 text-2xl text-[var(--ink)]">Que loja?</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {units.map((unit) => (
          <Link key={unit.id} href={`/avisos/${unit.slug}`}>
            <Card className="px-4 py-5 transition-colors hover:border-[var(--accent)]">
              <p className="display text-lg text-[var(--ink)]">{unit.name}</p>
              <p className="mt-0.5 text-[0.8125rem] text-[var(--ink-muted)]">
                {unit.city ?? unit.address_line ?? unit.timezone}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
