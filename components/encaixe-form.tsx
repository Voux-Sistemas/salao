'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  encaixeAction,
  type EncaixeState,
} from '@/app/(desk)/agenda/[loja]/encaixe/actions'
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui'
import { SOURCE_LABEL } from '@/lib/status'
import { formatPhone } from '@/lib/text'

const EMPTY: EncaixeState = { error: null }

/** A origem de um encaixe nunca é o site — o site marca-se sozinho. */
const SOURCES = ['counter', 'phone', 'whatsapp', 'walk_in'] as const

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="md" disabled={pending}>
      Marcar encaixe
    </Button>
  )
}

export function EncaixeForm({
  unitSlug,
  cartParam,
  timeIso,
  client,
}: {
  unitSlug: string
  cartParam: string
  timeIso: string
  client: { id: string; name: string; phone: string } | null
}) {
  const [state, action] = useActionState<EncaixeState, FormData>(
    encaixeAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unit" value={unitSlug} />
      <input type="hidden" name="cart" value={cartParam} />
      <input type="hidden" name="time" value={timeIso} />
      {client ? <input type="hidden" name="client" value={client.id} /> : null}

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      {client ? (
        <p className="text-sm text-[var(--ink)]">
          {client.name}{' '}
          <span className="tabular text-[var(--ink-muted)]">{formatPhone(client.phone)}</span>
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" htmlFor="encaixe-name">
            <Input id="encaixe-name" name="name" autoComplete="off" required />
          </Field>
          <Field
            label="Telefone"
            htmlFor="encaixe-phone"
            hint="É por aqui que a ficha se reconhece."
          >
            <Input
              id="encaixe-phone"
              name="phone"
              inputMode="tel"
              autoComplete="off"
              required
            />
          </Field>
        </div>
      )}

      <Field label="Como chegou" htmlFor="encaixe-source">
        <Select id="encaixe-source" name="source" defaultValue="counter">
          {SOURCES.map((value) => (
            <option key={value} value={value}>
              {SOURCE_LABEL[value]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nota interna" htmlFor="encaixe-note">
        <Textarea
          id="encaixe-note"
          name="note"
          maxLength={500}
          className="min-h-16"
          placeholder="Só a equipa vê isto."
        />
      </Field>

      <Submit />
    </form>
  )
}
