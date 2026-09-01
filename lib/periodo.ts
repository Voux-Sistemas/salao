import { addDays, daysBetween, isValidDay, type IsoDay } from '@/lib/time'

/**
 * O PERÍODO — E PORQUE PASSOU A HAVER UM.
 *
 * Cada conta do painel escolhia a sua janela: a ocupação via a semana
 * corrente, o mapa seis semanas, a faturação o mês, a produção da
 * equipa outras seis semanas. Nenhuma estava errada e nenhuma se podia
 * comparar com a outra — «a ocupação está a 32%» e «a equipa trouxe
 * 335 €» falavam de pedaços de tempo diferentes, na mesma página, sem
 * o dizerem.
 *
 * Agora a janela é UMA e escolhe-se em cima. Tudo o que está por baixo
 * obedece.
 *
 * TRÊS ESCOLHAS, E O MÊS ANDA PARA TRÁS.
 *
 * Houve aqui um «Personalizado» com um calendário para escolher um
 * intervalo à mão. Estava feito e funcionava, e saiu à mesma: era o
 * único dos quatro que obrigava a pensar antes de usar, e trazia um
 * quadro de trezentos píxeis para uma pergunta que uma dona de salão
 * faz uma vez por trimestre.
 *
 * O que ele resolvia de verdade era uma coisa só — «como foi agosto?».
 * Assim que setembro começa, agosto desaparecia do painel para sempre,
 * porque nenhuma das pastilhas fixas sabe falar de um mês fechado. Duas
 * setas ao lado do nome do mês respondem a isso com um toque, e a «como
 * foi agosto do ano passado» com treze. Perdeu-se «de 12 a 31» e «a
 * semana da Páscoa», que ninguém pediu.
 *
 * O PERÍODO ANTERIOR É O QUE DÁ SENTIDO AO NÚMERO. 50 € num mês não é
 * bom nem mau; 50 € contra 35 € é. A regra é sempre a mesma: começa no
 * sítio análogo — o primeiro do mês anterior, os sete dias antes destes
 * — e tem tantos dias como o corrente, para que um mês a meio se compare
 * com meio mês e não com um inteiro.
 *
 * E NUNCA SE SOBREPÕE AO CORRENTE. É a única correcção que o cálculo
 * leva, e cobre um caso real: março tem 31 dias e fevereiro 28. Sem
 * ela, o período de comparação de março ia buscar três dias ao próprio
 * março.
 *
 * Isto é aritmética de calendário — não sabe de fusos nem da base de
 * dados. Quem precisa de instantes converte-os na borda, como sempre.
 */

export type Periodo = 'hoje' | '7d' | 'mes'

export type Janela = {
  periodo: Periodo
  /** Primeiro dia, inclusive. */
  de: IsoDay
  /** Último dia, INCLUSIVE. Nunca depois de hoje. */
  ate: IsoDay
  /** Quantos dias tem. */
  dias: number
  deAnterior: IsoDay
  /** Também inclusive. */
  ateAnterior: IsoDay
  /** Como se chama à janela numa legenda: «hoje», «setembro». */
  rotulo: string
  /** Contra o que se compara: «ontem», «agosto, até ao dia 12». */
  rotuloAnterior: string
  /**
   * O DIA 1 DO MÊS QUE ESTÁ A SER VISTO — só quando o período é o mês.
   *
   * É daqui que as setas sabem para onde apontar. Não se deduz do `de`
   * porque nos outros períodos o `de` não é o princípio de mês nenhum,
   * e uma seta a partir de «os últimos 7 dias» não quer dizer nada.
   */
  mes: IsoDay | null
}

/** As três escolhas, pela ordem em que aparecem no selector. */
export const PERIODOS: readonly { valor: Periodo; nome: string }[] = [
  { valor: 'hoje', nome: 'Hoje' },
  { valor: '7d', nome: '7 dias' },
  { valor: 'mes', nome: 'Este mês' },
] as const

