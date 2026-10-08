import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireOrgScope } from '@/lib/auth/actor'
import {
  MAX_SUGGESTIONS,
  getService,
  listCategories,
  listOverrides,
  listRequirements,
  listSkilled,
  listPhotoLibrary,
  listSuggestions,
  overrideOptions,
  suggestionOptions,
  type Override,
} from '@/lib/catalog-admin'
import { formatCents } from '@/lib/money'
import { formatDuration } from '@/lib/time'
import { listResourceTypes } from '@/lib/units'
import {
  OverrideForm,
  RemoveOverride,
  RemoveRequirement,
  RemoveSuggestion,
  RequirementForm,
  RetireService,
  ServiceForm,
  SuggestionForm,
} from '@/components/service-forms'
import { BackLink, Panel } from '@/components/gestao-panel'
import { Badge, Divider, Notice } from '@/components/ui'
import { isUuid } from '@/lib/id'

export const metadata: Metadata = { title: 'Serviço' }


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
  if (!isUuid(id)) notFound()

  const service = await getService(actor.orgId, id)
  if (!service) notFound()

  const [
    categories,
    overrides,
    options,
    requirements,
    types,
    skilled,
    photos,
    suggestions,
    suggestable,
  ] =
    await Promise.all([
      listCategories(actor.orgId),
      listOverrides(service.id),
      overrideOptions(actor.orgId),
      listRequirements(service.id, actor.orgId),
      listResourceTypes(actor.orgId),
      listSkilled(service.id),
      listPhotoLibrary(actor.orgId),
      listSuggestions(service.id, actor.orgId),
      suggestionOptions(service.id, actor.orgId),
    ])

  const online = skilled.filter((person) => person.accepts_online)

  return (
    <div className="space-y-10">
      <div>
        <div className="mb-4">
          <BackLink href="/admin/servicos" label="Serviços" />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="display text-[1.75rem] leading-tight text-[var(--ink)]">
            {service.name}
          </h2>
          <p className="tabular text-sm text-[var(--ink-muted)]">
            {formatCents(service.base_price_cents)} ·{' '}
            {formatDuration(service.duration_minutes)}
          </p>
        </div>
      </div>

      <ServiceForm service={service} categories={categories} photos={photos} />

      {/* --- excepções ---------------------------------------------- */}
      <Panel
        title="Excepções de preço e duração"
        hint="Ganha sempre a mais específica: colaborador + loja, depois colaborador, depois loja, depois o preço-base."
        flush
      >
        <div className="px-5 py-5 sm:px-6">
          <OverrideForm
            serviceId={service.id}
            units={options.units}
            staff={options.staff}
          />
        </div>

        {overrides.length > 0 ? (
          <div className="divide-y divide-[var(--line-soft)] border-t border-[var(--line-soft)]">
            {overrides.map((row) => (
              <OverrideLine
                key={row.id}
                serviceId={service.id}
                row={row}
                basePriceCents={service.base_price_cents}
                baseMinutes={service.duration_minutes}
              />
            ))}
          </div>
        ) : (
          <p className="border-t border-[var(--line-soft)] px-5 py-3 text-[0.8125rem] text-[var(--ink-faint)] sm:px-6">
            Nenhuma. Em toda a rede, com qualquer mão, custa o mesmo.
          </p>
        )}
      </Panel>

      {/* --- recursos ----------------------------------------------- */}
      <Panel
        title="Recursos que consome"
        hint="Se não houver um livre de cada tipo, o horário não se oferece — mesmo com o colaborador disponível."
        flush
      >
        <div className="px-5 py-5 sm:px-6">
          <RequirementForm serviceId={service.id} types={types} />
        </div>

        {requirements.length > 0 ? (
          <div className="divide-y divide-[var(--line-soft)] border-t border-[var(--line-soft)]">
            {requirements.map((row) => (
              <div
                key={row.resource_type_id}
                className="flex items-center gap-3 px-5 py-3 sm:px-6"
              >
                <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                  {row.type_name}
                </p>
                {row.fewest < row.quantity ? (
                  <Badge tone="bad">Há loja sem tantos</Badge>
                ) : null}
                <span className="tabular shrink-0 text-sm text-[var(--ink)]">
                  {row.quantity}
                </span>
                <RemoveRequirement
                  serviceId={service.id}
                  typeId={row.resource_type_id}
                />
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      {/* --- sugestões na marcação ---------------------------------- */}
      <Panel
        title="Sugerir na marcação"
        hint={`Na marcação online, quem escolher este serviço vê estas sugestões antes de escolher a hora. No máximo ${MAX_SUGGESTIONS}. Só aparecem se a profissional escolhida as fizer e se couberem no dia.`}
        flush
      >
        <div className="px-5 py-5 sm:px-6">
          <SuggestionForm
            serviceId={service.id}
            options={suggestable.filter(
              (option) => !suggestions.some((row) => row.suggested_id === option.id),
            )}
            full={suggestions.length >= MAX_SUGGESTIONS}
          />
        </div>

        {suggestions.length > 0 ? (
          <div className="divide-y divide-[var(--line-soft)] border-t border-[var(--line-soft)]">
            {suggestions.map((row) => (
              <div
                key={row.suggested_id}
                className="flex items-center gap-3 px-5 py-3 sm:px-6"
              >
                <Link
                  href={`/admin/servicos/${row.suggested_id}`}
                  className="min-w-0 flex-1 truncate text-sm text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                >
                  {row.name}
                </Link>
                {/* Uma sugestão que já não se pode marcar online não
                    aparece no funil — diz-se aqui, para não parecer que
                    está a funcionar. */}
                {!row.is_active ? (
                  <Badge tone="bad">Retirado</Badge>
                ) : !row.bookable_online ? (
                  <Badge>Só ao balcão</Badge>
                ) : null}
                <span className="tabular shrink-0 text-sm text-[var(--ink-muted)]">
                  {formatCents(row.base_price_cents)} · {formatDuration(row.duration_minutes)}
                </span>
                <RemoveSuggestion serviceId={service.id} suggestedId={row.suggested_id} />
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-[var(--line-soft)] px-5 py-3 text-[0.8125rem] text-[var(--ink-faint)] sm:px-6">
            Nenhuma. Quem escolher este serviço segue direto para a hora.
          </p>
        )}
      </Panel>

      {/* --- quem o faz --------------------------------------------- */}
      <Panel
        title="Quem o executa"
        hint="A habilidade dá-se na ficha de cada pessoa, em Equipa."
        flush
      >
        {skilled.length === 0 ? (
          <div className="px-5 py-5 sm:px-6">
            <Notice tone="warn">
              Ninguém tem esta habilidade — e por isso este serviço está
              fora da montra e da marcação online. Volta sozinho assim que
              alguém o souber fazer.
            </Notice>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--line-soft)]">
              {skilled.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 px-5 py-3 sm:px-6"
                >
                  <Link
                    href={`/admin/equipe/${person.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                  >
                    {person.name}
                  </Link>
                  {person.accepts_online ? (
                    <Badge tone="ok">Online</Badge>
                  ) : (
                    <Badge>Só ao balcão</Badge>
                  )}
                </div>
              ))}
            </div>
            {service.bookable_online && online.length === 0 ? (
              <div className="border-t border-[var(--line-soft)] px-5 py-4 sm:px-6">
                <Notice tone="warn">
                  É marcável online, mas nenhuma das pessoas que o faz aceita
                  marcação online. No funil público, não haverá horário
                  nenhum.
                </Notice>
              </div>
            ) : null}
          </>
        )}
      </Panel>

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
      ? 'Colaborador + loja'
      : row.staff_id
        ? 'Colaborador'
        : 'Loja'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:px-6">
      <Badge tone="accent" className="w-36 justify-center sm:shrink-0">
        {label}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--ink)]">{scope}</p>
        {row.note ? (
          <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
            {row.note}
          </p>
        ) : null}
      </div>
      <span className="tabular shrink-0 text-sm text-[var(--ink)]">
        {row.price_cents === null
          ? formatCents(basePriceCents)
          : formatCents(row.price_cents)}
        <span className="text-[var(--ink-faint)]"> · </span>
        {formatDuration(row.duration_minutes ?? baseMinutes)}
      </span>
      <RemoveOverride serviceId={serviceId} id={row.id} />
    </div>
  )
}
