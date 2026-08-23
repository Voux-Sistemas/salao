'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { Reveal } from '@/components/reveal'

/**
 * UMA CATEGORIA QUE FECHA AO TELEMÓVEL.
 *
 * O catálogo tem 67 serviços em sete categorias. De enfiada, num ecrã
 * de bolso, são milhares de pixéis de scroll e ninguém chega ao fim —
 * por isso as categorias começam fechadas e abrem ao toque. Ao
 * computador cabem lado a lado e ficam sempre abertas: o cabeçalho
 * volta a ser um cabeçalho e o botão deixa de responder.
 *
 * O que se esconde é só a vista. O HTML tem sempre a lista inteira: é
 * isso que os motores de busca lêem e o Ctrl+F encontra. E sem
 * JavaScript nada se esconde — a regra em globals.css só morde quando
 * o html tem a classe .js.
 */
export function CollapseGroup({
  title,
  count,
  ordinal,
  defaultOpen = false,
  delay = 0,
  children,
}: {
  title: string
  /** Quantos itens, para se saber o que há lá dentro sem abrir. */
  count: number
  /** Numeração decorativa do funil ("01"). Só aparece no monitor. */
  ordinal?: string
  /** Já com alguma coisa escolhida lá dentro: abre à chegada. */
  defaultOpen?: boolean
  delay?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()

  // O CSS já abre tudo acima dos 640px. Isto serve para o aria-expanded
  // não mentir a quem usa leitor de ecrã num monitor: lá a lista está
  // aberta, e o botão tem de o dizer.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 640px)')
    const sync = () => setOpen((was) => was || wide.matches)
    sync()
    wide.addEventListener('change', sync)
    return () => wide.removeEventListener('change', sync)
  }, [])

  return (
    <Reveal delay={delay}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="flex min-h-[3rem] w-full items-center justify-between gap-4 border-b border-[var(--line-soft)] pb-3 text-left sm:pointer-events-none sm:items-baseline sm:border-0 sm:pb-0"
      >
        <span className="display text-[1.375rem] text-[var(--accent)] sm:text-xl">
          {title}
        </span>
        {ordinal ? (
          <span className="hidden h-px flex-1 bg-[var(--line-soft)] sm:block" />
        ) : null}
        <span className="flex shrink-0 items-center gap-2 text-[0.75rem] text-[var(--ink-faint)] sm:hidden">
          <span className="tabular">{count}</span>
          <Chevron open={open} />
        </span>
        {ordinal ? (
          <span className="tabular hidden text-[0.6875rem] text-[var(--ink-faint)] sm:block">
            {ordinal}
          </span>
        ) : null}
      </button>
      <ul id={id} {...(open ? {} : { 'data-menu-fechado': '' })} className="mt-4 sm:mt-6">
        {children}
      </ul>
    </Reveal>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
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
