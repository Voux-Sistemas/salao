import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireOrgScope } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { UnitDetailsForm } from '@/components/unit-forms'
import { Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Nova loja' }

/**
 * Primeiro a loja existe; o horário, as regras e o equipamento vêm a
 * seguir, dentro dela.
 */
export default async function NovaUnidadePage() {
  await requireOrgScope()
  const org = await requireOrg()

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/unidades"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} />
        Unidades
      </Link>

      <h2 className="display mb-1 text-xl text-[var(--ink)]">Nova loja</h2>
      <p className="mb-5 text-[0.8125rem] text-[var(--ink-muted)]">
        Depois de criada abre-se o horário da semana — sem ele não há nada
        para marcar.
      </p>

      <Card className="px-4 py-5 sm:px-6">
        <UnitDetailsForm defaultTimezone={org.timezone} />
      </Card>
    </div>
  )
}
