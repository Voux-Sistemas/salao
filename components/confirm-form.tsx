'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { bookAction, type BookState } from '@/app/(public)/agendar/[loja]/confirmar/actions'
import { PhoneInput } from '@/components/phone-input'
import { Button, Field, Input, Notice, Textarea } from '@/components/ui'

export type ConfirmLabels = {
  name: string
  phone: string
  phoneHint: string
  phoneWarning: string
  note: string
  notePlaceholder: string
  optional: string
  submit: string
}

/**
 * O último passo. Só nome e telefone: não é preciso conta para marcar —
 * o telefone é a identidade, e se já existir ficha a marcação agrega-se
 * a ela.
 */
export function ConfirmForm({
  unitSlug,
  cart,
  time,
  labels,
  defaultName = '',
  defaultPhone = '',
}: {
  unitSlug: string
  cart: string
  time: string
  labels: ConfirmLabels
  defaultName?: string
  defaultPhone?: string
}) {
  const [state, action] = useActionState<BookState, FormData>(bookAction, {
    error: null,
  })

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="unit" value={unitSlug} />
      <input type="hidden" name="cart" value={cart} />
      <input type="hidden" name="time" value={time} />

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      <Field label={labels.name} htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          defaultValue={defaultName}
        />
      </Field>

      {/*
        O TELEMÓVEL DEIXA DE SER OBRIGATÓRIO.

        Nem toda a gente quer dar o número para marcar um brushing, e a
        casa prefere a marcação sem número à marcação que não se fez.

        Mas o campo não fica só com um «(opcional)» ao lado: por baixo
        vai a frase que diz o que se perde — é por ali que a casa
        confirma e avisa se houver imprevisto. Quem escolher não deixar
        o número escolhe com a conta feita, que é diferente de escolher
        por distracção.
      */}
      <Field
        label={`${labels.phone} (${labels.optional})`}
        htmlFor="phone"
        hint={labels.phoneHint}
      >
        <PhoneInput id="phone" name="phone" defaultValue={defaultPhone} />
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-[var(--warn)]">
          {labels.phoneWarning}
        </p>
      </Field>

      <Field label={labels.note} htmlFor="note" hint={labels.optional}>
        <Textarea
          id="note"
          name="note"
          rows={3}
          placeholder={labels.notePlaceholder}
        />
      </Field>

      <Submit label={labels.submit} />
    </form>
  )
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {label}
    </Button>
  )
}
