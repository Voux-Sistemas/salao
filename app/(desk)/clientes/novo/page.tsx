import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireManagement } from '@/lib/auth/actor'
import { preferenceOptions } from '@/lib/clients'
import { ClientForm } from '@/components/client-forms'
import { Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Nova ficha' }

/** Uma ficha nova. O telefone é a identidade — o resto pode vir depois. */
export default async function NovoClientePage() {
  const actor = await requireManagement()
  const { units, staff } = await preferenceOptions(actor.orgId)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} />
        Clientes
      </Link>

      <h1 className="display mb-1 text-3xl text-[var(--ink)]">Nova ficha</h1>
      <p className="mb-6 text-[0.8125rem] text-[var(--ink-muted)]">
        Basta o nome e o telefone. As preferências enchem-se com o tempo.
      </p>

      <Card className="px-4 py-6 sm:px-6">
        <ClientForm units={units} staff={staff} submitLabel="Criar ficha" />
      </Card>
    </div>
  )
}
