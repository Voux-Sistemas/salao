'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import clsx from 'clsx'
import { Input } from '@/components/ui'
import { caretAfter, maskPhone, nationalDigitsBefore } from '@/lib/phone'

/**
 * O CAMPO DO TELEFONE.
 *
 * Um número escrito à mão chega de todas as maneiras: com espaços, com
 * traços, com o «00» à frente, com o indicativo e sem ele. O servidor
 * limpa tudo à chegada, por isso nada disto partia o sistema — mas
 * partia a leitura. Ao balcão o telefone repete-se em voz alta para a
 * cliente confirmar, e catorze dígitos seguidos não se leem em voz alta.
 *
 * Então escreve-se à medida que se escreve: «912345678» aparece como
 * «+351 912 345 678», que é como o número se diz cá. O indicativo entra
 * sozinho porque a casa é em Portugal, e sai da frente mal alguém
 * escreva «+» — as clientes estrangeiras são metade da agenda.
 *
 * O cursor é a parte difícil. Reescrever o campo a cada tecla manda o
 * cursor para o fim, e quem estiver a corrigir um dígito a meio escreve
 * o resto ao contrário. Por isso guarda-se a posição em dígitos do
 * número (não em letras da máscara) e repõe-se depois de o React
 * desenhar — antes da pintura, para não haver salto visível.
 */
export function PhoneInput({
  defaultValue,
  value,
  onChange,
  className,
  ...props
}: ComponentProps<'input'>) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const [texto, setTexto] = useState(() => maskPhone(String(defaultValue ?? value ?? '')))

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current === null) return
    el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [texto])

  return (
    <Input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+351 912 345 678"
      // O número lê-se em coluna com outros números — na ficha, na
      // lista, no cartão da marcação. Tabular para que os dígitos
      // fiquem todos com a mesma largura e as colunas não dancem.
      className={clsx('tabular', className)}
      {...props}
      value={texto}
      onChange={(event) => {
        const el = event.currentTarget
        const antes = nationalDigitsBefore(el.value, el.selectionStart ?? el.value.length)
        const proximo = maskPhone(el.value)
        caret.current = caretAfter(proximo, antes)
        setTexto(proximo)
        onChange?.(event)
      }}
    />
  )
}
