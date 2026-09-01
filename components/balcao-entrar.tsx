'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrarNoBalcaoAction, type EntrarState } from '@/app/(auth)/entrar/balcao'
import { Button, Field, Input, Notice } from '@/components/ui'

const VAZIO: EntrarState = {}

/**
 * A PORTA DE SERVIÇO — o código do balcão.
 *
 * Põe o aparelho em modo balcão e mais nada: nunca a Gestão, nunca os
 * números. É por isso que pode andar escrito num papel ao lado do
 * tablet, e é por isso que este formulário pode estar à vista de toda a
 * gente na página de entrada.
 *
 * `inputMode="numeric"` faz o tablet abrir o teclado dos números, que é
 * o que se quer quando o campo só aceita seis dígitos.
 */
export function BalcaoCodeForm() {
  const [state, action] = useActionState<EntrarState, FormData>(
    entrarNoBalcaoAction,
    VAZIO,
  )

  return (
    <form action={action} className="space-y-3">
      <p className="text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
        <strong className="font-semibold text-[var(--ink)]">
          Tablet do salão?
        </strong>{' '}
        Escreva o código do balcão — abre a agenda, os avisos e as
        clientes.
      </p>

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      <Field label="Código do balcão" htmlFor="codigo">
        <Input
          id="codigo"
          name="codigo"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="000000"
          className="tabular tracking-[0.3em]"
        />
      </Field>

      <Entrar />
    </form>
  )
}

function Entrar() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="outline"
      size="md"
      className="w-full"
      disabled={pending}
    >
      {pending ? 'A abrir…' : 'Abrir o balcão'}
    </Button>
  )
}
