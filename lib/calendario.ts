import { addDays, formatWeekdayShort, type IsoDay } from '@/lib/time'

/**
 * A GRELHA DE UM MÊS — a aritmética que os dois calendários partilham.
 *
 * A casa tem dois: o da montra, grande e sem caixa, onde a cliente
 * escolhe o dia da marcação; e o do balcão, compacto e emoldurado, onde
 * a dona escolhe o período dos números. São peças diferentes de
 * propósito — falam com pessoas diferentes, em páginas com peles
 * diferentes — mas a conta de onde começa a primeira semana e quantos
 * dias tem o mês é a mesma, e uma conta destas escrita duas vezes acaba
 * sempre por divergir numa delas.
 *
 * Vive aqui e não em `lib/time` porque só serve para desenhar
 * calendários: é forma, não é tempo.
 */

export type GrelhaDoMes = {
  /** O dia 1 do mês. */
  primeiro: IsoDay
  /** Os dias todos do mês, por ordem. */
  dias: IsoDay[]
  /** Quantas células vazias antes do dia 1, para ele cair na coluna certa. */
  recuo: number
  /** «Seg», «Ter»… na língua de quem está a ver. */
  cabecalhos: string[]
  /** O dia 1 do mês anterior e do seguinte, para as setas. */
  anterior: IsoDay
  seguinte: IsoDay
}

export function grelhaDoMes(
  mes: IsoDay,
  timezone: string,
  language: string,
): GrelhaDoMes {
  const primeiro = `${mes.slice(0, 8)}01` as IsoDay
  const [ano, m] = primeiro.split('-').map(Number) as [number, number]

  /*
    Ao meio-dia UTC de propósito: um «YYYY-MM-DD» lido à meia-noite cai
    do lado errado do dia em metade dos fusos, e um calendário que começa
    na coluna errada é pior do que não haver calendário.
  */
  const diaDaSemana = new Date(`${primeiro}T12:00:00Z`).getUTCDay()
  // A semana da casa começa à segunda: domingo (0) vai para o fim.
  const recuo = (diaDaSemana + 6) % 7
  const quantos = new Date(Date.UTC(ano, m, 0)).getUTCDate()

  /*
    TRÊS LETRAS, E NEM MAIS UMA.

    Os cabeçalhos saem de uma semana real — 2024-01-01 foi segunda — para
    virem na língua de quem está a ver. Mas o que o sistema chama de
    «curto» varia com a língua e com o motor: em português vinham nomes
    inteiros, e «SEGUNDA TERÇA QUARTA» em colunas estreitas vem tudo
    colado. Cortadas às três, «Seg» e «Sáb» leem-se em qualquer caso.
  */
  const cabecalhos = Array.from({ length: 7 }, (_, i) =>
    formatWeekdayShort(addDays('2024-01-01' as IsoDay, i), timezone, language)
      .replace(/\.$/, '')
      .slice(0, 3),
  )

  return {
    primeiro,
    dias: Array.from({ length: quantos }, (_, i) => addDays(primeiro, i)),
    recuo,
    cabecalhos,
    anterior: `${addDays(primeiro, -1).slice(0, 8)}01`,
    seguinte: addDays(primeiro, quantos),
  }
}
