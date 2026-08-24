'use client'

import { useEffect, useRef } from 'react'

/**
 * TRAZER-SE À VISTA QUANDO NASCE.
 *
 * No encaixe, escolher a hora faz aparecer o passo de confirmar — mas
 * ele nasce mais abaixo, fora do ecrã do telemóvel, e ninguém dá por
 * ele. Isto rola até lá uma vez, quando a `chave` muda; `nearest` faz
 * com que não se mexa nada se o passo já estiver à vista.
 *
 * UMA VEZ É MESMO UMA VEZ. Cada passo do encaixe é uma navegação — a
 * página nasce de novo, e este efeito nasceria com ela. Sem memória,
 * juntar um serviço ao carrinho com a hora já escolhida voltava a
 * puxar o ecrã para o fim, tirando da vista a lista onde a pessoa
 * estava a mexer. A `sessionStorage` lembra-se de que ESTA chave nesta
 * página já puxou; a chave nova (outra hora, outra visita) puxa outra
 * vez, que é o que se quer.
 */
export function ScrollHere({ chave }: { chave: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Em navegação privada há navegadores em que tocar na
    // `sessionStorage` atira um erro — aí perde-se a memória e volta a
    // puxar-se a cada chave, que é o comportamento antigo, não um erro.
    const memoria = `scroll-here:${window.location.pathname}:${chave}`
    try {
      if (window.sessionStorage.getItem(memoria)) return
      window.sessionStorage.setItem(memoria, '1')
    } catch {
      /* sem memória, rola-se na mesma */
    }

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
