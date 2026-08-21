import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { rememberedPhone } from '@/lib/account'
import { getClientActor } from '@/lib/auth/client-actor'
import { getDictionary } from '@/lib/i18n'
import { PhoneForm } from '@/components/account-forms'

export const metadata: Metadata = { title: 'Entrar' }

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
    <div className="mx-auto max-w-md px-5 py-20 sm:px-8 sm:py-28">
      <h1 className="display text-3xl text-[var(--ink)]">
        {dict.account.signInTitle}
      </h1>
      <p className="mt-3 mb-10 text-[0.9375rem] text-[var(--ink-muted)]">
        {dict.account.signInSubtitle}
      </p>

      <PhoneForm
        defaultPhone={phone}
        labels={{
          phone: dict.account.phoneLabel,
          phoneHint: dict.funnel.phoneHint,
          submit: dict.account.sendCode,
        }}
      />
    </div>
  )
}
