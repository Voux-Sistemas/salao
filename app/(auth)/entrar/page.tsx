import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getActor, homeFor } from '@/lib/auth/actor'
import { ownerExists } from '@/lib/auth/setup'
import { SignInForm } from '@/components/auth-forms'
import { BalcaoCodeForm } from '@/components/balcao-entrar'

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
      <p className="eyebrow eyebrow-gold">Área da equipa</p>
      <h1 className="display mt-3 text-4xl text-[var(--ink)]">Entrar</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
        A agenda, o caixa e a casa — tudo a partir daqui.
      </p>

      <div className="mt-9">
        <SignInForm />
      </div>

      {/*
        A PORTA DE SERVIÇO.

        Para o dia em que o tablet do salão se desligar com a dona noutro
        sítio. O código põe o aparelho em modo balcão e MAIS NADA — nunca
        a Gestão, nunca os números — e é por isso que pode andar escrito
        num papel ao lado dele.

        Fica debaixo do «Entrar» e não ao lado: quem entra aqui todos os
        dias é a equipa com a sua palavra-passe, e isto é a excepção.
      */}
      <div className="mt-8 border-t border-[var(--line-soft)] pt-6">
        <BalcaoCodeForm />
      </div>

      {/* Um segundo bloco da largura toda debaixo do «Entrar» punha as
          duas coisas ao mesmo peso — e esquecer-se da palavra-passe é a
          excepção, não a acção. Fica como o que é: uma saída discreta. */}
      <p className="mt-4 text-center">
        <Link
          href="/entrar/esqueci"
          className="link-slide text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          Esqueci-me da palavra-passe
        </Link>
      </p>

      <div className="rule mt-10" />
      <p className="mt-5 text-center text-[0.8125rem] text-[var(--ink-faint)]">
        É cliente?{' '}
        <Link
          href="/conta/entrar"
          className="link-slide text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          Entre pela montra
        </Link>
        .
      </p>
    </div>
  )
}
