'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import {
  addPaymentAction,
  closeComandaAction,
  removePaymentAction,
  setDiscountAction,
  type ComandaState,
} from '@/app/(desk)/agenda/[loja]/comanda/actions'
import { Button, Field, Input, Notice } from '@/components/ui'
import { centsToInput, formatCents } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/status'

const EMPTY: ComandaState = { error: null, done: null }

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
      className={className}
      disabled={pending}
    >
      {label}
    </Button>
  )
}

function Result({ state }: { state: ComandaState }) {
  if (state.error) return <Notice tone="bad">{state.error}</Notice>
  if (state.done) return <Notice tone="ok">{state.done}</Notice>
  return null
}

/**
 * No máximo UM desconto por comanda, com motivo e autor. É abatido por
 * cima — não toca no preço congelado de nenhum item.
 */
export function DiscountForm({
  appointmentId,
  discountCents,
  discountReason,
}: {
  appointmentId: string
  discountCents: number
  discountReason: string | null
}) {
  const [state, action] = useActionState<ComandaState, FormData>(
    setDiscountAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="appointment" value={appointmentId} />
      <Result state={state} />
      <div className="grid gap-3 sm:grid-cols-[8.5rem_1fr_auto] sm:items-end">
        <Field label="Valor" htmlFor="discount-amount">
          <Input
            id="discount-amount"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={discountCents > 0 ? centsToInput(discountCents) : ''}
            className="tabular"
          />
        </Field>
        <Field label="Motivo" htmlFor="discount-reason">
          <Input
            id="discount-reason"
            name="reason"
            maxLength={120}
            placeholder="Cortesia, retoque, cliente da casa…"
            defaultValue={discountReason ?? ''}
          />
        </Field>
        <Submit label="Guardar" variant="outline" />
      </div>
      <p className="text-[0.75rem] text-[var(--ink-faint)]">
        Abate-se por cima da conta — o preço congelado de cada serviço não
        se toca.
      </p>
    </form>
  )
}

/**
 * Uma linha por método: uma visita pode ser meia em cartão e meia em
 * dinheiro. O dinheiro vivo entra na caixa quando a comanda fecha.
 */
export function PaymentForm({
  appointmentId,
  dueCents,
}: {
  appointmentId: string
  dueCents: number
}) {
  const [state, action] = useActionState<ComandaState, FormData>(
    addPaymentAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="appointment" value={appointmentId} />
      <Result state={state} />
      <Field label="Método">
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label="Método de pagamento"
        >
          {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
            <label
              key={value}
              className="flex h-9 cursor-pointer select-none items-center border border-[var(--line-soft)] px-3 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)] has-[:checked]:text-[var(--accent-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)]"
            >
              <input
                type="radio"
                name="method"
                value={value}
                defaultChecked={value === 'cash'}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </Field>
      <div className="flex items-end gap-3">
        <Field label="Valor" htmlFor="payment-amount" className="w-[8.5rem]">
          <Input
            id="payment-amount"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={dueCents > 0 ? centsToInput(dueCents) : ''}
            className="tabular"
          />
        </Field>
        <Submit label="Receber" />
      </div>
    </form>
  )
}

export function RemovePayment({
  appointmentId,
  paymentId,
}: {
  appointmentId: string
  paymentId: string
}) {
  const [state, action] = useActionState<ComandaState, FormData>(
    removePaymentAction,
    EMPTY,
  )

  return (
    <form action={action} title={state.error ?? 'Apagar pagamento'}>
      <input type="hidden" name="appointment" value={appointmentId} />
      <input type="hidden" name="payment" value={paymentId} />
      <button
        type="submit"
        aria-label="Apagar pagamento"
        className="p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  )
}

/**
 * Fechar gera as comissões e lança o dinheiro na caixa. Não se desfaz —
 * por isso pergunta-se duas vezes.
 */
export function CloseComanda({
  appointmentId,
  dueCents,
}: {
  appointmentId: string
  dueCents: number
}) {
  const [state, action] = useActionState<ComandaState, FormData>(
    closeComandaAction,
    EMPTY,
  )
  const [armed, setArmed] = useState(false)

  if (dueCents > 0) {
    return (
      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
          <span className="text-[var(--warn)]">Falta receber</span>
          <span className="tabular text-[var(--warn)]">
            {formatCents(dueCents)}
          </span>
        </p>
        <p className="text-[0.75rem] leading-relaxed text-[var(--ink-muted)]">
          A comanda fecha quando a conta estiver paga.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Result state={state} />
      {armed ? (
        <form action={action} className="space-y-2.5">
          <input type="hidden" name="appointment" value={appointmentId} />
          <p className="text-[0.75rem] leading-relaxed text-[var(--ink-muted)]">
            Ao fechar geram-se as comissões e o dinheiro vivo entra na
            caixa. Depois disto não se acrescentam pagamentos nem
            descontos.
          </p>
          <Submit label="Fechar mesmo" size="lg" className="w-full" />
          <Button
            type="button"
            variant="quiet"
            size="sm"
            className="w-full"
            onClick={() => setArmed(false)}
          >
            Afinal não
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => setArmed(true)}
        >
          Fechar comanda
        </Button>
      )}
    </div>
  )
}
