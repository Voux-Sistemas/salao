'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  setMaintenanceAction,
  type SystemState,
} from '@/app/(desk)/admin/sistema/actions'
import { Field, Notice, Textarea } from '@/components/ui'

const EMPTY: SystemState = { error: null, done: null }

/**
 * O INTERRUPTOR DA CASA.
 *
 * Fechar é um botão só, sem confirmação: quem chega a esta página já
 * sabe o que veio fazer, e o passo a mais convidava a carregar sem ler.
 * Abrir também — é a acção que corrige, e uma acção que corrige nunca
 * se põe atrás de um obstáculo.
 *
 * O que se pede antes de fechar é o RECADO, não a confirmação. É o que
 * a cliente vai ler, e escrevê-lo obriga a pensar por um segundo em
 * quem está do outro lado.
 */
export function MaintenanceSwitch({
  since,
  note,
}: {
  since: string | null
  note: string | null
}) {
  const [state, action] = useActionState<SystemState, FormData>(
    setMaintenanceAction,
    EMPTY,
  )
  const [recado, setRecado] = useState(note ?? '')
  const fechada = since !== null

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.done ? <Notice tone="ok">{state.done}</Notice> : null}

      <input type="hidden" name="on" value={fechada ? '0' : '1'} />

      {fechada ? (
        <>
          <input type="hidden" name="note" value={recado} />
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            A montra, o funil de marcação, a área da cliente e o balcão
            estão fechados. Só quem monta o sistema entra — e a porta de
            entrada continua aberta, para não ficarem de fora.
          </p>
          <Abrir />
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            Fecha a casa inteira: a montra, o funil de marcação, a área da
            cliente e o balcão. As marcações que já estão feitas não se
            perdem — só ninguém pode fazer, mudar ou desmarcar nada
            enquanto isto durar.
          </p>

          <Field
            label="O que dizer a quem bater à porta"
            htmlFor="recado"
            hint="Fica na página que a cliente vê. Em branco, aparece a frase de sempre."
          >
            <Textarea
              id="recado"
              name="note"
              value={recado}
              onChange={(e) => setRecado(e.target.value)}
              maxLength={280}
              rows={2}
              placeholder="Estamos a afinar uma coisa no sistema. É por pouco tempo."
            />
          </Field>

          <Fechar />
        </>
      )}
    </form>
  )
}

function Fechar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-[var(--radius)] bg-[var(--bad)] px-6 text-sm font-bold text-white transition-opacity disabled:opacity-50"
    >
      {pending ? 'A fechar…' : 'Fechar a casa'}
    </button>
  )
}

function Abrir() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-[var(--radius)] bg-[var(--ok)] px-6 text-sm font-bold text-white transition-opacity disabled:opacity-50"
    >
      {pending ? 'A abrir…' : 'Abrir a casa'}
    </button>
  )
}
