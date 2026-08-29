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

/**
 * UMA LINHA DA LISTA DO RESTO.
 *
 * O que não é o passo do dia — remarcar, abrir a comanda, dar por
 * faltada, cancelar — vive numa lista sem cor, em baixo. É a mesma
 * moldura para uma ligação e para um botão de formulário, e por isso a
 * classe sai daqui: quem monta a lista é o painel, e as duas coisas têm
 * de ficar iguais.
 */
export const MENU_LINHA =
  'flex w-full items-center gap-2.5 border-t border-[var(--line-soft)] px-3.5 py-2.5 text-left text-[0.8125rem] text-[var(--ink-muted)] transition-colors first:border-t-0 hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:opacity-50'

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
 * UM BOTÃO QUE MUDA O ESTADO DA MARCAÇÃO.
 *
 * Era um bloco que recebia a lista toda dos estados seguintes e a
 * arrumava sozinho: o primeiro em grande, os outros em pequeno, os maus
 * a vermelho. Com nove saídas à vista, nenhuma era a saída — e a que
 * ficava em grande era «Check-in», um passo que ninguém dá.
 *
 * Agora quem arruma é o painel, que sabe o que é o passo do dia e o que
 * é o resto. Aqui fica só a peça: um formulário e um botão.
 *
 * `charge` manda o servidor abrir a comanda a seguir. Não viaja
 * nenhuma morada — só um sim, e a morada monta-se lá.
 */
export function StatusAction({
  appointmentId,
  to,
  label,
  variant = 'outline',
  size = 'sm',
  charge = false,
  full = false,
  icon,
  className,
}: {
  appointmentId: string
  to: Status
  label: string
  variant?: Variant
  size?: 'sm' | 'md'
  charge?: boolean
  full?: boolean
  icon?: React.ReactNode
  className?: string
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    transitionAction,
    EMPTY,
  )

  return (
    <form action={action} className={clsx('space-y-2', className)}>
      <input type="hidden" name="appointment" value={appointmentId} />
      <input type="hidden" name="to" value={to} />
      {charge ? <input type="hidden" name="charge" value="1" /> : null}
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Submit
        label={label}
        variant={variant}
        size={size}
        icon={icon}
        className={full ? 'w-full' : undefined}
      />
    </form>
  )
}

/**
 * O QUE CORRE MAL, NUMA LISTA SEM COR.
 *
 * Eram três botões vermelhos do tamanho dos outros, e o vermelho era um
 * terço do painel — num ecrã onde cancelar uma marcação é o que se faz
 * uma vez por semana. Descem para linhas de uma lista: continuam à mão,
 * deixam de gritar.
 *
 * Partilham um estado de erro, porque só se carrega numa de cada vez.
 */
export function ProblemButtons({
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

  return (
    <>
      {state.error ? (
        <div className="border-t border-[var(--line-soft)] px-3.5 py-2.5">
          <Notice tone="bad">{state.error}</Notice>
        </div>
      ) : null}
      {options.map((option) => (
        <form key={option.to} action={action}>
          <input type="hidden" name="appointment" value={appointmentId} />
          <input type="hidden" name="to" value={option.to} />
          <MenuSubmit label={option.label} />
        </form>
      ))}
    </>
  )
}

function MenuSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={MENU_LINHA}>
      {label}
    </button>
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
