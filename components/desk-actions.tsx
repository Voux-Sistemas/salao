'use client'

import { useActionState, useState } from 'react'
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
 * UMA LINHA DENTRO DE UMA CAIXA.
 *
 * A pergunta do cancelamento e as duas portas discretas do painel — a
 * comanda e a remarcação — usam a mesma moldura, e é por isso que a
 * classe sai daqui: umas são botões de formulário e outras são
 * ligações, e têm de ficar iguais.
 */
export const MENU_LINHA =
  'flex w-full items-center gap-2.5 border-t border-[var(--line-soft)] px-3.5 py-2.5 text-left text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:opacity-50'

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
 */
export function StatusAction({
  appointmentId,
  to,
  label,
  variant = 'outline',
  size = 'sm',
  full = false,
  icon,
  className,
}: {
  appointmentId: string
  to: Status
  label: string
  variant?: Variant
  size?: 'sm' | 'md'
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
 * CANCELAR — UM BOTÃO, E DEPOIS A PERGUNTA.
 *
 * Foram três botões vermelhos do tamanho dos outros, e o vermelho era um
 * terço do painel. Depois foram três linhas cinzentas de um menu, e aí
 * cancelar uma marcação passou a custar exactamente o mesmo que abrir
 * uma comanda: um toque, sem aviso, sem volta.
 *
 * Agora é UM botão, discreto, ao lado dos outros dois. Carregar nele não
 * cancela nada: abre a pergunta. Só o segundo toque envia — e é lá, na
 * pergunta, que se diz QUAL das três coisas aconteceu, porque a cliente
 * ter desmarcado, a casa ter desmarcado e a cliente não ter aparecido
 * são três factos diferentes e a estatística do ano vive deles.
 *
 * Sem caixas de diálogo, sem nada a saltar por cima do ecrã: a pergunta
 * nasce onde estava o botão, e «deixar como está» fecha-a.
 */
export function CancelAction({
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
  const [aberto, setAberto] = useState(false)

  if (!aberto) {
    return (
      <div className="space-y-2">
        {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => setAberto(true)}
          className="w-full border-[color-mix(in_srgb,var(--bad)_35%,transparent)] text-[var(--bad)] hover:border-[var(--bad)]"
        >
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="overflow-hidden rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--bad)_35%,transparent)]">
        <p className="px-3.5 py-2.5 text-[0.75rem] font-semibold text-[var(--bad)]">
          O que aconteceu?
        </p>
        {options.map((option) => (
          <form key={option.to} action={action}>
            <input type="hidden" name="appointment" value={appointmentId} />
            <input type="hidden" name="to" value={option.to} />
            <MenuSubmit label={option.label} />
          </form>
        ))}
        <button
          type="button"
          onClick={() => setAberto(false)}
          className={clsx(MENU_LINHA, 'justify-center text-[0.75rem]')}
        >
          Deixar como está
        </button>
      </div>
    </div>
  )
}

function MenuSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(MENU_LINHA, 'font-semibold text-[var(--bad)]')}
    >
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
