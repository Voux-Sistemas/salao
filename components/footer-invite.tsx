'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * O CONVITE NÃO SE FAZ A QUEM JÁ ESTÁ A ENTRAR.
 *
 * O rodapé é a moldura e desce a todas as páginas públicas — o que é
 * bom em todas menos uma: dentro do funil de marcação. Quem está a
 * escolher a hora não precisa de ser convidado a marcar, e na página
 * de «pronto» seria pior do que redundante: seria estranho.
 *
 * Nem na página de uma loja: essa já fecha com o seu próprio convite,
 * «Marcar nesta casa», que leva direto à loja. O do rodapé, logo por
 * baixo, repetia a mesma frase com um botão que levava à escolha da
 * loja outra vez. A lista das lojas (/loja) continua a tê-lo.
 *
 * Isto é a única peça de cliente do rodapé, e só serve para saber onde
 * está. Não busca nada nem guarda nada — o conteúdo vem do servidor já
 * escrito, e aqui só se decide se aparece.
 */
export function FooterInvite({ children }: { children: ReactNode }) {
  const path = usePathname()
  if (path?.startsWith('/agendar') || path?.startsWith('/loja/')) return null
  return <>{children}</>
}