/**
 * DOIS ANOS PARA TRÁS É O TECTO, e não é teimosia.
 *
 * O mapa das horas parte cada turno hora a hora antes de medir o que
 * lá está marcado. Recuar sem fim era deixá-la chegar a meses onde ele
 * deixa de responder — e a meses onde a casa nem existia. A seta pára
 * onde o painel ainda tem alguma coisa para dizer.
 */
const MESES_ATRAS = 24

/**
 * O QUE VEM NO ENDEREÇO, TRANSFORMADO NUMA JANELA — E NUNCA UM ERRO.
 *
 * Isto lê texto de fora: um atalho guardado, um endereço escrito à mão.
 * Tudo o que não fizer sentido cai no mês corrente, em silêncio. A
 * alternativa era um ecrã rebentado à frente da cliente por causa de
 * uma letra a mais no endereço.
 */
export function lerJanela(
  params: { p?: string; m?: string },
  hoje: IsoDay,
): Janela {
  const p = PERIODOS.find((x) => x.valor === params.p)?.valor ?? 'mes'
  if (p !== 'mes') return janelaDe(p, hoje)

  const pedido = params.m && isValidDay(params.m) ? primeiroDoMes(params.m) : null
  return janelaDe('mes', hoje, pedido ?? primeiroDoMes(hoje))
}

export function janelaDe(
  periodo: Periodo,
  hoje: IsoDay,
  mesPedido?: IsoDay,
): Janela {
  if (periodo === 'hoje') {
    return montar(periodo, hoje, hoje, addDays(hoje, -1), null)
  }
  if (periodo === '7d') {
    const de = addDays(hoje, -6)
    return montar(periodo, de, hoje, addDays(de, -7), null)
  }

  const mes = limitarMes(mesPedido ?? primeiroDoMes(hoje), hoje)
  /*
    UM MÊS FECHADO VAI ATÉ AO FIM; O CORRENTE VAI ATÉ HOJE. É a mesma
    regra dita uma vez: o último dia é o que vier primeiro. Sem ela,
    setembro em dia 15 contava trinta dias e a ocupação aparecia a
    metade do que é.
  */
  const ultimo = ultimoDoMes(mes)
  const ate = ultimo < hoje ? ultimo : hoje
  return montar('mes', mes, ate, primeiroDoMes(addDays(mes, -1)), mes)
}

function montar(
  periodo: Periodo,
  de: IsoDay,
  ate: IsoDay,
  deAnterior: IsoDay,
  mes: IsoDay | null,
): Janela {
  const dias = daysBetween(de, ate) + 1

  const fimNatural = addDays(deAnterior, dias - 1)
  const vespera = addDays(de, -1)
  // Nunca invade o período corrente — ver o cabeçalho.
  const ateAnterior = fimNatural < vespera ? fimNatural : vespera

  return {
    periodo,
    de,
    ate,
    dias,
    deAnterior,
    ateAnterior,
    rotulo: rotuloDe(periodo, de),
    rotuloAnterior: rotuloAnteriorDe(periodo, deAnterior, ateAnterior),
    mes,
  }
}

// ---------------------------------------------------------------------
// As setas do mês
// ---------------------------------------------------------------------

/**
 * Para onde as setas levam — nulo quando não há para onde ir.
 *
 * Recebe o mês VISTO e não a janela: as setas continuam a andar quando
 * ela está no «Hoje» ou nos «7 dias», e um toque numa delas troca as duas
 * coisas de uma vez — o período passa a ser o mês, e o mês é o do lado.
 *
 * A da frente pára no mês de hoje: adiante não há nada para somar. A de
 * trás pára nos dois anos, pela razão que está no `MESES_ATRAS`. Uma
 * seta que não leva a lado nenhum não é uma ligação, e desenha-se
 * apagada.
 */
export function mesesAoLado(
  mes: IsoDay,
  hoje: IsoDay,
): { atras: IsoDay | null; frente: IsoDay | null } {
  const atras = primeiroDoMes(addDays(mes, -1))
  const frente = primeiroDoMes(addDays(ultimoDoMes(mes), 1))
  const limite = recuarMeses(primeiroDoMes(hoje), MESES_ATRAS)

  return {
    atras: atras >= limite ? atras : null,
    frente: frente <= hoje ? frente : null,
  }
}

