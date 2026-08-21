import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { requireOrgScope } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { listResourceTypes, listUnitsForAdmin } from '@/lib/units'
import { ResourceTypeForm, RemoveType } from '@/components/unit-forms'
import { Badge, ButtonLink, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Unidades' }

/**
 * AS LOJAS.
 *
 * Cada uma tem o seu horário, as suas regras e o seu equipamento. O que
 * é da rede — o tipo de recurso — fica aqui em baixo, criado uma vez e
 * servindo as duas.
 */
export default async function UnidadesPage() {
  const actor = await requireOrgScope()
  const [units, types, org] = await Promise.all([
    listUnitsForAdmin(actor.orgId),
    listResourceTypes(actor.orgId),
    requireOrg(),
  ])

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow">Lojas</h2>
          <ButtonLink href="/admin/unidades/nova" variant="outline" size="sm">
            <Plus size={14} />
            Nova loja
          </ButtonLink>
        </div>

        {units.length === 0 ? (
          <Card className="px-4">
            <Empty
              title="Ainda não há lojas"
              hint="Sem loja não há horário, e sem horário não há nada para marcar."
              action={
                <ButtonLink href="/admin/unidades/nova">Criar a primeira</ButtonLink>
              }
            />
          </Card>
        ) : (
          <Card className="divide-y divide-[var(--line-soft)]">
            {units.map((unit) => (
              <Link
                key={unit.id}
                href={`/admin/unidades/${unit.slug}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--ink)]">{unit.name}</p>
                  <p className="text-[0.75rem] text-[var(--ink-muted)]">
                    /loja/{unit.slug}
                    {unit.city ? ` · ${unit.city}` : ''} · {unit.timezone}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {unit.open_days === 0 ? (
                    <Badge tone="warn">Sem horário</Badge>
                  ) : (
                    <Badge>
                      {unit.open_days} dia{unit.open_days === 1 ? '' : 's'}
                    </Badge>
                  )}
                  <Badge>
                    {unit.staff_count} pessoa
                    {unit.staff_count === 1 ? '' : 's'}
                  </Badge>
                  {unit.resource_count > 0 ? (
                    <Badge>{unit.resource_count} equipamento</Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* --- o que é da rede ---------------------------------------- */}
      <section>
        <h2 className="eyebrow mb-1">Tipos de recurso</h2>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          O tipo é da rede — &ldquo;cabine&rdquo; existe uma vez. Quantas há em
          cada loja diz-se dentro da loja. Um serviço declara de que tipos
          precisa, e sem um livre não há horário.
        </p>

        <Card className="mb-3 px-4 py-5 sm:px-6">
          <ResourceTypeForm />
        </Card>

        {types.length > 0 ? (
          <Card className="divide-y divide-[var(--line-soft)]">
            {types.map((type) => (
              <div
                key={type.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                  {type.name}
                </p>
                <span className="shrink-0 text-[0.75rem] text-[var(--ink-muted)]">
                  {type.instances === 0
                    ? 'nenhum na casa'
                    : `${type.instances} na rede`}
                </span>
                <RemoveType id={type.id} name={type.name} />
              </div>
            ))}
          </Card>
        ) : null}
      </section>

      <p className="text-[0.75rem] text-[var(--ink-faint)]">
        Tudo se guarda em UTC e se converte no fuso de cada loja. O da rede é{' '}
        {org.timezone}.
      </p>
    </div>
  )
}
