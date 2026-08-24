'use client'

import { useRouter } from 'next/navigation'

/**
 * O TÍTULO DO DIA É O PRÓPRIO CALENDÁRIO.
 *
 * A agenda tinha uma linha inteira só para «saltar para uma data»: um
 * campo, um botão «Ir», um botão «Hoje». No telemóvel essa linha
 * custava um dedo de ecrã ao dia — e o dia é a única coisa que
 * interessa. Aqui o campo de data fica invisível POR CIMA do título:
 * tocar em «segunda, 24 de agosto» abre o calendário nativo do
 * telemóvel, que é melhor do que qualquer calendário que se desenhe.
 *
 * O campo é um `input type=date` deitado sobre o texto com opacidade
 * zero — sem JavaScript nenhum para o abrir, e é isso que o torna
 * fiável: o toque cai no próprio campo, e quem abre o calendário é o
 * navegador. O `key={day}` recomeça o campo a cada navegação, senão o
 * `defaultValue` ficava agarrado ao primeiro dia que se viu.
 *
 * `hrefTemplate` traz um `{d}` no lugar da data: quem sabe construir
 * os endereços da agenda é a página (o `?p=`, o `?v=`…), e este
 * componente não tem de saber nada disso.
 */
export function DayJump({
  day,
  hrefTemplate,
  className,
  children,
}: {
  /** O dia mostrado, em YYYY-MM-DD. */
  day: string
  /** O destino, com `{d}` no lugar da data. */
  hrefTemplate: string
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <span className={className ? `relative ${className}` : 'relative'}>
      {children}
      <input
        key={day}
        type="date"
        defaultValue={day}
        aria-label="Mudar o dia"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(event) => {
          const next = event.target.value
          if (!next) return
          // Quem montou o modelo pode tê-lo escrito à mão («{d}») ou
          // passado por um URLSearchParams, que codifica as chavetas.
          // Aceitam-se as duas formas para o componente não obrigar
          // ninguém a saber como o endereço foi feito.
          router.push(
            hrefTemplate.replace('{d}', next).replace('%7Bd%7D', next),
            { scroll: false },
          )
        }}
      />
    </span>
  )
}
