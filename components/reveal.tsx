'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * REVELAR AO ROLAR.
 *
 * O CSS (globals.css) esconde tudo o que tenha [data-reveal] — mas só
 * quando o html tem a classe .js. Aqui, um IntersectionObserver troca o
 * atributo para "visible" quando o elemento entra no viewport, e a
 * transição faz o resto. Cada elemento revela uma vez e fica.
 *
 *   <Reveal>bloco</Reveal>
 *   <Reveal delay={120}>com atraso</Reveal>
 *   <Reveal group className="grid ...">filhos escalonados</Reveal>
 */
export function Reveal({
  children,
  delay = 0,
  group = false,
  className,
}: {
  children: ReactNode
  /** Atraso extra em milissegundos (além do escalonamento do grupo). */
  delay?: number
  /** Escalona os filhos directos em vez do bloco inteiro. */
  group?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const attribute = group ? 'data-reveal-group' : 'data-reveal'

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Já dentro do viewport ao montar (topo da página): revela já.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.setAttribute(attribute, 'visible')
            observer.disconnect()
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -36px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [attribute])

  return (
    <div
      ref={ref}
      {...{ [attribute]: '' }}
      className={className}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}
