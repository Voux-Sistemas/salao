import Link from 'next/link'
import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth-forms'

export const metadata: Metadata = {
  title: 'Nova palavra-passe',
  robots: { index: false, follow: false },
}

export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  return (
    <div>
      <h1 className="display text-2xl text-[var(--ink)]">Nova palavra-passe</h1>
      <p className="mt-1 mb-8 text-sm text-[var(--ink-muted)]">
        Escreva o código que recebeu e a palavra-passe nova.
      </p>

      <ResetPasswordForm email={email ?? ''} />

      <div className="mt-8 flex items-center justify-between text-[0.8125rem]">
        <Link
          href="/entrar/esqueci"
          className="text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          Pedir outro código
        </Link>
        <Link
          href="/entrar"
          className="text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)]"
        >
          Voltar
        </Link>
      </div>
    </div>
  )
}
