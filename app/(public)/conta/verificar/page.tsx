import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { devCodeFor, rememberedPhone } from '@/lib/account'
import { getClientActor } from '@/lib/auth/client-actor'
import { env } from '@/lib/env'
import { getDictionary } from '@/lib/i18n'
import { formatPhone } from '@/lib/text'
import { CodeForm } from '@/components/account-forms'
import { Gate } from '@/components/account-gate'
import { Notice } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Código',
  robots: { index: false, follow: false },
}

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
    <Gate
      eyebrow={dict.nav.account}
      title={dict.account.verifyTitle}
      subtitle={dict.account.codeSent}
      meta={
        <p className="text-[0.8125rem] text-[var(--ink-faint)]">
          <span className="tabular text-[var(--ink)]">{formatPhone(phone)}</span>
          {' · '}
          <Link href="/conta/entrar" className="link-slide">
            {dict.common.change}
          </Link>
        </p>
      }
    >
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
          hint: dict.account.verifySubtitle,
          submit: dict.account.verify,
          resend: dict.account.resend,
        }}
      />
    </Gate>
  )
}
