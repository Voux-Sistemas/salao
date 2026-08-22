import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { MemberForm } from '@/components/team-forms'
import { BackLink } from '@/components/gestao-panel'

export const metadata: Metadata = { title: 'Nova pessoa' }

/**
 * Nasce profissional e sem palavra-passe. Os papéis, as habilidades e a
 * escala vêm a seguir, na ficha dela.
 */
export default async function NovaPessoaPage() {
  const actor = await requireManagement()
  const units = await unitsFor(actor)
  if (units.length === 0) redirect('/admin/equipe')

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <BackLink href="/admin/equipe" label="Equipa" />
      </div>

      <h2 className="display mb-1 text-[1.75rem] leading-tight text-[var(--ink)]">
        Nova pessoa
      </h2>
      <p className="mb-6 text-[0.8125rem] text-[var(--ink-muted)]">
        Entra como profissional. Depois de criada dizem-se as habilidades, a
        escala e — se for o caso — outro papel.
      </p>

      <MemberForm
        units={units.map((unit) => ({ id: unit.id, name: unit.name }))}
      />
    </div>
  )
}
