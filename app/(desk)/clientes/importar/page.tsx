import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireManagement } from '@/lib/auth/actor'
import { ImportForm } from '@/components/client-forms'
import { Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Importar clientes' }

/**
 * TRAZER A LISTA QUE JÁ SE TEM.
 *
 * Em dois tempos: primeiro mostra-se, linha a linha, o que vai
 * acontecer; só depois é que se grava. E quem já cá está não é tocado —
 * o telefone é a identidade, e uma folha de cálculo não manda na ficha
 * que a casa já construiu.
 */
export default async function ImportarPage() {
  await requireManagement()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} />
        Clientes
      </Link>

      <h1 className="display mb-1 text-3xl text-[var(--ink)]">
        Importar clientes
      </h1>
      <p className="mb-6 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
        Vê-se primeiro, grava-se depois. Quem já tem ficha fica como está:
        a importação só cria quem falta.
      </p>

      <Card className="px-4 py-6 sm:px-6">
        <ImportForm />
      </Card>
    </div>
  )
}
