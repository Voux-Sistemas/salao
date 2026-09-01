'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { abrirAction, type AbrirState } from '@/app/(desk)/balcao/actions'
import { Button, Field, Input, Notice } from '@/components/ui'

const VAZIO: AbrirState = {}

/**
 * A palavra-passe dela, no tablet.
 *
 * `autoComplete="current-password"` de propósito: o gestor de senhas do
 * aparelho é dela, e se o tiver ali é um toque em vez de escrever. Num
 * tablet de balcão o mais provável é não ter, e aí escreve-se.
 */
export function AbrirBalcaoForm() {
  const [state, action] = useActionState<AbrirState, FormData>(
    abrirAction,
    VAZIO,
  )

  return (
    <form action={action} className="space-y-5">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      <Field label="Palavra-passe" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
        />
      </Field>

      <Abrir />

      <p className="text-center">
        <Link
          href="/agenda"
          className="text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          Deixar como está
        </Link>
      </p>
    </form>
  )
}

function Abrir() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="primary"
      size="md"
      className="w-full"
      disabled={pending}
    >
      {pending ? 'A abrir…' : 'Abrir'}
    </Button>
  )
}
