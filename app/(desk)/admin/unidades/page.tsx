import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { can, requireOrgScope } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { listResourceTypes, listUnitsForAdmin } from '@/lib/units'
import { sameWord } from '@/lib/text'
import { ResourceTypeForm, RemoveType } from '@/components/unit-forms'
import { PageIntro, Panel, TableHeader } from '@/components/gestao-panel'
import { Badge, ButtonLink, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Unidades' }

const COLS = 'sm:grid-cols-[minmax(0,1fr)_7rem_8.5rem_7rem]'

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
    <div className="space-y-12">
      <section className="space-y-5">
        <PageIntro
          title="Unidades"
          lead="Cada loja declara o horário, as regras e o equipamento — o motor de disponibilidade não conhece outra fonte."
          action={
            can.createUnits(actor) ? (
              <ButtonLink href="/admin/unidades/nova" size="sm">
                <Plus size={14} />
                Nova loja
              </ButtonLink>
            ) : null
          }
        />

        {units.length === 0 ? (
          <Card className="px-4">
            <Empty
              title="Ainda não há lojas"
              hint="Sem loja não há horário, e sem horário não há nada para marcar."
              action={
                can.createUnits(actor) ? (
                  <ButtonLink href="/admin/unidades/nova">
                    Criar a primeira
                  </ButtonLink>
                ) : null
              }
            />
          </Card>
        ) : (
          <Card className="divide-y divide-[var(--line-soft)] overflow-hidden">
            <TableHeader className={COLS}>
              <span>Loja</span>
              <span className="text-right">Equipa</span>
              <span className="text-right">Equipamento</span>
              <span>Estado</span>
            </TableHeader>

            {units.map((unit) => (
              <Link
                key={unit.id}
                href={`/admin/unidades/${unit.slug}`}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-[var(--surface-2)] sm:px-6 ${COLS}`}
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--ink)]">{unit.name}</p>
                  {/* O endereço público liderava esta linha e é o que menos
                      importa aqui dentro: no telemóvel empurrava o «abre N
                      dias» para fora e cortava-o a meio da palavra. Vai para
                      o fim e só a partir de `sm`. A cidade não se repete
                      quando já é o nome da casa. */}
                  <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
                    {unit.city && !sameWord(unit.city, unit.name)
                      ? `${unit.city} · `
                      : ''}
                    {unit.open_days > 0
                      ? `abre ${unit.open_days} dia${unit.open_days === 1 ? '' : 's'} por semana`
                      : 'sem horário'}
                    <span className="sm:hidden">
                      {` · ${unit.staff_count} pessoa${unit.staff_count === 1 ? '' : 's'}`}
                    </span>
                    <span className="hidden sm:inline">
                      {' · '}/loja/{unit.slug}
                    </span>
                  </p>
                </div>

                <span className="tabular hidden text-right text-sm text-[var(--ink-muted)] sm:block">
                  {unit.staff_count} pessoa{unit.staff_count === 1 ? '' : 's'}
                </span>

                <span className="hidden text-right sm:block">
                  {unit.resource_count === 0 ? (
                    <span className="text-sm text-[var(--ink-faint)]">—</span>
                  ) : (
                    <span className="tabular text-sm text-[var(--ink-muted)]">
                      {unit.resource_count} peça
                      {unit.resource_count === 1 ? '' : 's'}
                    </span>
                  )}
                </span>

                <span>
                  {unit.open_days === 0 ? (
                    <Badge tone="warn">Sem horário</Badge>
                  ) : (
                    <Badge tone="ok">Aberta</Badge>
                  )}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* --- o que é da rede ---------------------------------------- */}
      <section>
        <Panel
          title="Tipos de recurso"
          hint="O tipo é da rede — «cabine» existe uma vez. Quantas há em cada loja diz-se dentro da loja; um serviço declara de que tipos precisa, e sem um livre não há horário."
          flush
        >
          {types.length > 0 ? (
            <div className="divide-y divide-[var(--line-soft)]">
              {types.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center gap-3 px-5 py-3 sm:px-6"
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
            </div>
          ) : null}
          <div
            className={`bg-[var(--surface-2)] px-5 py-4 sm:px-6 ${
              types.length > 0 ? 'border-t border-[var(--line-soft)]' : ''
            }`}
          >
            <ResourceTypeForm />
          </div>
        </Panel>
      </section>

      <p className="text-[0.75rem] text-[var(--ink-faint)]">
        Tudo se guarda em UTC e se converte no fuso de cada loja. O da rede é{' '}
        {org.timezone}.
      </p>
    </div>
  )
}
