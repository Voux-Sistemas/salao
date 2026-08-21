import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { devCodeFor, rememberedPhone } from '@/lib/account'
import { getClientActor } from '@/lib/auth/client-actor'
import { env } from '@/lib/env'
import { getDictionary } from '@/lib/i18n'
import { CodeForm } from '@/components/account-forms'
import { Notice } from '@/components/ui'

export const metadata: Metadata = { title: 'Código' }

/**
 * O segundo tempo. O número vem do cookie do passo anterior — não da
 * barra de endereço, que se copia e se partilha.
 *
 * A frase que a cliente lê é a mesma quer o número tenha ficha quer não.
 */
export default async function ContaVerificarPage() {
  const client = await getClientActor()
  if (client) redirect('/conta')

  const phone = await rememberedPhone()
  if (!phone) redirect('/conta/entrar')

  const dict = await getDictionary()
  const hint = env.isProduction ? null : await devCodeFor(phone)

  return (
    <div className="mx-auto max-w-md px-5 py-20 sm:px-8 sm:py-28">
      <h1 className="display text-3xl text-[var(--ink)]">
        {dict.account.verifyTitle}
      </h1>
      <p className="mt-3 text-[0.9375rem] text-[var(--ink-muted)]">
        {dict.account.verifySubtitle}
      </p>
      <p className="tabular mt-1 mb-8 text-[0.8125rem] text-[var(--ink-faint)]">
        {phone}{' '}
        <Link
          href="/conta/entrar"
          className="underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
        >
          {dict.common.change}
        </Link>
      </p>

      <div className="mb-6">
        <Notice tone="neutral">{dict.account.codeSent}</Notice>
      </div>

      {hint ? (
        <div className="mb-6">
          <Notice tone="warn">
            <span className="tabular">{hint}</span> — visível só fora de
            produção.
          </Notice>
        </div>
      ) : null}

      <CodeForm
        labels={{
          code: dict.account.codeLabel,
          submit: dict.account.verify,
          resend: dict.account.resend,
        }}
      />
    </div>
  )
}
