'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  cancelAction,
  requestCodeAction,
  resendCodeAction,
  saveDetailsAction,
  signOutAction,
  verifyCodeAction,
  type AccountState,
} from '@/app/(public)/conta/actions'
import { LANGUAGES, LANGUAGE_LABEL, type Language } from '@/lib/i18n/config'
import { Button, Field, Input, Notice, Select } from '@/components/ui'

/**
 * A superfície da cliente fala três línguas, e por isso nenhum texto
 * nasce aqui dentro: as palavras chegam de fora, já traduzidas.
 */

const EMPTY: AccountState = { error: null, done: null }

function Submit({
  label,
  variant = 'primary',
  size = 'md',
  className,
}: {
  label: string
  variant?: 'primary' | 'outline' | 'quiet' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
    >
      {label}
    </Button>
  )
}

// ---------------------------------------------------------------------
// Entrar
// ---------------------------------------------------------------------

export type PhoneLabels = {
  phone: string
  phoneHint: string
  submit: string
}

export function PhoneForm({
  labels,
  defaultPhone = '',
}: {
  labels: PhoneLabels
  defaultPhone?: string
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    requestCodeAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-5">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      <Field label={labels.phone} htmlFor="phone" hint={labels.phoneHint}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
          autoFocus
          inputMode="tel"
          autoComplete="tel"
          defaultValue={defaultPhone}
        />
      </Field>

      <Submit label={labels.submit} size="lg" className="w-full" />
    </form>
  )
}

export type CodeLabels = {
  code: string
  submit: string
  resend: string
}

export function CodeForm({ labels }: { labels: CodeLabels }) {
  const [state, action] = useActionState<AccountState, FormData>(
    verifyCodeAction,
    EMPTY,
  )

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-5">
        {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

        <Field label={labels.code} htmlFor="code">
          <Input
            id="code"
            name="code"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            className="tabular text-center text-lg tracking-[0.5em]"
          />
        </Field>

        <Submit label={labels.submit} size="lg" className="w-full" />
      </form>

      <form action={resendCodeAction} className="text-center">
        <button
          type="submit"
          className="text-[0.8125rem] text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
        >
          {labels.resend}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------
// As marcações
// ---------------------------------------------------------------------

export type CancelLabels = {
  cancel: string
  confirm: string
  back: string
}

/**
 * Cancelar em dois tempos: primeiro arma-se, depois confirma-se. Um
 * toque a mais não desmarca ninguém.
 */
export function CancelBooking({
  appointmentId,
  labels,
}: {
  appointmentId: string
  labels: CancelLabels
}) {
  const [armed, setArmed] = useState(false)
  const [state, action] = useActionState<AccountState, FormData>(
    cancelAction,
    EMPTY,
  )

  if (state.done) return <Notice tone="ok">{state.done}</Notice>

  return (
    <div className="space-y-2">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">
            {labels.confirm}
          </p>
          <form action={action}>
            <input type="hidden" name="appointment" value={appointmentId} />
            <Submit label={labels.cancel} variant="danger" size="sm" />
          </form>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => setArmed(false)}
          >
            {labels.back}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => setArmed(true)}
        >
          {labels.cancel}
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Os dados
// ---------------------------------------------------------------------

export type DetailsLabels = {
  name: string
  email: string
  optional: string
  phone: string
  phoneFixed: string
  language: string
  save: string
}

export function DetailsForm({
  labels,
  client,
}: {
  labels: DetailsLabels
  client: {
    name: string
    email: string | null
    phone: string
    language: Language
  }
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    saveDetailsAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-5">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.done ? <Notice tone="ok">{state.done}</Notice> : null}

      <Field label={labels.name} htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          defaultValue={client.name}
        />
      </Field>

      <Field label={labels.email} htmlFor="email" hint={labels.optional}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={client.email ?? ''}
        />
      </Field>

      <Field label={labels.phone} hint={labels.phoneFixed}>
        <Input value={client.phone} readOnly disabled className="tabular" />
      </Field>

      <Field label={labels.language} htmlFor="language">
        <Select id="language" name="language" defaultValue={client.language}>
          {LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {LANGUAGE_LABEL[language]}
            </option>
          ))}
        </Select>
      </Field>

      <Submit label={labels.save} />
    </form>
  )
}

export function SignOut({ label }: { label: string }) {
  return (
    <form action={signOutAction}>
      <Submit label={label} variant="quiet" size="sm" />
    </form>
  )
}
