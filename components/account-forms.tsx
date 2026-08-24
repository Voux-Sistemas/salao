'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
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
import { formatPhone } from '@/lib/text'
import { PhoneInput } from '@/components/phone-input'

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
        <PhoneInput
          id="phone"
          name="phone"
          required
          autoFocus
          defaultValue={defaultPhone}
        />
      </Field>

      <Submit label={labels.submit} size="lg" className="w-full" />
    </form>
  )
}

export type CodeLabels = {
  code: string
  hint: string
  submit: string
  resend: string
}

const CODE_LENGTH = 6

/**
 * Seis casas, um dígito em cada. Escreve-se sem pensar: o cursor
 * avança sozinho, o backspace recua, e colar o código inteiro numa
 * casa qualquer preenche as restantes. Quando a última casa fecha, o
 * formulário segue por si — ela não tem de procurar o botão.
 */
export function CodeForm({ labels }: { labels: CodeLabels }) {
  const [state, action] = useActionState<AccountState, FormData>(
    verifyCodeAction,
    EMPTY,
  )
  const [digits, setDigits] = useState<string[]>(() =>
    Array(CODE_LENGTH).fill(''),
  )
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const form = useRef<HTMLFormElement | null>(null)
  const sent = useRef(false)

  const code = digits.join('')

  // Um código recusado limpa as casas e devolve o cursor à primeira.
  useEffect(() => {
    if (!state.error) return
    sent.current = false
    setDigits(Array(CODE_LENGTH).fill(''))
    boxes.current[0]?.focus()
  }, [state.error])

  // Assim que as seis casas estão cheias, vai.
  useEffect(() => {
    if (code.length < CODE_LENGTH || sent.current) return
    sent.current = true
    form.current?.requestSubmit()
  }, [code])

  function focusAt(index: number) {
    const box = boxes.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))]
    box?.focus()
    box?.select()
  }

  function write(index: number, value: string) {
    const typed = value.replace(/\D/g, '')
    if (!typed) return
    setDigits((previous) => {
      const next = [...previous]
      for (let i = 0; i < typed.length && index + i < CODE_LENGTH; i += 1) {
        next[index + i] = typed[i] ?? ''
      }
      return next
    })
    focusAt(index + typed.length)
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      setDigits((previous) => {
        const next = [...previous]
        if (next[index]) next[index] = ''
        else if (index > 0) next[index - 1] = ''
        return next
      })
      if (!digits[index]) focusAt(index - 1)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAt(index - 1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusAt(index + 1)
    }
  }

  return (
    <div className="space-y-5">
      <form ref={form} action={action} className="space-y-6">
        {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

        <input type="hidden" name="code" value={code} />

        <fieldset>
          <legend className="mb-3 block w-full text-center text-[0.8125rem] font-medium text-[var(--ink)]">
            {labels.code}
          </legend>

          <div className="flex justify-center gap-2 sm:gap-2.5">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => {
                  boxes.current[index] = node
                }}
                value={digit}
                onChange={(event) => write(index, event.target.value)}
                onKeyDown={(event) => onKeyDown(index, event)}
                onFocus={(event) => event.target.select()}
                onPaste={(event) => {
                  event.preventDefault()
                  write(index, event.clipboardData.getData('text'))
                }}
                aria-label={`${labels.code} ${index + 1}`}
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                autoFocus={index === 0}
                maxLength={CODE_LENGTH}
                className="tabular h-[3.25rem] w-11 border border-[var(--line)] bg-[var(--surface)] text-center text-xl text-[var(--ink)] transition-all outline-none focus:-translate-y-0.5 focus:border-[var(--accent)] focus:shadow-[var(--shadow-soft)] sm:w-12"
              />
            ))}
          </div>

          <p className="mt-3 text-center text-[0.75rem] text-[var(--ink-faint)]">
            {labels.hint}
          </p>
        </fieldset>

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
        <Input value={formatPhone(client.phone)} readOnly disabled className="tabular" />
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
