'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  remarcarAction,
  type RemarcarState,
} from '@/app/(desk)/agenda/[loja]/remarcar/actions'
import { Button, Field, Input, Notice } from '@/components/ui'

const EMPTY: RemarcarState = { error: null }

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="md" disabled={pending}>
      Remarcar
    </Button>
  )
}

export function RemarcarForm({
  unitSlug,
  appointmentId,
  cartParam,
  timeIso,
}: {
  unitSlug: string
  appointmentId: string
  cartParam: string
  timeIso: string
}) {
  const [state, action] = useActionState<RemarcarState, FormData>(
    remarcarAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit" value={unitSlug} />
      <input type="hidden" name="appointment" value={appointmentId} />
      <input type="hidden" name="cart" value={cartParam} />
      <input type="hidden" name="time" value={timeIso} />

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Porquê" htmlFor="remarcar-reason">
          <Input
            id="remarcar-reason"
            name="reason"
            maxLength={160}
            autoComplete="off"
            placeholder="Pedido da cliente, atraso, troca de colaborador…"
          />
        </Field>
        <Submit />
      </div>
      <p className="text-[0.75rem] text-[var(--ink-faint)]">
        O motivo fica no histórico da marcação antiga — a nova nasce limpa.
      </p>
    </form>
  )
}
