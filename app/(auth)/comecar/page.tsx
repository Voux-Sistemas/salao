import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ownerExists } from '@/lib/auth/setup'
import { SetupForm } from '@/components/auth-forms'

export const metadata: Metadata = {
  title: 'Instalação',
  robots: { index: false, follow: false },
}

/**
 * Só existe enquanto não houver dona criada. Assim que houver, deixa de
 * existir — e "deixa de existir" quer mesmo dizer não existe.
 */
export default async function SetupPage() {
  if (await ownerExists()) notFound()

  return (
    <div>
      <h1 className="display text-2xl text-[var(--ink)]">Instalação</h1>
      <p className="mt-1 mb-8 text-sm text-[var(--ink-muted)]">
        Cria a rede e a primeira conta. Este ecrã desaparece depois disso.
      </p>

      <SetupForm timezone="Europe/Lisbon" />
    </div>
  )
}