/**
 * QUE MÊS AS SETAS VÊEM, a partir do que vier no endereço.
 *
 * É uma pergunta à parte do período: ela pode estar nos «7 dias» com
 * agosto ainda debaixo do dedo, e as setas têm de continuar a apontar
 * para julho e setembro. Passa pelos mesmos cortes que a janela — dois
 * anos para trás, o mês de hoje para a frente — porque duas leituras do
 * mesmo parâmetro com regras diferentes acabam sempre a discordar.
 */
export function mesVistoDe(m: string | undefined, hoje: IsoDay): IsoDay {
  const pedido = m && isValidDay(m) ? primeiroDoMes(m) : primeiroDoMes(hoje)
  return limitarMes(pedido, hoje)
}

/** O dia 1 do mês de um dia qualquer. */
export function primeiroDoMes(day: IsoDay): IsoDay {
  return `${day.slice(0, 7)}-01`
}

/** O último dia do mês — a véspera do dia 1 do mês seguinte. */
function ultimoDoMes(day: IsoDay): IsoDay {
  const [ano, mes] = day.split('-').map(Number) as [number, number]
  const quantos = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return `${day.slice(0, 8)}${String(quantos).padStart(2, '0')}`
}

function recuarMeses(primeiro: IsoDay, meses: number): IsoDay {
  const [ano, mes] = primeiro.split('-').map(Number) as [number, number]
  const total = ano * 12 + (mes - 1) - meses
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

/** Nem à frente de hoje, nem para além do tecto. */
function limitarMes(mes: IsoDay, hoje: IsoDay): IsoDay {
  const tecto = primeiroDoMes(hoje)
  const chao = recuarMeses(tecto, MESES_ATRAS)
  if (mes > tecto) return tecto
  if (mes < chao) return chao
  return mes
}

// ---------------------------------------------------------------------
// Como se chamam
// ---------------------------------------------------------------------

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

/** «setembro» — o mês de um dia de calendário, por extenso. */
export function mesDe(day: IsoDay): string {
  return MESES[Number(day.slice(5, 7)) - 1] ?? ''
}

/**
 * «setembro», ou «dezembro de 2025» quando não é deste ano.
 *
 * O ano só aparece quando faz falta. Andando para trás mês a mês
 * chega-se a dezembro duas vezes, e sem o ano as duas pastilhas
 * dizem o mesmo e mostram coisas diferentes.
 */
export function mesPorExtenso(day: IsoDay, hoje: IsoDay): string {
  const nome = mesDe(day)
  return day.slice(0, 4) === hoje.slice(0, 4)
    ? nome
    : `${nome} de ${day.slice(0, 4)}`
}

function rotuloDe(periodo: Periodo, de: IsoDay): string {
  switch (periodo) {
    case 'hoje':
      return 'hoje'
    case '7d':
      return 'últimos 7 dias'
    case 'mes':
      return mesDe(de)
  }
}

/**
 * Contra o que se compara, dito de maneira a que ninguém se engane.
 *
 * NUM MÊS A MEIO A COMPARAÇÃO É CORTADA — a 15 de setembro compara-se
 * com agosto até ao dia 15, não com agosto inteiro — e é isso que a
 * legenda tem de dizer. Calada, o painel parecia estar a comparar com
 * um mês cheio e todo o princípio de mês parecia uma derrota.
 *
 * Num mês já fechado não há corte nenhum, e a legenda encurta: julho
 * inteiro contra agosto inteiro diz-se «julho» e mais nada.
 */
function rotuloAnteriorDe(
  periodo: Periodo,
  deAnterior: IsoDay,
  ateAnterior: IsoDay,
): string {
  switch (periodo) {
    case 'hoje':
      return 'ontem'
    case '7d':
      return 'os 7 dias antes'
    case 'mes':
      return ateAnterior === ultimoDoMes(deAnterior)
        ? mesDe(deAnterior)
        : `${mesDe(deAnterior)}, até ao dia ${Number(ateAnterior.slice(8, 10))}`
  }
}
