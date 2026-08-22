import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { LEVEL_LABEL } from '@/lib/status'
import { listTeam } from '@/lib/team'
import { PageIntro, Panel, TableHeader } from '@/components/gestao-panel'
import { Badge, ButtonLink, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Equipa' }

const COLS = 'sm:grid-cols-[minmax(0,1fr)_7rem_11rem_7.5rem]'

/**
 * A EQUIPA.
 *
 * A dona vê a rede toda. A gerente vê quem atende nas lojas dela — e
 * mais ninguém: quem está acima simplesmente não consta desta lista,
 * que é a mesma resposta que se dá a quem não existe.
 */
export default async function EquipePage() {
  const actor = await requireManagement()
  const [team, units] = await Promise.all([
    listTeam(actor, true),
    unitsFor(actor),
  ])

  const active = team.filter((person) => person.is_active)
  const gone = team.filter((person) => !person.is_active)

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <PageIntro
          title="Equipa"
          lead="Cada pessoa tem um papel, lojas onde atende, habilidades e uma escala. O que falta a uma ficha aparece aqui como aviso."
          action={
            units.length > 0 ? (
              <ButtonLink href="/admin/equipe/nova" size="sm">
                <Plus size={14} />
                Nova pessoa
              </ButtonLink>
            ) : null
          }
        />

        {units.length === 0 ? (
          <Card className="px-4">
            <Empty
              title="Ainda não há loja nenhuma"
              hint="Uma pessoa atende sempre nalgum sítio. Comece pelas unidades."
            />
          </Card>
        ) : active.length === 0 ? (
          <Card className="px-4">
            <Empty
              title="Equipa vazia"
              hint="Sem ninguém para atender, não há agenda."
              action={
                <ButtonLink href="/admin/equipe/nova">
                  Criar a primeira ficha
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <Card className="divide-y divide-[var(--line-soft)] overflow-hidden">
            <TableHeader className={COLS}>
              <span>Pessoa</span>
              <span className="text-right">Habilidades</span>
              <span>Papéis</span>
              <span>Estado</span>
            </TableHeader>

            {active.map((person) => (
              <Link
                key={person.id}
                href={`/admin/equipe/${person.id}`}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-[var(--surface-2)] sm:px-6 ${COLS}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="h-8 w-1 shrink-0 rounded-[1px]"
                    style={{ background: person.display_color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--ink)]">{person.name}</p>
                    <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
                      {person.units.length > 0
                        ? person.units.join(' · ')
                        : 'Sem loja'}
                      {/* As colunas dos papéis e das habilidades só existem a
                          partir de `sm`. O papel é o que define a pessoa: sem
                          ele, a lista no telemóvel era nomes e lojas sem
                          hierarquia nenhuma. Das habilidades só vem cá o caso
                          que é um problema — profissional sem nenhuma. */}
                      <span className="sm:hidden">
                        {person.org_scope ? ' · Rede' : ''}
                        {person.roles
                          .map((role) => ` · ${LEVEL_LABEL[role]}`)
                          .join('')}
                        {person.skills === 0 &&
                        person.roles.includes('professional')
                          ? ' · sem habilidades'
                          : ''}
                      </span>
                    </p>
                  </div>
                </div>

                <span className="hidden text-right sm:block">
                  {person.skills > 0 ? (
                    <span className="tabular text-sm text-[var(--ink-muted)]">
                      {person.skills} serviço{person.skills === 1 ? '' : 's'}
                    </span>
                  ) : person.roles.includes('professional') ? (
                    <Badge tone="warn">Nenhuma</Badge>
                  ) : (
                    <span className="text-sm text-[var(--ink-faint)]">—</span>
                  )}
                </span>

                <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
                  {person.org_scope ? <Badge tone="accent">Rede</Badge> : null}
                  {person.roles.map((role) => (
                    <Badge key={role}>{LEVEL_LABEL[role]}</Badge>
                  ))}
                </span>

                <span>
                  {!person.has_password ? (
                    <Badge tone="warn">Sem senha</Badge>
                  ) : person.accepts_online_booking ? (
                    <Badge tone="ok">No site</Badge>
                  ) : (
                    <Badge tone="neutral">Só balcão</Badge>
                  )}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {gone.length > 0 ? (
        <section>
          <Panel
            title="Fora da equipa"
            hint="Ninguém se apaga: o que já foi atendido continua a saber por que mãos passou."
            flush
          >
            <div className="divide-y divide-[var(--line-soft)]">
              {gone.map((person) => (
                <Link
                  key={person.id}
                  href={`/admin/equipe/${person.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-2)] sm:px-6"
                >
                  <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink-muted)]">
                    {person.name}
                  </p>
                  <Badge tone="neutral">Saiu</Badge>
                </Link>
              ))}
            </div>
          </Panel>
        </section>
      ) : null}
    </div>
  )
}
