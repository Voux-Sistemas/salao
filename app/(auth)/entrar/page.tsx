import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getActor, homeFor } from '@/lib/auth/actor'
import { ownerExists } from '@/lib/auth/setup'
import { SignInForm } from '@/components/auth-forms'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

export default async function SignInPage() {
  // Sem dona criada não há por onde entrar: o sistema está por instalar.
  if (!(await ownerExists())) redirect('/comecar')

  const actor = await getActor()
  if (actor) redirect(homeFor(actor))

  return (
    <div>
      <h1 className="display text-2xl text-[var(--ink)]">Entrar</h1>
      <p className="mt-1 mb-8 text-sm text-[var(--ink-muted)]">
        A área da equipa.
      </p>

      <SignInForm />

      <div className="mt-8 flex items-center justify-between text-[0.8125rem]">
        <Link
          href="/entrar/esqueci"
          className="text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          Esqueci-me da palavra-passe
        </Link>
        <Link
          href="/conta/entrar"
          className="text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)]"
        >
          Sou cliente
        </Link>
      </div>
    </div>
  )
}
