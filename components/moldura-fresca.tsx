'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * A MOLDURA TEM DE SABER QUE ELA ENTROU.
 *
 * A sessão da cliente nasce no fim do funil, ao marcar. Mas o cabeçalho
 * continuava a dizer «Entrar»: a moldura é partilhada entre o funil e
 * esta página, e a que o navegador tem guardada foi desenhada durante o
 * funil — quando ela ainda não era ninguém.
 *
 * ISTO JÁ ESTEVE DO OUTRO LADO, E FOI UM DESASTRE. Um
 * `revalidatePath('/', 'layout')` na acção de marcar deitava fora a
 * árvore inteira, incluindo a página `/confirmar` de onde ela vinha —
 * que se voltava a validar, não encontrava a hora livre (acabara de a
 * ocupar ela própria) e se atirava para os horários. O botão ficava
 * preso a rodar e a marcação parecia falhada, estando feita.
 *
 * Aqui não há nada disso. Esta página não valida hora nenhuma: é um
 * recibo do que já aconteceu. Pedir-lhe uma volta ao servidor traz a
 * moldura certa e não pode mandar ninguém para lado nenhum.
 *
 * UMA VEZ SÓ, e é o que o `feito` guarda: o `refresh` volta a montar a
 * árvore, e sem esta trava mandava-se outro, e outro.
 *
 * Não desenha nada. Se o JavaScript não correr, o pior que acontece é o
 * cabeçalho dizer «Entrar» a quem já está entrada — feio, e apenas isso:
 * a marcação está feita e as duas portas por baixo funcionam à mesma.
 */
export function MolduraFresca() {
  const router = useRouter()
  const feito = useRef(false)

  useEffect(() => {
    if (feito.current) return
    feito.current = true
    router.refresh()
  }, [router])

  return null
}
