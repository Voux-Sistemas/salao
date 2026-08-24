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
  aceitaTexto,
  ...props
}: ComponentProps<'input'> & { aceitaTexto?: boolean }) {
  /*
   * Num campo de entrada o que se escreve nem sempre e um numero — pode
   * ser um nome de utilizador. A mascara so limpa digitos, por isso
   * comia essas letras e deixava o campo vazio. Com `aceitaTexto`, o que
   * tiver letras passa tal e qual e e o servidor que decide; o que for
   * so digitos continua a ganhar a mascara como em todo o lado.
   */
  const eTexto = (bruto: string) => Boolean(aceitaTexto) && /[a-z]/i.test(bruto)
  const passa = (bruto: string) => (eTexto(bruto) ? bruto : maskPhone(bruto))
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const [texto, setTexto] = useState(() => passa(String(defaultValue ?? value ?? '')))

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current === null) return
    el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [texto])

  return (
    <Input
      ref={ref}
      // Um campo que pode receber letras nao pode pedir o teclado
      // numerico: no telemovel nao havia como escrever o nome.
      type={aceitaTexto ? 'text' : 'tel'}
      inputMode={aceitaTexto ? 'text' : 'tel'}
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
        const proximo = passa(el.value)
        // Texto que passa tal e qual nao mexe no cursor — o navegador ja
        // o deixou onde devia, e repo-lo por digitos punha-o no fim.
        caret.current = eTexto(el.value) ? null : caretAfter(proximo, antes)
        setTexto(proximo)
        onChange?.(event)
      }}
    />
  )
}
