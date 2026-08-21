'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  requestResetAction,
  resetPasswordAction,
  signInAction,
  type FormState,
} from '@/app/(auth)/entrar/actions'
import { setupAction } from '@/app/(auth)/comecar/actions'
import { Button, Field, Input, Notice } from '@/components/ui'

/**
 * As portas da equipa. A área da equipa não é traduzida — está toda em
 * português da casa.
 */

const EMPTY: FormState = { error: null, done: null }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {label}
    </Button>
  )
}

function Result({ state }: { state: FormState }) {
  if (state.error) return <Notice tone="bad">{state.error}</Notice>
  if (state.done) return <Notice tone="ok">{state.done}</Notice>
  return null
}

// ---------------------------------------------------------------------

export function SignInForm() {
  const [state, action] = useActionState<FormState, FormData>(
    signInAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-5">
      <Result state={state} />

      <Field label="Telemóvel" htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="username"
          autoFocus
        />
      </Field>

      <Field label="Palavra-passe" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>

      <Submit label="Entrar" />
    </form>
  )
}

// ---------------------------------------------------------------------

export function RequestResetForm() {
  const [state, action] = useActionState<FormState, FormData>(
    requestResetAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-5">
      <Result state={state} />

      <Field
        label="E-mail"
        htmlFor="email"
        hint="Enviamos-lhe um código para escrever no ecrã seguinte."
      >
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
        />
      </Field>

      <Submit label="Pedir código" />
    </form>
  )
}

// ---------------------------------------------------------------------

export function ResetPasswordForm({ email = '' }: { email?: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    resetPasswordAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-5">
      <Result state={state} />

      <Field label="E-mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={email}
          autoComplete="email"
        />
      </Field>

      <Field label="Código" htmlFor="code" hint="Seis dígitos, válidos 10 minutos.">
        <Input
          id="code"
          name="code"
          required
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          className="tabular tracking-[0.35em]"
        />
      </Field>

      <Field label="Nova palavra-passe" htmlFor="password" hint="Pelo menos 8 caracteres.">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>

      <Field label="Repetir" htmlFor="repeat">
        <Input
          id="repeat"
          name="repeat"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>

      <Submit label="Guardar e entrar" />
    </form>
  )
}

// ---------------------------------------------------------------------

export function SetupForm({ timezone }: { timezone: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    setupAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-5">
      <Result state={state} />

      <Field
        label="Código de instalação"
        htmlFor="setup"
        hint="Está na variável SETUP_CODE do ambiente."
      >
        <Input id="setup" name="setup" required autoFocus autoComplete="off" />
      </Field>

      <div className="rule" />

      <Field label="Nome da rede" htmlFor="org" hint="Aparece na montra e nas mensagens.">
        <Input id="org" name="org" required autoComplete="organization" />
      </Field>

      <Field label="Fuso horário" htmlFor="timezone">
        <Input id="timezone" name="timezone" defaultValue={timezone} required />
      </Field>

      <div className="rule" />

      <Field label="O seu nome" htmlFor="name">
        <Input id="name" name="name" required autoComplete="name" />
      </Field>

      <Field label="Telemóvel" htmlFor="phone" hint="É com ele que entra daqui em diante.">
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="username"
        />
      </Field>

      <Field label="E-mail" htmlFor="email" hint="Serve para recuperar a palavra-passe.">
        <Input id="email" name="email" type="email" autoComplete="email" />
      </Field>

      <Field label="Palavra-passe" htmlFor="password" hint="Pelo menos 8 caracteres.">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>

      <Field label="Repetir" htmlFor="repeat">
        <Input
          id="repeat"
          name="repeat"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>

      <Submit label="Criar a rede" />
    </form>
  )
}
