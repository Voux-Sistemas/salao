import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { rememberedPhone } from '@/lib/account'
import { getClientActor } from '@/lib/auth/client-actor'
import { getDictionary } from '@/lib/i18n'
import { PhoneForm } from '@/components/account-forms'
import { Gate } from '@/components/account-gate'

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
}

/**
 * A porta da cliente: só o telefone. O telefone é a identidade, e a
 * chave é um código de uso único — nunca uma palavra-passe que ela
 * tenha de guardar.
 */
export default async function ContaEntrarPage() {
  const client = await getClientActor()
  if (client) redirect('/conta')

  const [dict, phone] = await Promise.all([getDictionary(), rememberedPhone()])

  return (
    <Gate
      eyebrow={dict.nav.account}
      title={dict.account.signInTitle}
      subtitle={dict.account.signInSubtitle}
      footer={
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">
          {dict.account.signInNoAccount}{' '}
          <Link href="/agendar" className="link-slide text-[var(--accent)]">
            {dict.nav.book}
          </Link>
        </p>
      }
    >
      <PhoneForm
        defaultPhone={phone}
        labels={{
          phone: dict.account.phoneLabel,
          phoneHint: dict.funnel.phoneHint,
          submit: dict.account.sendCode,
        }}
      />
    </Gate>
  )
}
