import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireActor } from '@/lib/auth/actor'
import { AbrirBalcaoForm } from '@/components/balcao-abrir'

export const metadata: Metadata = {
  title: 'Abrir',
  robots: { index: false, follow: false },
}

/**
 * A porta dela, no próprio tablet.
 *
 * Quem não está no balcão não tem aqui nada que fazer: cai em casa. Não
 * é uma segunda maneira de entrar — é a mesma pessoa a provar que é ela
 * antes de o aparelho voltar a ser dela.
 */
export default async function AbrirBalcaoPage() {
  const actor = await requireActor()
  if (!actor.balcao) redirect('/')

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="display text-[1.625rem] leading-tight text-[var(--ink)]">
        Sou a {primeiroNome(actor.name)}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
        Abre a Gestão e os números <strong>neste aparelho</strong>, por meia
        hora. Depois volta ao balcão sozinho.
      </p>

      <div className="mt-7">
        <AbrirBalcaoForm />
      </div>
    </div>
  )
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome
}
