'use client'

import { useEffect, useRef } from 'react'

/**
 * TRAZER-SE À VISTA QUANDO NASCE.
 *
 * No encaixe, escolher a hora faz aparecer o passo de confirmar — mas
 * ele nasce mais abaixo, fora do ecrã do telemóvel, e ninguém dá por
 * ele. Isto rola até lá uma vez, quando a `chave` muda; `nearest` faz
 * com que não se mexa nada se o passo já estiver à vista.
 */
export function ScrollHere({ chave }: { chave: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    // É o cartão inteiro que se quer ver, não este marcador vazio.
    const alvo = node.parentElement ?? node
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame = requestAnimationFrame(() => {
      alvo.scrollIntoView({
        behavior: calm ? 'auto' : 'smooth',
        block: 'nearest',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [chave])

  return <div ref={ref} aria-hidden className="h-0" />
}
