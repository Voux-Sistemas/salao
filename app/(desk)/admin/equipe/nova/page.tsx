import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { MemberForm } from '@/components/team-forms'
import { Card } from '@/components/ui'

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
      <Link
        href="/admin/equipe"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} />
        Equipa
      </Link>

      <h2 className="display mb-1 text-xl text-[var(--ink)]">Nova pessoa</h2>
      <p className="mb-5 text-[0.8125rem] text-[var(--ink-muted)]">
        Entra como profissional. Depois de criada dizem-se as habilidades, a
        escala e — se for o caso — outro papel.
      </p>

      <Card className="px-4 py-5 sm:px-6">
        <MemberForm units={units.map((unit) => ({ id: unit.id, name: unit.name }))} />
      </Card>
    </div>
  )
}
