'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import clsx from 'clsx'
import {
  logNotificationAction,
  transitionAction,
  type DeskState,
} from '@/app/(desk)/agenda/actions'
import { Button, Notice } from '@/components/ui'
import { IconChat } from '@/components/desk-icons'
import type { Status } from '@/lib/booking'
import type { Routine } from '@/lib/whatsapp'

const EMPTY: DeskState = { error: null, done: null }

type Variant = 'primary' | 'outline' | 'quiet' | 'danger'

/** O que corre mal fica em baixo, longe do passo natural do dia. */
const DESTRUCTIVE: Status[] = [
  'cancelled_by_client',
  'cancelled_by_salon',
  'no_show',
]

function Submit({
  label,
  variant,
  size = 'sm',
  className,
  icon,
}: {
  label: string
  variant: Variant
  size?: 'sm' | 'md'
  className?: string
  icon?: React.ReactNode
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
      {icon}
      {label}
    </Button>
  )
}

/**
 * Os botões do estado seguinte, POR ORDEM DE IMPORTÂNCIA: o passo
 * natural do dia (confirmar → check-in → iniciar → concluir) em grande,
 * os saltos possíveis em pequeno, e o que corre mal (cancelar, falta)
 * atrás de um fio, discreto.
 */
export function StatusButtons({
  appointmentId,
  options,
}: {
  appointmentId: string
  options: { to: Status; label: string }[]
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    transitionAction,
    EMPTY,
  )

  const forward = options.filter((o) => !DESTRUCTIVE.includes(o.to))
  const trouble = options.filter((o) => DESTRUCTIVE.includes(o.to))
  const [next, ...jumps] = forward

  const form = (to: Status, children: React.ReactNode, grow = false) => (
    <form key={to} action={action} className={grow ? 'w-full' : undefined}>
      <input type="hidden" name="appointment" value={appointmentId} />
      <input type="hidden" name="to" value={to} />
      {children}
    </form>
  )

  return (
    <div className="space-y-3">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      {next
        ? form(
            next.to,
            <Submit
              label={next.label}
              variant="primary"
              size="md"
              className="w-full"
            />,
            true,
          )
        : null}

      {jumps.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {jumps.map((option) =>
            form(
              option.to,
              <Submit label={option.label} variant="outline" />,
            ),
          )}
        </div>
      ) : null}

      {trouble.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--line-soft)] pt-3">
          {trouble.map((option) =>
            form(
              option.to,
              <Submit label={option.label} variant="danger" />,
            ),
          )}
        </div>
      ) : null}
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
  className,
}: {
  appointmentId: string
  routine: Routine
  href: string
  message: string
  label: string
  variant?: Variant
  size?: 'sm' | 'md'
  done?: boolean
  /**
   * A largura do botão, ditada por quem o põe: `w-full` no painel
   * lateral, `w-full sm:w-auto` na fila dos avisos — onde no telemóvel
   * ele fica sozinho numa linha e no ecrã largo volta para o fim da
   * linha da cliente. Vai à moldura e ao botão, para não haver um a
   * medir-se pelo outro.
   */
  className?: string
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    logNotificationAction,
    EMPTY,
  )

  return (
    <div className={clsx('space-y-2', className)}>
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
          className={className}
          icon={<IconChat className="h-4 w-4" />}
        />
      </form>
    </div>
  )
}
