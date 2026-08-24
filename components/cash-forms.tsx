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
      <div className="flex flex-wrap items-end justify-center gap-3">
        <Field
          label="Fundo de abertura"
          htmlFor="cash-open"
          className="w-44"
        >
          <Input
            id="cash-open"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue="0,00"
            className="tabular h-11 text-right text-base"
          />
        </Field>
        <Submit label="Abrir a caixa" />
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
    <div>
      <p className="eyebrow">{withdrawal ? 'Sangria' : 'Reforço'}</p>
      <p className="mb-3 mt-1 text-[0.75rem] text-[var(--ink-muted)]">
        {withdrawal
          ? 'Dinheiro que sai da gaveta — depósito, troco, despesa.'
          : 'Dinheiro que entra à mão — o troco que faltava.'}
      </p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="unit" value={unitSlug} />
        <input type="hidden" name="kind" value={kind} />
        <Result state={state} />
        <div className="grid gap-3 sm:grid-cols-[7.5rem_1fr]">
          <Field label="Valor" htmlFor={`cash-${kind}-amount`}>
            <Input
              id={`cash-${kind}-amount`}
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              className="tabular text-right"
            />
          </Field>
          <Field
            label="Motivo"
            htmlFor={`cash-${kind}-note`}
            hint={
              withdrawal ? 'Obrigatório numa sangria.' : 'Opcional num reforço.'
            }
          >
            <Input
              id={`cash-${kind}-note`}
              name="note"
              maxLength={120}
              autoComplete="off"
              placeholder={withdrawal ? 'Depósito, troco, despesa…' : 'Troco'}
            />
          </Field>
        </div>
        <Submit
          label={withdrawal ? 'Registar sangria' : 'Registar reforço'}
          variant="outline"
          size="sm"
        />
      </form>
    </div>
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
    <form action={action} className="space-y-4">
      <input type="hidden" name="unit" value={unitSlug} />
      <Result state={state} />

      <div className="grid gap-3 sm:grid-cols-[11rem_1fr] sm:items-start">
        <Field label="Contado na gaveta" htmlFor="cash-counted">
          <Input
            id="cash-counted"
            name="counted"
            inputMode="decimal"
            placeholder="0,00"
            value={counted}
            onChange={(event) => setCounted(event.target.value)}
            className="tabular h-11 text-right text-base"
          />
        </Field>
        <Field label="Nota do fecho" htmlFor="cash-close-note">
          <Input
            id="cash-close-note"
            name="note"
            maxLength={160}
            autoComplete="off"
            placeholder="O que explica a diferença, se houver."
            className="h-11"
          />
        </Field>
      </div>

      {difference !== null ? (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[0.8125rem]">
          <span className="text-[var(--ink-muted)]">
            Esperado{' '}
            <span className="tabular text-[var(--ink)]">
              {formatCents(expectedCents)}
            </span>
          </span>
          <span className="text-[var(--ink-muted)]">
            Contado{' '}
            <span className="tabular text-[var(--ink)]">
              {formatCents(parsed ?? 0)}
            </span>
          </span>
          <span
            className="tabular"
            style={{
              color:
                difference === 0
                  ? 'var(--ok)'
                  : difference > 0
                    ? 'var(--warn)'
                    : 'var(--bad)',
            }}
          >
            {difference === 0
              ? 'A gaveta bate certo'
              : `Diferença ${difference > 0 ? '+' : ''}${formatCents(difference)}`}
          </span>
        </div>
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
