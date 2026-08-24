import Link from 'next/link'
import type { Metadata } from 'next'
import { Fragment } from 'react'
import { Plus } from 'lucide-react'
import { requireOrgScope } from '@/lib/auth/actor'
import { listCategories, listServices } from '@/lib/catalog-admin'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import { CategoryForm, CategoryLine } from '@/components/service-forms'
import { PageIntro, Panel, TableHeader } from '@/components/gestao-panel'
import { Badge, ButtonLink, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Serviços' }

const COLS = 'sm:grid-cols-[minmax(0,1fr)_6rem_7rem_7.5rem_6rem]'

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
    <div className="space-y-12">
      <section className="space-y-5">
        <PageIntro
          title="Serviços"
          lead="O catálogo é um só, da rede. O que muda numa loja ou numa mão escreve-se como excepção, dentro de cada serviço."
          action={
            categories.length > 0 ? (
              <ButtonLink href="/admin/servicos/novo" size="sm">
                <Plus size={14} />
                Novo serviço
              </ButtonLink>
            ) : null
          }
        />

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
          <Card className="divide-y divide-[var(--line-soft)] overflow-hidden">
            <TableHeader className={COLS}>
              <span>Serviço</span>
              <span className="text-right">Duração</span>
              <span className="text-right">Quem o faz</span>
              <span>Estado</span>
              <span className="text-right">Preço</span>
            </TableHeader>

            {[...grouped.entries()].map(([category, list]) => (
              <Fragment key={category}>
                <div className="bg-[var(--surface-2)] px-5 py-2 text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-muted)] sm:px-6">
                  {category}
                </div>
                {list.map((service) => (
                  <Link
                    key={service.id}
                    href={`/admin/servicos/${service.id}`}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-[var(--surface-2)] sm:px-6 ${COLS}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--ink)]">
                        {service.name}
                      </p>
                      {/* No telemóvel as três colunas da direita desaparecem
                          — a duração e quem o faz passam para debaixo do
                          nome. */}
                      <p className="text-[0.75rem] text-[var(--ink-muted)] sm:hidden">
                        <span className="tabular">
                          {formatDuration(service.duration_minutes)}
                        </span>
                        {' · '}
                        {service.skilled === 0 ? (
                          <span className="text-[var(--warn)]">ninguém o faz</span>
                        ) : (
                          <span className="tabular">
                            {service.skilled}{' '}
                            {service.skilled === 1 ? 'pessoa' : 'pessoas'}
                          </span>
                        )}
                        {service.bookable_online ? '' : ' · oculto'}
                      </p>
                      {service.overrides > 0 ? (
                        <p className="hidden text-[0.75rem] text-[var(--ink-muted)] sm:block">
                          {service.overrides} excepç
                          {service.overrides === 1 ? 'ão' : 'ões'}
                        </p>
                      ) : null}
                    </div>

                    <span className="tabular hidden text-right text-sm text-[var(--ink-muted)] sm:block">
                      {formatDuration(service.duration_minutes)}
                    </span>

                    <span className="hidden text-right sm:block">
                      {service.skilled === 0 ? (
                        <Badge tone="warn">Ninguém</Badge>
                      ) : (
                        <span className="tabular text-sm text-[var(--ink-muted)]">
                          {service.skilled}{' '}
                          {service.skilled === 1 ? 'pessoa' : 'pessoas'}
                        </span>
                      )}
                    </span>

                    <span className="hidden sm:block">
                      {service.bookable_online ? (
                        <Badge tone="ok">Online</Badge>
                      ) : (
                        <Badge tone="neutral">Oculto</Badge>
                      )}
                    </span>

                    <span className="tabular text-right text-sm text-[var(--ink)]">
                      {formatCents(service.base_price_cents)}
                    </span>
                  </Link>
                ))}
              </Fragment>
            ))}
          </Card>
        )}
      </section>

      {/* --- categorias --------------------------------------------- */}
      <section>
        <Panel
          title="Categorias"
          hint="É por elas que a cliente encontra o que procura. A ordem em que aparecem é a ordem em que foram criadas."
          flush
        >
          {categories.length > 0 ? (
            <div className="divide-y divide-[var(--line-soft)]">
              {categories.map((category) => (
                <CategoryLine
                  key={category.id}
                  id={category.id}
                  name={category.name}
                  services={category.services}
                />
              ))}
            </div>
          ) : null}
          <div
            className={`bg-[var(--surface-2)] px-5 py-4 sm:px-6 ${categories.length > 0 ? 'border-t border-[var(--line-soft)]' : ''}`}
          >
            <CategoryForm />
          </div>
        </Panel>
      </section>
    </div>
  )
}
