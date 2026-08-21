'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  closeCashAction,
  movementAction,
  openCashAction,
  type CashState,
} from '@/app/(desk)/caixa/[loja]/actions'
import { Button, Field, Input, Notice } from '@/components/ui'
import { formatCents, inputToCents } from '@/lib/money'

const EMPTY: CashState = { error: null, done: null }

function Submit({
  label,
  variant = 'primary',
  size = 'md',
}: {
  label: string
  variant?: 'primary' | 'outline' | 'quiet' | 'danger'
  size?: 'sm' | 'md'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {label}
    </Button>
  )
}

function Result({ state }: { state: CashState }) {
  if (state.error) return <Notice tone="bad">{state.error}</Notice>
  if (state.done) return <Notice tone="ok">{state.done}</Notice>
  return null
}

export function OpenCashForm({ unitSlug }: { unitSlug: string }) {
  const [state, action] = useActionState<CashState, FormData>(
    openCashAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit" value={unitSlug} />
      <Result state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="O que está na gaveta"
          htmlFor="cash-open"
          className="w-40"
        >
          <Input
            id="cash-open"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue="0,00"
            className="tabular"
          />
        </Field>
        <Submit label="Abrir caixa" />
      </div>
    </form>
  )
}

/** Reforço entra, sangria sai. As vendas não passam por aqui. */
export function MovementForm({
  unitSlug,
  kind,
}: {
  unitSlug: string
  kind: 'reinforcement' | 'withdrawal'
}) {
  const [state, action] = useActionState<CashState, FormData>(
    movementAction,
    EMPTY,
  )
  const withdrawal = kind === 'withdrawal'

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit" value={unitSlug} />
      <input type="hidden" name="kind" value={kind} />
      <Result state={state} />
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr_auto] sm:items-end">
        <Field label="Valor" htmlFor={`cash-${kind}-amount`}>
          <Input
            id={`cash-${kind}-amount`}
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            className="tabular"
          />
        </Field>
        <Field
          label="Motivo"
          htmlFor={`cash-${kind}-note`}
          hint={withdrawal ? 'Obrigatório numa sangria.' : undefined}
        >
          <Input
            id={`cash-${kind}-note`}
            name="note"
            maxLength={120}
            autoComplete="off"
            placeholder={withdrawal ? 'Depósito, troco, despesa…' : 'Troco'}
          />
        </Field>
        <Submit
          label={withdrawal ? 'Sangrar' : 'Reforçar'}
          variant="outline"
        />
      </div>
    </form>
  )
}

/**
 * Fechar é contar a gaveta. Mostra-se o esperado, guarda-se o contado, e
 * a diferença fica escrita — não se corrige nem se esconde.
 */
export function CloseCashForm({
  unitSlug,
  expectedCents,
}: {
  unitSlug: string
  expectedCents: number
}) {
  const [state, action] = useActionState<CashState, FormData>(
    closeCashAction,
    EMPTY,
  )
  const [counted, setCounted] = useState('')
  const [armed, setArmed] = useState(false)

  const parsed = inputToCents(counted)
  const difference = parsed === null ? null : parsed - expectedCents

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit" value={unitSlug} />
      <Result state={state} />

      <div className="grid gap-3 sm:grid-cols-[9rem_1fr] sm:items-end">
        <Field label="Contado na gaveta" htmlFor="cash-counted">
          <Input
            id="cash-counted"
            name="counted"
            inputMode="decimal"
            placeholder="0,00"
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
            className="tabular"
          />
        </Field>
        <Field label="Nota do fecho" htmlFor="cash-close-note">
          <Input
            id="cash-close-note"
            name="note"
            maxLength={160}
            autoComplete="off"
            placeholder="O que explica a diferença, se houver."
          />
        </Field>
      </div>

      {difference !== null ? (
        <p className="tabular text-[0.8125rem] text-[var(--ink-muted)]">
          Esperado {formatCents(expectedCents)} · diferença{' '}
          <span
            style={{
              color:
                difference === 0
                  ? 'var(--ok)'
                  : difference > 0
                    ? 'var(--warn)'
                    : 'var(--bad)',
            }}
          >
            {difference > 0 ? '+' : ''}
            {formatCents(difference)}
          </span>
        </p>
      ) : null}

      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <Submit label="Fechar mesmo" />
          <Button
            type="button"
            variant="quiet"
            size="md"
            onClick={() => setArmed(false)}
          >
            Afinal não
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setArmed(true)}
          disabled={parsed === null}
        >
          Fechar caixa
        </Button>
      )}
    </form>
  )
}
