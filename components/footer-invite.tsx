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
 * Isto é a única peça de cliente do rodapé, e só serve para saber onde
 * está. Não busca nada nem guarda nada — o conteúdo vem do servidor já
 * escrito, e aqui só se decide se aparece.
 */
export function FooterInvite({ children }: { children: ReactNode }) {
  const path = usePathname()
  if (path?.startsWith('/agendar')) return null
  return <>{children}</>
}
