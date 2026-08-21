import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ExternalLink } from 'lucide-react'
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
import { Badge, Card, Divider, Notice } from '@/components/ui'

export const metadata: Metadata = { title: 'Loja' }

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
        <Link
          href="/admin/unidades"
          className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} />
          Unidades
        </Link>

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="display text-xl text-[var(--ink)]">{unit.name}</h2>
          <Link
            href={`/loja/${unit.slug}`}
            className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
          >
            Ver a montra
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* --- horário ------------------------------------------------ */}
      <section>
        <h3 className="eyebrow mb-1">Horário da semana</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Várias faixas no mesmo dia é como se representa a pausa de almoço.
          Um dia sem faixa nenhuma é um dia fechado.
        </p>

        {hours.length === 0 ? (
          <Notice tone="warn">
            Sem horário não há um único horário para oferecer. Comece por
            abrir um dia.
          </Notice>
        ) : null}

        <Card className="mt-3 divide-y divide-[var(--line-soft)]">
          {WEEKDAY_NAMES_PT.map((name, weekday) => {
            const rows = byWeekday.get(weekday) ?? []
            return (
              <div
                key={weekday}
                className="grid gap-3 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:items-start"
              >
                <div>
                  <p className="text-sm text-[var(--ink)]">{name}</p>
                  {rows.length === 0 ? (
                    <p className="text-[0.75rem] text-[var(--ink-faint)]">
                      Fechado
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {rows.length > 0 ? (
                    <ul className="flex flex-wrap items-center gap-2">
                      {rows.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center gap-1 border border-[var(--line)] py-0.5 pl-2 pr-1"
                        >
                          <span className="tabular text-[0.8125rem] text-[var(--ink)]">
                            {formatMinutes(row.opens_min)}–
                            {formatMinutes(row.closes_min)}
                          </span>
                          <RemoveHours unitId={unit.id} id={row.id} />
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <AddHoursForm unitId={unit.id} weekday={weekday} />
                  {rows.length > 0 ? (
                    <CopyWeekdayForm unitId={unit.id} from={weekday} />
                  ) : null}
                </div>
              </div>
            )
          })}
        </Card>
      </section>

      {/* --- feriados ----------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Feriados e horários especiais</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          O que estiver marcado para uma data substitui por completo o
          horário normal desse dia.
        </p>

        <Card className="mb-3 px-4 py-5 sm:px-6">
          <AddSpecialForm unitId={unit.id} />
        </Card>

        {special.length > 0 ? (
          <Card className="divide-y divide-[var(--line-soft)]">
            {special.map((row) => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
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
          </Card>
        ) : (
          <p className="text-[0.8125rem] text-[var(--ink-faint)]">
            Nada marcado de hoje em diante.
          </p>
        )}
      </section>

      {/* --- regras ------------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Regras de marcação</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          É por isto que o motor de disponibilidade se guia. Ao balcão, a
          antecedência mínima pode ser ignorada — a isso chama-se um encaixe.
        </p>
        <Card className="px-4 py-5 sm:px-6">
          <RulesForm unit={unit} />
        </Card>
      </section>

      {/* --- recursos ----------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Equipamento</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Duas cabines são duas linhas. Se um serviço precisar de uma e não
          houver nenhuma livre, o horário não se oferece.
        </p>

        <Card className="mb-3 px-4 py-5 sm:px-6">
          <AddResourceForm unitId={unit.id} types={types} />
        </Card>

        {resources.length > 0 ? (
          <Card className="divide-y divide-[var(--line-soft)]">
            {resources.map((row) => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                <Badge>{row.type_name}</Badge>
                <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                  {row.name}
                </p>
                <RemoveResource unitId={unit.id} id={row.id} />
              </div>
            ))}
          </Card>
        ) : null}
      </section>

      <Divider />

      {/* --- identidade --------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-3">A loja</h3>
        <Card className="px-4 py-5 sm:px-6">
          <UnitDetailsForm unit={unit} defaultTimezone={org.timezone} />
        </Card>
      </section>
    </div>
  )
}
