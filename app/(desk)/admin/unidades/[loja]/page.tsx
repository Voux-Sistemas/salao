import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { requireOrgScope } from '@/lib/auth/actor'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { formatMinutes, today, WEEKDAY_NAMES_PT } from '@/lib/time'
import {
  listHours,
  listResources,
  listResourceTypes,
  listSpecialHours,
  type HoursRow,
} from '@/lib/units'
import {
  AddHoursForm,
  AddResourceForm,
  AddSpecialForm,
  CopyWeekdayForm,
  RemoveHours,
  RemoveResource,
  RemoveSpecial,
  RulesForm,
  UnitDetailsForm,
} from '@/components/unit-forms'
import { BackLink, Panel } from '@/components/gestao-panel'
import { Badge, Divider, Notice } from '@/components/ui'

export const metadata: Metadata = { title: 'Loja' }

/** A semana começa a segunda; domingo fica para o fim. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/**
 * UMA LOJA POR DENTRO.
 *
 * Quatro coisas: quem é, que horas abre, que regras obedece e que
 * equipamento tem. Nenhuma delas se adivinha — todas se declaram, e o
 * motor de disponibilidade não conhece outra fonte.
 */
export default async function UnidadePage({
  params,
}: {
  params: Promise<{ loja: string }>
}) {
  const actor = await requireOrgScope()
  const { loja } = await params

  const unit = await getUnitBySlug(loja)
  if (!unit || unit.org_id !== actor.orgId) notFound()

  const [hours, special, resources, types, org] = await Promise.all([
    listHours(unit.id),
    listSpecialHours(unit.id, today(unit.timezone)),
    listResources(unit.id),
    listResourceTypes(actor.orgId),
    requireOrg(),
  ])

  const byWeekday = new Map<number, HoursRow[]>()
  for (const row of hours) {
    const list = byWeekday.get(row.weekday) ?? []
    list.push(row)
    byWeekday.set(row.weekday, list)
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="mb-4">
          <BackLink href="/admin/unidades" label="Unidades" />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="display text-[1.75rem] leading-tight text-[var(--ink)]">
            {unit.name}
          </h2>
          <Link
            href={`/loja/${unit.slug}`}
            className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
          >
            Ver a montra
            <ExternalLink size={13} />
          </Link>
        </div>
        <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
          {[unit.address_line, unit.city].filter(Boolean).join(' · ') ||
            'Sem morada declarada'}
          {' · '}
          <span className="tabular">{unit.timezone}</span>
        </p>
      </div>

      {hours.length === 0 ? (
        <Notice tone="warn">
          Sem horário não há um único horário para oferecer. Comece por abrir
          um dia.
        </Notice>
      ) : null}

      {/* --- horário ------------------------------------------------ */}
      <Panel
        title="Horário da semana"
        hint="Várias faixas no mesmo dia é como se representa a pausa de almoço. Um dia sem faixa nenhuma é um dia fechado."
        flush
      >
        <div className="divide-y divide-[var(--line-soft)]">
          {WEEK_ORDER.map((weekday) => {
            const name = WEEKDAY_NAMES_PT[weekday]
            const rows = byWeekday.get(weekday) ?? []
            return (
              <div
                key={weekday}
                className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[8.5rem_1fr] sm:items-center sm:px-6"
              >
                <div>
                  <p className="text-sm text-[var(--ink)]">{name}</p>
                  {rows.length === 0 ? (
                    <p className="text-[0.75rem] text-[var(--ink-faint)]">
                      Fechado
                    </p>
                  ) : null}
                </div>

                {/* Faixas e controlos na mesma linha. Empilhados, sete
                    dias ocupavam catorze linhas e a coluna da direita
                    ficava vazia de alto a baixo. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {rows.map((row) => (
                    <span
                      key={row.id}
                      className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] py-1 pl-2.5 pr-1"
                    >
                      <span className="tabular text-[0.8125rem] text-[var(--ink)]">
                        {formatMinutes(row.opens_min)}–
                        {formatMinutes(row.closes_min)}
                      </span>
                      <RemoveHours unitId={unit.id} id={row.id} />
                    </span>
                  ))}

                  <AddHoursForm unitId={unit.id} weekday={weekday} />
                  {rows.length > 0 ? (
                    <CopyWeekdayForm unitId={unit.id} from={weekday} />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* --- feriados ----------------------------------------------- */}
      <Panel
        title="Feriados e horários especiais"
        hint="O que estiver marcado para uma data substitui por completo o horário normal desse dia."
        flush
      >
        <div className="px-5 py-5 sm:px-6">
          <AddSpecialForm unitId={unit.id} />
        </div>

        {special.length > 0 ? (
          <div className="divide-y divide-[var(--line-soft)] border-t border-[var(--line-soft)]">
            {special.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 px-5 py-3 sm:px-6"
              >
                <span className="tabular shrink-0 text-sm text-[var(--ink)]">
                  {row.on_date}
                </span>
                {row.is_closed ? (
                  <Badge tone="bad">Fechado</Badge>
                ) : (
                  <span className="tabular text-[0.8125rem] text-[var(--ink)]">
                    {formatMinutes(row.opens_min ?? 0)}–
                    {formatMinutes(row.closes_min ?? 0)}
                  </span>
                )}
                <p className="min-w-0 flex-1 truncate text-[0.75rem] text-[var(--ink-muted)]">
                  {row.note ?? ''}
                </p>
                <RemoveSpecial unitId={unit.id} id={row.id} />
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-[var(--line-soft)] px-5 py-3 text-[0.8125rem] text-[var(--ink-faint)] sm:px-6">
            Nada marcado de hoje em diante.
          </p>
        )}
      </Panel>

      {/* --- regras ------------------------------------------------- */}
      <Panel
        title="Regras de marcação"
        hint="É por isto que o motor de disponibilidade se guia — nada aqui é decorativo."
      >
        <RulesForm unit={unit} />
      </Panel>

      {/* --- recursos ----------------------------------------------- */}
      <Panel
        title="Equipamento"
        hint="Duas cabines são duas linhas. Se um serviço precisar de uma e não houver nenhuma livre, o horário não se oferece."
        flush
      >
        {resources.length > 0 ? (
          <div className="divide-y divide-[var(--line-soft)]">
            {resources.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 px-5 py-3 sm:px-6"
              >
                <Badge className="w-36 justify-center">{row.type_name}</Badge>
                <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                  {row.name}
                </p>
                <RemoveResource unitId={unit.id} id={row.id} />
              </div>
            ))}
          </div>
        ) : null}
        <div
          className={`bg-[var(--surface-2)] px-5 py-4 sm:px-6 ${
            resources.length > 0 ? 'border-t border-[var(--line-soft)]' : ''
          }`}
        >
          <AddResourceForm unitId={unit.id} types={types} />
        </div>
      </Panel>

      <Divider />

      {/* --- identidade --------------------------------------------- */}
      <UnitDetailsForm unit={unit} defaultTimezone={org.timezone} />
    </div>
  )
}
