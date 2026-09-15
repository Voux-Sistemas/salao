'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

/**
 * OS PONTINHOS POR BAIXO DE UMA FILA QUE SE ARRASTA.
 *
 * No telemóvel as famílias de serviços arrastam-se para o lado, e sem
 * nada a dizê-lo muita gente não sabe que há mais. Três pontos por
 * baixo — o de agora mais comprido — dizem que a fila continua, e
 * acompanham o dedo: início, meio, fim.
 *
 * Seguem a fila que vem IMEDIATAMENTE ANTES deles no HTML, para não ser
 * preciso passar referências entre um componente do servidor e este.
 * Quando a fila cabe inteira (no monitor), não há nada a dizer e os
 * pontos escondem-se.
 */
export function ScrollDots({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [scrolls, setScrolls] = useState(true)

  useEffect(() => {
    const row = ref.current?.previousElementSibling as HTMLElement | null
    if (!row) return

    const update = () => {
      const room = row.scrollWidth - row.clientWidth
      setScrolls(room > 4)
      if (room <= 4) return
      const ratio = row.scrollLeft / room
      setPage(ratio < 0.34 ? 0 : ratio < 0.67 ? 1 : 2)
    }

    update()
    row.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      row.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className={clsx('flex justify-center gap-[5px]', !scrolls && 'invisible', className)}
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className={clsx(
            'h-1 rounded-full transition-all duration-300',
            dot === page ? 'w-4 bg-[var(--accent)]' : 'w-1 bg-[rgba(34,29,23,0.15)]',
          )}
        />
      ))}
    </div>
  )
}
