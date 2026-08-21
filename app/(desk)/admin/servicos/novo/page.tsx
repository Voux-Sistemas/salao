import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireOrgScope } from '@/lib/auth/actor'
import { listCategories } from '@/lib/catalog-admin'
import { ServiceForm } from '@/components/service-forms'
import { Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Novo serviço' }

/** Sem categoria não há onde o pôr — volta-se atrás e cria-se uma. */
export default async function NovoServicoPage() {
  const actor = await requireOrgScope()
  const categories = await listCategories(actor.orgId)
  if (categories.length === 0) redirect('/admin/servicos')

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/servicos"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} />
        Serviços
      </Link>

      <h2 className="display mb-1 text-xl text-[var(--ink)]">Novo serviço</h2>
      <p className="mb-5 text-[0.8125rem] text-[var(--ink-muted)]">
        Depois de criado dizem-se as excepções, os recursos de que precisa e
        quem o executa.
      </p>

      <Card className="px-4 py-5 sm:px-6">
        <ServiceForm categories={categories} />
      </Card>
    </div>
  )
}
