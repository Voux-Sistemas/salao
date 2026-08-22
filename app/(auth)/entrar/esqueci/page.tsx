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
      <p className="eyebrow eyebrow-gold">Área da equipa</p>
      <h1 className="display mt-3 text-4xl text-[var(--ink)]">
        Recuperar acesso
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
        Escreva o e-mail da sua conta e enviamos-lhe um código de seis
        dígitos.
      </p>

      <div className="mt-9">
        <RequestResetForm />
      </div>

      <div className="mt-8 flex items-center justify-between text-[0.8125rem]">
        <Link
          href="/entrar/nova-senha"
          className="link-slide text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
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
