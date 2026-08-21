import Link from 'next/link'
import type { Metadata } from 'next'
import { RequestResetForm } from '@/components/auth-forms'

export const metadata: Metadata = {
  title: 'Recuperar palavra-passe',
  robots: { index: false, follow: false },
}

export default function ForgotPage() {
  return (
    <div>
      <h1 className="display text-2xl text-[var(--ink)]">
        Recuperar palavra-passe
      </h1>
      <p className="mt-1 mb-8 text-sm text-[var(--ink-muted)]">
        Escreva o e-mail da sua conta.
      </p>

      <RequestResetForm />

      <div className="mt-8 flex items-center justify-between text-[0.8125rem]">
        <Link
          href="/entrar/nova-senha"
          className="text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          Já tenho o código
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
