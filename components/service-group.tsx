'use client'

import { useId, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

/**
 * UMA CATEGORIA DO PASSO DOS SERVIÇOS, NUM CARTÃO QUE ABRE E FECHA.
 *
 * É a peça do mockup «Serviço · delicado». Antes cada categoria era um
 * título dourado de vinte e dois píxeis com meio ecrã de ar à volta, e
 * no telemóvel quatro categorias fechadas enchiam a página sem mostrar
 * um único serviço. Agora é um cartão claro: o nome, quantos escolhidos,
 * quantos há, e a seta.
 *
 * Ao contrário do `ServiceFamily` de /servicos, fecha também no monitor:
 * a coluna da visita fica ao lado, e sete categorias abertas de enfiada
 * afastavam-na do que se está a escolher.
 *
 * O que se esconde é só a vista. O HTML tem sempre a lista inteira, e
 * sem JavaScript nada se esconde — a regra do globals.css só morde
 * quando o html tem a classe .js.
 */
export function ServiceGroup({
  title,
  count,
  chosenLabel,
  defaultOpen = false,
  children,
}: {
  title: string
  /** Quantos serviços há lá dentro, para se saber sem abrir. */
  count: number
  /** «1 escolhido», quando há; abre a categoria à chegada. */
  chosenLabel?: string | null
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()

  return (
    <section className="overflow-hidden rounded-[18px] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:rounded-[20px]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="flex h-[50px] w-full items-center gap-2.5 px-3.5 text-left outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:h-14 sm:px-5"
      >
        <span className="display min-w-0 flex-1 truncate text-[1.0625rem] leading-[1.2] text-[var(--ink)] sm:text-[1.1875rem]">
          {title}
        </span>
        {chosenLabel ? (
          <span className="shrink-0 rounded-full bg-[rgba(198,169,107,0.16)] px-2 py-0.5 text-[0.6875rem] leading-[14px] font-semibold text-[var(--action-strong)]">
            {chosenLabel}
          </span>
        ) : null}
        <span className="tabular shrink-0 text-[0.71875rem] text-[#8A7F6E]">{count}</span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          aria-hidden
          className={clsx(
            'shrink-0 text-[#8A7F6E] transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <ul
        id={id}
        {...(open ? {} : { 'data-grupo-fechado': '' })}
        className="border-t border-[rgba(34,29,23,0.06)]"
      >
        {children}
      </ul>
    </section>
  )
}
