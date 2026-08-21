'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  logNotificationAction,
  transitionAction,
  type DeskState,
} from '@/app/(desk)/agenda/actions'
import { Button, Notice } from '@/components/ui'
import type { Status } from '@/lib/booking'
import type { Routine } from '@/lib/whatsapp'

const EMPTY: DeskState = { error: null, done: null }

type Variant = 'primary' | 'outline' | 'quiet' | 'danger'

function Submit({
  label,
  variant,
  size = 'sm',
}: {
  label: string
  variant: Variant
  size?: 'sm' | 'md'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {label}
    </Button>
  )
}

/**
 * Os botões do estado seguinte: Confirmar · Check-in · Iniciar ·
 * Concluir · Cancelar · Falta.
 */
export function StatusButtons({
  appointmentId,
  options,
}: {
  appointmentId: string
  options: { to: Status; label: string; variant: Variant }[]
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    transitionAction,
    EMPTY,
  )

  return (
    <div className="space-y-3">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <form key={option.to} action={action}>
            <input type="hidden" name="appointment" value={appointmentId} />
            <input type="hidden" name="to" value={option.to} />
            <Submit label={option.label} variant={option.variant} />
          </form>
        ))}
      </div>
    </div>
  )
}

/**
 * O sistema NÃO envia sozinho: prepara a mensagem e abre a conversa.
 * Uma pessoa carrega no botão — e é o registo do envio, não outra coisa
 * qualquer, que tira a linha da fila.
 *
 * Mandar a confirmação NÃO muda o estado da marcação.
 */
export function SendWhatsApp({
  appointmentId,
  routine,
  href,
  message,
  label,
  variant = 'outline',
  size = 'sm',
  done = false,
}: {
  appointmentId: string
  routine: Routine
  href: string
  message: string
  label: string
  variant?: Variant
  size?: 'sm' | 'md'
  done?: boolean
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    logNotificationAction,
    EMPTY,
  )

  return (
    <div className="space-y-2">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <form
        action={action}
        onSubmit={() => {
          window.open(href, '_blank', 'noopener,noreferrer')
        }}
      >
        <input type="hidden" name="appointment" value={appointmentId} />
        <input type="hidden" name="routine" value={routine} />
        <input type="hidden" name="message" value={message} />
        <Submit
          label={done ? `${label} (de novo)` : label}
          variant={done ? 'quiet' : variant}
          size={size}
        />
      </form>
    </div>
  )
}
