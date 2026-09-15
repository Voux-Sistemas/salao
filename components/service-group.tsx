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
 * um único serviço. Passou a ser um cartão claro com o nome e a seta.
 *
 * E AGORA COM A FOTOGRAFIA DA FAMÍLIA (mockup «Serviço · famílias com
 * fotografia»): o mesmo cabeçalho do `ServiceFamily` de /servicos — o
 * disco com a fotografia, o nome, a seta num círculo. O número de
 * serviços saiu, como saiu de todo o site. Quem vê a página dos serviços
 * e depois vem marcar reconhece as famílias pela imagem.
 *
 * Ao contrário do `ServiceFamily`, fecha também no monitor: a coluna da
 * visita fica ao lado, e sete categorias abertas de enfiada afastavam-na
 * do que se está a escolher.
 *
 * O que se esconde é só a vista. O HTML tem sempre a lista inteira, e
 * sem JavaScript nada se esconde — a regra do globals.css só morde
 * quando o html tem a classe .js.
 */
export function ServiceGroup({
  title,
  media,
  chosenLabel,
  defaultOpen = false,
  children,
}: {
  title: string
  /** O disco da família: a fotografia, ou a inicial quando não há. */
  media: ReactNode
  /** «1 escolhido», quando há; abre a categoria à chegada. */
  chosenLabel?: string | null
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()

  return (
    <section className="overflow-hidden rounded-[20px] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(34,29,23,0.03)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:gap-3.5 sm:px-4 sm:py-3"
      >
        <span className="relative size-11 shrink-0 overflow-hidden rounded-full shadow-[0_0_0_2px_var(--surface-raised),0_0_0_3px_rgba(198,169,107,0.55)] sm:size-12">
          {media}
        </span>
        <span className="display min-w-0 flex-1 truncate text-[1.125rem] leading-[1.2] text-[var(--ink)] sm:text-[1.25rem]">
          {title}
        </span>
        {chosenLabel ? (
          <span className="shrink-0 rounded-full bg-[rgba(198,169,107,0.16)] px-2 py-0.5 text-[0.6875rem] leading-[14px] font-semibold text-[var(--action-strong)]">
            {chosenLabel}
          </span>
        ) : null}
        <span
          aria-hidden
          className={clsx(
            'flex size-[30px] shrink-0 items-center justify-center rounded-full text-[var(--accent)]',
            open
              ? 'bg-[rgba(142,111,65,0.10)]'
              : 'shadow-[inset_0_0_0_1px_rgba(142,111,65,0.22)]',
          )}
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={clsx('transition-transform duration-200', open && 'rotate-180')}
          />
        </span>
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
