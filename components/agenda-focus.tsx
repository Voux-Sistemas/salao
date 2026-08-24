'use client'

import { useEffect } from 'react'

/**
 * ABRIR A AGENDA ONDE O DIA ESTÁ, E NÃO ONDE ELE COMEÇA.
 *
 * A grelha desenha o dia inteiro — abertura, folga antes, folga depois.
 * Deixada por sua conta, abre no topo: às três da tarde, o que se vê é
 * a hora de destrancar a porta. Quem chega à agenda a meio do dia quer
 * a linha de «agora» à vista, e quem abre um dia futuro quer a primeira
 * marcação dele.
 *
 * Rola-se A CAIXA da grelha, não a página. É por isso que não se usa um
 * `scrollIntoView`: esse arrastava a moldura do balcão junto e escondia
 * a fita dos dias, que é precisamente o que se acabou de pôr lá.
 *
 * Corre à chegada e sempre que o dia muda. Não é uma âncora presa —
 * assim que a dona rolar para outro lado, fica onde ela a deixou.
 */
export function AgendaFocus({
  /** Minuto do dia que se quer ver — o mesmo eixo em que a grelha desenha. */
  focusMin,
  /** Minuto em que a grelha começa. */
  fromMin,
  /** Muda quando muda o dia ou a pessoa: é o sinal para voltar a apontar. */
  chave,
}: {
  focusMin: number
  fromMin: number
  chave: string
}) {
  useEffect(() => {
    const rolo = document.querySelector<HTMLElement>('[data-rolo-agenda]')
    const grelha = rolo?.querySelector<HTMLElement>('.grelha-dia')
    if (!rolo || !grelha) return

    // A escala é a que o CSS decidiu para este ecrã — pergunta-se-lhe,
    // em vez de a repetir aqui e ficar com duas versões da verdade.
    const escala = Number(
      getComputedStyle(grelha).getPropertyValue('--esc').trim() || 1,
    )

    // Um quarto da altura acima do alvo: sobra contexto do que passou, e
    // o que vem a seguir fica com os outros três quartos.
    const destino = (focusMin - fromMin) * escala - rolo.clientHeight * 0.25
    rolo.scrollTop = Math.max(0, destino)
  }, [focusMin, fromMin, chave])

  return null
}
