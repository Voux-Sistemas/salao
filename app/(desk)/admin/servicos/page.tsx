import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { requireOrgScope } from '@/lib/auth/actor'
import { listCategories, listServices } from '@/lib/catalog-admin'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import { CategoryForm, CategoryLine } from '@/components/service-forms'
import { Badge, ButtonLink, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Serviços' }

/**
 * O CATÁLOGO.
 *
 * O serviço é da rede. O que muda de loja para loja ou de mão para mão
 * escreve-se como excepção, dentro do serviço — nunca duplicando-o.
 */
export default async function ServicosPage() {
  const actor = await requireOrgScope()
  const [services, categories] = await Promise.all([
    listServices(actor.orgId),
    listCategories(actor.orgId),
  ])

  const grouped = new Map<string, typeof services>()
  for (const service of services) {
    const list = grouped.get(service.category_name) ?? []
    list.push(service)
    grouped.set(service.category_name, list)
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow">Serviços</h2>
          {categories.length > 0 ? (
            <ButtonLink href="/admin/servicos/novo" variant="outline" size="sm">
              <Plus size={14} />
              Novo serviço
            </ButtonLink>
          ) : null}
        </div>

        {categories.length === 0 ? (
          <Card className="px-4">
            <Empty
              title="Comece pela categoria"
              hint="Um serviço vive sempre dentro de uma — cabelo, unhas, estética."
            />
          </Card>
        ) : services.length === 0 ? (
          <Card className="px-4">
            <Empty
              title="Catálogo vazio"
              hint="Sem serviços não há nada para marcar."
              action={
                <ButtonLink href="/admin/servicos/novo">
                  Criar o primeiro
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()].map(([category, list]) => (
              <div key={category}>
                <p className="mb-1.5 text-[0.75rem] uppercase tracking-wide text-[var(--ink-faint)]">
                  {category}
                </p>
                <Card className="divide-y divide-[var(--line-soft)]">
                  {list.map((service) => (
                    <Link
                      key={service.id}
                      href={`/admin/servicos/${service.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--ink)]">
                          {service.name}
                        </p>
                        <p className="text-[0.75rem] text-[var(--ink-muted)]">
                          {formatDuration(service.duration_minutes)}
                          {service.buffer_before_minutes ||
                          service.buffer_after_minutes
                            ? ` · folgas ${service.buffer_before_minutes}/${service.buffer_after_minutes}`
                            : ''}
                          {service.overrides > 0
                            ? ` · ${service.overrides} excepç${service.overrides === 1 ? 'ão' : 'ões'}`
                            : ''}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {service.skilled === 0 ? (
                          <Badge tone="warn">Ninguém o faz</Badge>
                        ) : (
                          <Badge>{service.skilled} faz</Badge>
                        )}
                        {service.bookable_online ? null : (
                          <Badge tone="neutral">Só ao balcão</Badge>
                        )}
                      </div>

                      <span className="tabular shrink-0 text-sm text-[var(--ink)]">
                        {formatCents(service.base_price_cents)}
                      </span>
                    </Link>
                  ))}
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- categorias --------------------------------------------- */}
      <section>
        <h2 className="eyebrow mb-1">Categorias</h2>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          É por elas que a cliente encontra o que procura. A ordem em que
          aparecem é a ordem em que foram criadas.
        </p>

        <Card className="mb-3 px-4 py-5 sm:px-6">
          <CategoryForm />
        </Card>

        {categories.length > 0 ? (
          <Card className="divide-y divide-[var(--line-soft)]">
            {categories.map((category) => (
              <CategoryLine
                key={category.id}
                id={category.id}
                name={category.name}
                services={category.services}
              />
            ))}
          </Card>
        ) : null}
      </section>
    </div>
  )
}
