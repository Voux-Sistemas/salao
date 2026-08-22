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
      <p className="eyebrow eyebrow-gold">Área da equipa</p>
      <h1 className="display mt-3 text-4xl text-[var(--ink)]">
        Nova palavra-passe
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
        O código chegou? Escreva-o e escolha a palavra-passe nova.
      </p>

      <div className="mt-9">
        <ResetPasswordForm email={email ?? ''} />
      </div>

      <div className="mt-8 flex items-center justify-between text-[0.8125rem]">
        <Link
          href="/entrar/esqueci"
          className="link-slide text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
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
