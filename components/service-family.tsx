'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'

/**
 * UMA FAMÍLIA DE SERVIÇOS, NUM CARTÃO QUE FECHA AO TELEMÓVEL.
 *
 * Substitui o `CollapseGroup` da página /servicos: era uma linha com o
 * nome em ouro, um número e uma seta, e as sete linhas seguidas liam-se
 * como um índice. Agora cada família é um cartão claro de cantos
 * redondos, com a fotografia dela no disco — a mesma dos discos da capa.
 *
 * Ao telemóvel começa fechado e abre ao toque; acima dos 640px fica
 * sempre aberto, e o cabeçalho deixa de ser botão.
 *
 * O que se esconde é só a vista. O HTML tem sempre a lista inteira: é
 * isso que os motores de busca lêem e o Ctrl+F encontra. E sem
 * JavaScript nada se esconde — a regra `[data-menu-fechado]` do
 * globals.css só morde quando o html tem a classe .js.
 */
export function ServiceFamily({
  title,
  media,
  children,
}: {
  title: string
  /** O disco da família: a fotografia, ou a inicial quando não há. */
  media: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()

  // O CSS já abre tudo acima dos 640px. Isto serve para o aria-expanded
  // não mentir a quem usa leitor de ecrã num monitor.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 640px)')
    const sync = () => setOpen((was) => was || wide.matches)
    sync()
    wide.addEventListener('change', sync)
    return () => wide.removeEventListener('change', sync)
  }, [])

  return (
    <section className="mb-2 break-inside-avoid rounded-[20px] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:mb-4 sm:rounded-[24px]">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((was) => !was)}
          className="toque flex w-full items-center gap-3 px-3 py-2.5 text-left sm:pointer-events-none sm:gap-3.5 sm:px-[22px] sm:pt-4 sm:pb-1.5"
        >
          <span className="relative size-11 shrink-0 overflow-hidden rounded-full shadow-[0_0_0_2px_var(--surface-raised),0_0_0_3px_rgba(198,169,107,0.55)] sm:size-[52px]">
            {media}
          </span>
          <span className="display flex-1 text-[1.125rem] leading-tight text-[var(--ink)] sm:text-[1.375rem]">
            {title}
          </span>
          <span
            aria-hidden
            className={
              'grid size-[30px] shrink-0 place-items-center rounded-full text-[var(--accent)] sm:hidden ' +
              (open
                ? 'bg-[rgba(142,111,65,0.10)]'
                : 'shadow-[inset_0_0_0_1px_rgba(142,111,65,0.22)]')
            }
          >
            <Chevron open={open} />
          </span>
        </button>
      </h2>
      <ul
        id={id}
        {...(open ? {} : { 'data-menu-fechado': '' })}
        className="px-4 pb-2 sm:px-[22px] sm:pb-3"
      >
        {children}
      </ul>
    </section>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
