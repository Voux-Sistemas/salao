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
import { Button, Field, Input, Notice, Select } from '@/components/ui'
import { centsToInput, formatCents } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/status'

const EMPTY: ComandaState = { error: null, done: null }

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
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr_auto] sm:items-end">
        <Field label="Desconto" htmlFor="discount-amount">
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
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <Field label="Método" htmlFor="payment-method">
          <Select id="payment-method" name="method" defaultValue="cash">
            {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valor" htmlFor="payment-amount">
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
      <div className="space-y-2">
        <Notice tone="warn">
          Falta receber {formatCents(dueCents)}. A comanda fecha quando a conta
          estiver paga.
        </Notice>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Result state={state} />
      {armed ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="appointment" value={appointmentId} />
          <p className="w-full text-[0.8125rem] text-[var(--ink-muted)]">
            Ao fechar geram-se as comissões e o dinheiro vivo entra na caixa.
            Depois disto não se acrescentam pagamentos nem descontos.
          </p>
          <Submit label="Fechar mesmo" />
          <Button
            type="button"
            variant="quiet"
            size="md"
            onClick={() => setArmed(false)}
          >
            Afinal não
          </Button>
        </form>
      ) : (
        <Button type="button" onClick={() => setArmed(true)}>
          Fechar comanda
        </Button>
      )}
    </div>
  )
}
