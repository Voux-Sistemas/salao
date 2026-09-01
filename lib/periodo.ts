import { addDays, daysBetween, type IsoDay } from '@/lib/time'

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
 * O PERÍODO ANTERIOR É O QUE DÁ SENTIDO AO NÚMERO. 50 € num mês não é
 * bom nem mau; 50 € contra 35 € é. A regra é sempre a mesma: começa no
 * sítio análogo — o primeiro do mês anterior, o primeiro de janeiro do
 * ano passado, os sete dias antes destes — e tem tantos dias como o
 * corrente, para que um mês a meio se compare com meio mês e não com
 * um inteiro.
 *
 * E NUNCA SE SOBREPÕE AO CORRENTE. É a única correcção que o cálculo
 * leva, e cobre dois casos reais: março tem 31 dias e fevereiro 28, e
 * um ano bissexto tem mais um do que o anterior. Sem ela, o período
 * de comparação de março ia buscar três dias ao próprio março.
 *
 * Isto é aritmética de calendário — não sabe de fusos nem da base de
 * dados. Quem precisa de instantes converte-os na borda, como sempre.
 */

export type Periodo = '7d' | 'mes' | '3m' | 'ano'

export type Janela = {
  periodo: Periodo
  /** Primeiro dia, inclusive. */
  de: IsoDay
  /** Último dia, INCLUSIVE — hoje, nas janelas todas. */
  ate: IsoDay
  /** Quantos dias tem. */
  dias: number
  deAnterior: IsoDay
  /** Também inclusive. */
  ateAnterior: IsoDay
  /** Como se chama à janela numa legenda: «setembro», «últimos 7 dias». */
  rotulo: string
  /** Contra o que se compara: «agosto, até ao dia 12». */
  rotuloAnterior: string
}

/** As quatro escolhas, pela ordem em que aparecem no selector. */
export const PERIODOS: readonly { valor: Periodo; nome: string }[] = [
  { valor: '7d', nome: '7 dias' },
  { valor: 'mes', nome: 'Este mês' },
  { valor: '3m', nome: '3 meses' },
  { valor: 'ano', nome: 'Este ano' },
] as const

const VALIDOS = new Set<string>(PERIODOS.map((p) => p.valor))

/**
 * O que vier no endereço. Qualquer coisa que não seja uma das quatro
 * cai no mês — que é a janela de que uma dona de salão fala quando não
 * diz qual.
 */
export function lerPeriodo(valor: string | undefined): Periodo {
  return valor && VALIDOS.has(valor) ? (valor as Periodo) : 'mes'
}

export function janelaDe(periodo: Periodo, hoje: IsoDay): Janela {
  const ate = hoje
  const de = inicioDe(periodo, hoje)
  const dias = daysBetween(de, ate) + 1

  const deAnterior = inicioAnteriorDe(periodo, de, dias)
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
  }
}

function inicioDe(periodo: Periodo, hoje: IsoDay): IsoDay {
  switch (periodo) {
    case '7d':
      return addDays(hoje, -6)
    case 'mes':
      return `${hoje.slice(0, 7)}-01`
    case '3m':
      // Noventa dias corridos, e não «o trimestre»: a dona quer os
      // últimos três meses a contar de hoje, não janeiro a março.
      return addDays(hoje, -89)
    case 'ano':
      return `${hoje.slice(0, 4)}-01-01`
  }
}

function inicioAnteriorDe(
  periodo: Periodo,
  de: IsoDay,
  dias: number,
): IsoDay {
  switch (periodo) {
    case '7d':
    case '3m':
      // Rolantes: o anterior são os mesmos dias, logo antes.
      return addDays(de, -dias)
    case 'mes': {
      // O primeiro do mês anterior. `de` é sempre um dia 1, por isso a
      // véspera cai no mês de trás e diz qual é.
      const vespera = addDays(de, -1)
      return `${vespera.slice(0, 7)}-01`
    }
    case 'ano':
      return `${Number(de.slice(0, 4)) - 1}-01-01`
  }
}

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

function rotuloDe(periodo: Periodo, de: IsoDay): string {
  switch (periodo) {
    case '7d':
      return 'últimos 7 dias'
    case 'mes':
      return mesDe(de)
    case '3m':
      return 'últimos 3 meses'
    case 'ano':
      return de.slice(0, 4)
  }
}

/**
 * Contra o que se compara, dito de maneira a que ninguém se engane.
 *
 * No mês e no ano a comparação é CORTADA — a 1 de setembro compara-se
 * com o dia 1 de agosto, não com agosto inteiro — e é isso que a
 * legenda tem de dizer. Calada, o painel parecia estar a comparar com
 * um mês cheio e todo o princípio de mês parecia uma derrota.
 */
function rotuloAnteriorDe(
  periodo: Periodo,
  deAnterior: IsoDay,
  ateAnterior: IsoDay,
): string {
  switch (periodo) {
    case '7d':
      return 'os 7 dias antes'
    case '3m':
      return 'os 3 meses antes'
    case 'mes':
      return `${mesDe(deAnterior)}, até ao dia ${Number(ateAnterior.slice(8, 10))}`
    case 'ano':
      return `${deAnterior.slice(0, 4)}, até ${ateAnterior.slice(8, 10)}/${ateAnterior.slice(5, 7)}`
  }
}
