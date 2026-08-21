import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireOrgScope } from '@/lib/auth/actor'
import {
  getService,
  listCategories,
  listOverrides,
  listRequirements,
  listSkilled,
  overrideOptions,
  type Override,
} from '@/lib/catalog-admin'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import { listResourceTypes } from '@/lib/units'
import {
  OverrideForm,
  RemoveOverride,
  RemoveRequirement,
  RequirementForm,
  RetireService,
  ServiceForm,
} from '@/components/service-forms'
import { Badge, Card, Divider, Notice } from '@/components/ui'

export const metadata: Metadata = { title: 'Serviço' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * UM SERVIÇO POR DENTRO.
 *
 * O preço-base e a duração em cima; as excepções por loja e por
 * profissional a seguir, lidas sempre do mais específico ao mais geral;
 * depois o que consome e quem o executa.
 */
export default async function ServicoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireOrgScope()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const service = await getService(actor.orgId, id)
  if (!service) notFound()

  const [categories, overrides, options, requirements, types, skilled] =
    await Promise.all([
      listCategories(actor.orgId),
      listOverrides(service.id),
      overrideOptions(actor.orgId),
      listRequirements(service.id, actor.orgId),
      listResourceTypes(actor.orgId),
      listSkilled(service.id),
    ])

  const online = skilled.filter((person) => person.accepts_online)

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/servicos"
          className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} />
          Serviços
        </Link>

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="display text-xl text-[var(--ink)]">{service.name}</h2>
          <p className="tabular text-sm text-[var(--ink-muted)]">
            {formatCents(service.base_price_cents)} ·{' '}
            {formatDuration(service.duration_minutes)}
          </p>
        </div>
      </div>

      <Card className="px-4 py-5 sm:px-6">
        <ServiceForm service={service} categories={categories} />
      </Card>

      {/* --- excepções ---------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Excepções de preço e duração</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Ganha sempre a mais específica: profissional + loja, depois
          profissional, depois loja, depois o preço-base.
        </p>

        <Card className="mb-3 px-4 py-5 sm:px-6">
          <OverrideForm
            serviceId={service.id}
            units={options.units}
            staff={options.staff}
          />
        </Card>

        {overrides.length > 0 ? (
          <Card className="divide-y divide-[var(--line-soft)]">
            {overrides.map((row) => (
              <OverrideLine
                key={row.id}
                serviceId={service.id}
                row={row}
                basePriceCents={service.base_price_cents}
                baseMinutes={service.duration_minutes}
              />
            ))}
          </Card>
        ) : (
          <p className="text-[0.8125rem] text-[var(--ink-faint)]">
            Nenhuma. Em toda a rede, com qualquer mão, custa o mesmo.
          </p>
        )}
      </section>

      {/* --- recursos ----------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Recursos que consome</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Se não houver um livre de cada tipo, o horário não se oferece —
          mesmo com a profissional disponível.
        </p>

        <Card className="mb-3 px-4 py-5 sm:px-6">
          <RequirementForm serviceId={service.id} types={types} />
        </Card>

        {requirements.length > 0 ? (
          <Card className="divide-y divide-[var(--line-soft)]">
            {requirements.map((row) => (
              <div
                key={row.resource_type_id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                  {row.type_name}
                </p>
                <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink)]">
                  {row.quantity}
                </span>
                {row.fewest < row.quantity ? (
                  <Badge tone="bad">Há loja sem tantos</Badge>
                ) : null}
                <RemoveRequirement
                  serviceId={service.id}
                  typeId={row.resource_type_id}
                />
              </div>
            ))}
          </Card>
        ) : null}
      </section>

      {/* --- quem o faz --------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Quem o executa</h3>
        {skilled.length === 0 ? (
          <Notice tone="warn">
            Ninguém tem esta habilidade — e por isso este serviço não aparece
            em lado nenhum. A habilidade dá-se na ficha de cada pessoa, em
            Equipa.
          </Notice>
        ) : (
          <>
            <Card className="divide-y divide-[var(--line-soft)]">
              {skilled.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <Link
                    href={`/admin/equipe/${person.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                  >
                    {person.name}
                  </Link>
                  {person.accepts_online ? null : (
                    <Badge>Só ao balcão</Badge>
                  )}
                </div>
              ))}
            </Card>
            {service.bookable_online && online.length === 0 ? (
              <Notice tone="warn">
                É marcável online, mas nenhuma das pessoas que o faz aceita
                marcação online. No funil público, não haverá horário nenhum.
              </Notice>
            ) : null}
          </>
        )}
      </section>

      <Divider />

      <RetireService serviceId={service.id} />
    </div>
  )
}

function OverrideLine({
  serviceId,
  row,
  basePriceCents,
  baseMinutes,
}: {
  serviceId: string
  row: Override
  basePriceCents: number
  baseMinutes: number
}) {
  const scope =
    row.staff_id && row.unit_id
      ? `${row.staff_name} · ${row.unit_name}`
      : row.staff_id
        ? row.staff_name
        : row.unit_name

  const label =
    row.staff_id && row.unit_id
      ? 'Profissional + loja'
      : row.staff_id
        ? 'Profissional'
        : 'Loja'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <Badge tone="accent">{label}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--ink)]">{scope}</p>
        {row.note ? (
          <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
            {row.note}
          </p>
        ) : null}
      </div>
      <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink)]">
        {row.price_cents === null
          ? formatCents(basePriceCents)
          : formatCents(row.price_cents)}
        {' · '}
        {formatDuration(row.duration_minutes ?? baseMinutes)}
      </span>
      <RemoveOverride serviceId={serviceId} id={row.id} />
    </div>
  )
}
