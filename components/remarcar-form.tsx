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
    <form action={action} className="space-y-4">
      <input type="hidden" name="unit" value={unitSlug} />
      <input type="hidden" name="appointment" value={appointmentId} />
      <input type="hidden" name="cart" value={cartParam} />
      <input type="hidden" name="time" value={timeIso} />

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      <Field
        label="Porquê"
        htmlFor="remarcar-reason"
        hint="Fica no histórico da marcação antiga."
      >
        <Input
          id="remarcar-reason"
          name="reason"
          maxLength={160}
          autoComplete="off"
          placeholder="Pedido da cliente, atraso, troca de profissional…"
        />
      </Field>

      <Submit />
    </form>
  )
}
