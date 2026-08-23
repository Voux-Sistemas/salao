import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireOrgScope } from '@/lib/auth/actor'
import { listCategories, listPhotoLibrary } from '@/lib/catalog-admin'
import { ServiceForm } from '@/components/service-forms'
import { BackLink } from '@/components/gestao-panel'

export const metadata: Metadata = { title: 'Novo serviço' }

/** Sem categoria não há onde o pôr — volta-se atrás e cria-se uma. */
export default async function NovoServicoPage() {
  const actor = await requireOrgScope()
  const [categories, photos] = await Promise.all([
    listCategories(actor.orgId),
    listPhotoLibrary(actor.orgId),
  ])
  if (categories.length === 0) redirect('/admin/servicos')

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <BackLink href="/admin/servicos" label="Serviços" />
      </div>

      <h2 className="display mb-1 text-[1.75rem] leading-tight text-[var(--ink)]">
        Novo serviço
      </h2>
      <p className="mb-6 text-[0.8125rem] text-[var(--ink-muted)]">
        Depois de criado dizem-se as excepções, os recursos de que precisa e
        quem o executa.
      </p>

      <ServiceForm categories={categories} photos={photos} />
    </div>
  )
}
