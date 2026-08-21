import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { LEVEL_LABEL } from '@/lib/status'
import { listTeam } from '@/lib/team'
import { Badge, ButtonLink, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Equipa' }

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
    <div className="space-y-10">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow">Equipa</h2>
          <ButtonLink href="/admin/equipe/nova" variant="outline" size="sm">
            <Plus size={14} />
            Nova pessoa
          </ButtonLink>
        </div>

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
          <Card className="divide-y divide-[var(--line-soft)]">
            {active.map((person) => (
              <Link
                key={person.id}
                href={`/admin/equipe/${person.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
              >
                <span
                  aria-hidden
                  className="h-6 w-1 shrink-0 rounded-[1px]"
                  style={{ background: person.display_color }}
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--ink)]">{person.name}</p>
                  <p className="text-[0.75rem] text-[var(--ink-muted)]">
                    {person.units.length > 0
                      ? person.units.join(' · ')
                      : 'Sem loja'}
                    {person.skills > 0
                      ? ` · ${person.skills} serviço${person.skills === 1 ? '' : 's'}`
                      : ' · sem habilidades'}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {person.org_scope ? <Badge tone="accent">Rede</Badge> : null}
                  {person.roles.map((role) => (
                    <Badge key={role}>{LEVEL_LABEL[role]}</Badge>
                  ))}
                  {person.has_password ? null : (
                    <Badge tone="warn">Sem senha</Badge>
                  )}
                  {person.accepts_online_booking ? null : (
                    <Badge tone="neutral">Só ao balcão</Badge>
                  )}
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {gone.length > 0 ? (
        <section>
          <h2 className="eyebrow mb-1">Fora da equipa</h2>
          <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
            Ninguém se apaga: o que já foi atendido continua a saber por que
            mãos passou.
          </p>
          <Card className="divide-y divide-[var(--line-soft)]">
            {gone.map((person) => (
              <Link
                key={person.id}
                href={`/admin/equipe/${person.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
              >
                <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink-muted)]">
                  {person.name}
                </p>
                <Badge tone="neutral">Saiu</Badge>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  )
}
