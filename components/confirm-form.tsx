'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { bookAction, type BookState } from '@/app/(public)/agendar/[loja]/confirmar/actions'
import { PhoneInput } from '@/components/phone-input'
import { Button, Field, Input, Notice, Textarea, buttonClass } from '@/components/ui'

export type ConfirmLabels = {
  name: string
  phone: string
  phoneHint: string
  note: string
  notePlaceholder: string
  optional: string
  submit: string
  /* Só se lê sem JavaScript, e mesmo assim tem de estar traduzido. */
  done: string
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

  /*
    QUEM NAVEGA É O NAVEGADOR, E NÃO A ACÇÃO.

    A acção devolve o endereço do recibo em vez de lá ir por dentro. Um
    `redirect` dentro dela fazia o Next desenhar a página de destino
    DENTRO da resposta da acção — e era esse cano que rebentava, com a
    marcação já feita e a cliente a ver «alguma coisa correu mal».

    Isto é exactamente o que o botão «Tentar outra vez» fazia, e esse
    nunca falhou: um pedido limpo, como quem carrega num link.

    O `replace` e não o `push`: quem voltar atrás no recibo não deve
    cair outra vez no formulário de confirmar, com a marcação já feita.

    A trava do `ref` é porque um `useEffect` pode correr duas vezes, e
    duas navegações seguidas para o mesmo sítio piscam o ecrã.
  */
  const router = useRouter()
  const jaFoi = useRef(false)
  useEffect(() => {
    if (!state.pronto || jaFoi.current) return
    jaFoi.current = true
    router.replace(state.pronto)
  }, [state.pronto, router])

  /*
    E SEM JAVASCRIPT, A PORTA FICA À VISTA.

    O formulário funciona sem ele — o Next trata disso — mas a navegação
    de cima não. Sem esta saída, uma cliente com o JavaScript desligado
    marcava, ficava no mesmo ecrã, e não tinha maneira de saber que
    tinha corrido bem. É raro, e é barato de cobrir.
  */
  if (state.pronto) {
    return (
      <Link
        href={state.pronto}
        className={buttonClass('primary', 'lg', 'w-full')}
      >
        {labels.done}
      </Link>
    )
  }

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
