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
    if (!rolo) return

    const apontar = () => {
      /*
        NA LISTA NÃO SE CONTAM MINUTOS: PROCURA-SE O FIO DE «AGORA».

        A lista não tem escala nenhuma (um cartão de quinze minutos e um
        de duas horas medem quase o mesmo), por isso a conta de píxeis
        lá em baixo não se aplica. O que se faz é o mesmo em espírito:
        pôr a dobra do dia a um quarto da altura, com o que já passou
        por cima dela.

        A página desenha UMA vista de cada vez (`?v=`), por isso em
        princípio bastava perguntar se a grelha existe. O `offsetParent`
        fica na mesma: é o seguro contra qualquer grelha que um dia
        volte a estar no DOM mas escondida — em `display:none` ele é
        nulo, e é assim que se pergunta ao navegador o que está mesmo à
        vista, em vez de se confiar no que a página acha que desenhou.
      */
      const grelha = rolo.querySelector<HTMLElement>('.grelha-dia')
      if (!grelha || grelha.offsetParent === null) {
        const agora = rolo.querySelector<HTMLElement>('[data-agora]')
        if (agora) {
          // Mede-se pelo ecrã e soma-se o que já está rolado: `offsetTop`
          // conta a partir do primeiro antepassado posicionado, que aqui
          // não é a caixa que rola, e dava a conta trocada.
          const salto =
            agora.getBoundingClientRect().top -
            rolo.getBoundingClientRect().top +
            rolo.scrollTop
          rolo.scrollTop = Math.max(0, salto - rolo.clientHeight * 0.25)
        }
        return
      }

      // A escala é a que o CSS decidiu para este ecrã — pergunta-se-lhe,
      // em vez de a repetir aqui e ficar com duas versões da verdade.
      const escala = Number(
        getComputedStyle(grelha).getPropertyValue('--esc').trim() || 1,
      )

      // Um quarto da altura acima do alvo: sobra contexto do que passou,
      // e o que vem a seguir fica com os outros três quartos.
      const destino = (focusMin - fromMin) * escala - rolo.clientHeight * 0.25
      rolo.scrollTop = Math.max(0, destino)
    }

    apontar()

    /*
      E OUTRA VEZ QUANDO AS LETRAS CHEGAREM.

      A lista do telemóvel mede-se em píxeis, e os píxeis mudam: enquanto
      as fontes da casa não chegam, o navegador desenha com as letras de
      recurso, os cartões ficam com outra altura, e a conta feita agora
      aponta para o sítio errado — para o meio da manhã em vez do meio
      da tarde, que foi exactamente o que se viu no ecrã pequeno.
      Repete-se assim que as letras assentam. Na grelha a conta é de
      minutos vezes escala e não depende de nenhuma medição, por isso
      repetir ali não custa nada e não estraga nada.
    */
    let vivo = true
    document.fonts?.ready.then(() => {
      if (vivo) apontar()
    })
    return () => {
      vivo = false
    }
  }, [focusMin, fromMin, chave])

  return null
}
