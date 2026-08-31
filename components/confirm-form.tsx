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
        NA MONTRA O TELEMÓVEL VOLTA A SER OBRIGATÓRIO.

        Foi opcional dos dois lados durante uns dias, e a dona da casa
        veio dizer onde é que os dois lados diferem: ao BALCÃO
        está lá alguém — a colaboradora vê a cliente, sabe o nome dela,
        e se for preciso grita-lhe pela porta. Aqui não está ninguém.
        Uma marcação feita às onze da noite por um nome sem número é uma
        cadeira reservada a quem a casa não consegue chamar: não se
        confirma, não se avisa de um atraso, e se a profissional
        adoecer a cliente vem à rua para nada.

        Por isso o campo pede o número, e o balcão continua a poder
        marcar sem ele — ver o comentário do encaixe-form.tsx.

        Porque é que se pede, está dito no subtítulo da página: para a
        identificar e para lhe falar pelo WhatsApp. Não se repete aqui.
      */}
      <Field label={labels.phone} htmlFor="phone" hint={labels.phoneHint}>
        <PhoneInput
          id="phone"
          name="phone"
          required
          defaultValue={defaultPhone}
        />
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
