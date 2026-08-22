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
      <p className="eyebrow eyebrow-gold">Instalação</p>
      <h1 className="display mt-3 text-4xl text-[var(--ink)]">
        Abrir a casa
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
        Três passos criam a rede, a montra pública e a conta da dona.
        Depois disso, este ecrã desaparece para sempre.
      </p>

      <div className="mt-9">
        <SetupForm timezone="Europe/Lisbon" />
      </div>
    </div>
  )
}
