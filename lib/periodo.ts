import {
  addDays,
  daysBetween,
  isValidDay,
  type IsoDay,
} from '@/lib/time'

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
 * QUATRO ESCOLHAS, E A ÚLTIMA FAZ AS OUTRAS TODAS. Hoje, sete dias,
 * este mês — e um intervalo à mão. «Três meses» e «este ano» eram
 * pastilhas fixas a fazer o que o intervalo à mão faz melhor, porque
 * ele também sabe fazer «a semana da Páscoa» e «agosto do ano passado».
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

export type Periodo = 'hoje' | '7d' | 'mes' | 'custom'

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
   * O QUE ELA TOCOU NO CALENDÁRIO — ou nulo se ainda não tocou nada.
   *
   * Não é o mesmo que `de`/`ate`. Quando o «Personalizado» abre pela
   * primeira vez não há escolha nenhuma, mas a página tem de mostrar
   * alguma coisa por baixo — e mostra o mês. Se o calendário lesse
   * `de`/`ate` ficava com o mês inteiro pintado como se ela o tivesse
   * escolhido, e o primeiro toque parecia estar a desfazer qualquer
   * coisa em vez de a começar.
   *
   * Só o calendário lê isto. As contas leem `de` e `ate`, sempre.
   */
  escolha: { de: IsoDay; ate: IsoDay } | null
}

/** As quatro escolhas, pela ordem em que aparecem no selector. */
export const PERIODOS: readonly { valor: Periodo; nome: string }[] = [
  { valor: 'hoje', nome: 'Hoje' },
  { valor: '7d', nome: '7 dias' },
  { valor: 'mes', nome: 'Este mês' },
  { valor: 'custom', nome: 'Personalizado' },
] as const

/**
 * DOIS ANOS É O TECTO, e não é teimosia.
 *
 * O mapa das horas parte cada turno hora a hora antes de medir o que
 * lá está marcado. Cinco anos de uma vez são dezenas de milhares de
 * células, cada uma com duas subconsultas — é onde ele deixa de
 * responder. Um intervalo maior do que isto encolhe-se pela ponta mais
 * antiga, que é a que menos interessa a quem está a olhar.
 */
const MAX_DIAS = 731

/**
 * O QUE VEM NO ENDEREÇO, TRANSFORMADO NUMA JANELA — E NUNCA UM ERRO.
 *
 * Isto lê texto de fora: um atalho guardado, um endereço escrito à
 * mão, um formulário submetido com o campo em branco. Tudo o que não
 * fizer sentido cai no mês, em silêncio. A alternativa era um ecrã
 * rebentado à frente da cliente por causa de uma letra a mais no
 * endereço.
 *
 * AS DATAS AO CONTRÁRIO TROCAM-SE. Escolher «de 31/08 até 12/08» é um
 * engano de dedo, não um pedido; recusá-lo com uma frase era fazê-la
 * repetir o trabalho para dizer o que já se percebeu.
 */
export function lerJanela(
  params: { p?: string; de?: string; ate?: string },
  hoje: IsoDay,
): Janela {
  if (params.p === 'custom') {
    const janela = janelaAMao(params.de, params.ate, hoje)
    if (janela) return janela
    /*
      «Personalizado» sem datas ainda válidas é o estado normal do
      primeiro toque: a gaveta abriu, ninguém escolheu nada. Mostra-se
      o mês por baixo dela — e não um ecrã vazio à espera.
    */
    return { ...janelaDe('mes', hoje), periodo: 'custom' }
  }

  const p = PERIODOS.find((x) => x.valor === params.p)?.valor
  return janelaDe(p && p !== 'custom' ? p : 'mes', hoje)
}

export function janelaDe(
  periodo: Exclude<Periodo, 'custom'>,
  hoje: IsoDay,
): Janela {
  const de = inicioDe(periodo, hoje)
  return montar(periodo, de, hoje, inicioAnteriorDe(periodo, de, hoje))
}

/** O intervalo escolhido à mão, já limpo — ou nulo se não for um. */
function janelaAMao(
  deBruto: string | undefined,
  ateBruto: string | undefined,
  hoje: IsoDay,
): Janela | null {
  if (!deBruto || !ateBruto) return null
  if (!isValidDay(deBruto) || !isValidDay(ateBruto)) return null

  // Ao contrário? Trocam-se — ver o cabeçalho do `lerJanela`.
  let de = deBruto < ateBruto ? deBruto : ateBruto
  let ate = deBruto < ateBruto ? ateBruto : deBruto

  /*
    O FUTURO CORTA-SE. Estas contas somam o que já foi feito; dias que
    ainda não aconteceram só acrescentavam zeros e faziam a ocupação
    parecer pior do que é. O que está para vir tem o seu próprio sítio
    na página, e é sempre os próximos sete dias.
  */
  if (ate > hoje) ate = hoje
  if (de > ate) de = ate

  if (daysBetween(de, ate) + 1 > MAX_DIAS) de = addDays(ate, -(MAX_DIAS - 1))

  return montar('custom', de, ate, null, { de, ate })
}

function montar(
  periodo: Periodo,
  de: IsoDay,
  ate: IsoDay,
  deAnteriorPedido: IsoDay | null,
  escolha: { de: IsoDay; ate: IsoDay } | null = null,
): Janela {
  const dias = daysBetween(de, ate) + 1
  // Sem âncora análoga — o caso do intervalo à mão — o anterior são os
  // mesmos dias, logo antes.
  const deAnterior = deAnteriorPedido ?? addDays(de, -dias)

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
    rotulo: rotuloDe(periodo, de, ate),
    rotuloAnterior: rotuloAnteriorDe(periodo, deAnterior, ateAnterior, dias),
    escolha,
  }
}

function inicioDe(periodo: Exclude<Periodo, 'custom'>, hoje: IsoDay): IsoDay {
  switch (periodo) {
    case 'hoje':
      return hoje
    case '7d':
      return addDays(hoje, -6)
    case 'mes':
      return `${hoje.slice(0, 7)}-01`
  }
}

function inicioAnteriorDe(
  periodo: Exclude<Periodo, 'custom'>,
  de: IsoDay,
  hoje: IsoDay,
): IsoDay {
  switch (periodo) {
    case 'hoje':
      return addDays(hoje, -1)
    case '7d':
      return addDays(de, -7)
    case 'mes': {
      // O primeiro do mês anterior. `de` é sempre um dia 1, por isso a
      // véspera cai no mês de trás e diz qual é.
      const vespera = addDays(de, -1)
      return `${vespera.slice(0, 7)}-01`
    }
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

/** «12/08» — o dia e o mês, sem o ano e sem passar por fuso nenhum. */
export function diaMes(day: IsoDay): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`
}

function rotuloDe(periodo: Periodo, de: IsoDay, ate: IsoDay): string {
  switch (periodo) {
    case 'hoje':
      return 'hoje'
    case '7d':
      return 'últimos 7 dias'
    case 'mes':
      return mesDe(de)
    case 'custom':
      return de === ate ? diaMes(de) : `${diaMes(de)} – ${diaMes(ate)}`
  }
}

/**
 * Contra o que se compara, dito de maneira a que ninguém se engane.
 *
 * No mês a comparação é CORTADA — a 1 de setembro compara-se com o dia
 * 1 de agosto, não com agosto inteiro — e é isso que a legenda tem de
 * dizer. Calada, o painel parecia estar a comparar com um mês cheio e
 * todo o princípio de mês parecia uma derrota.
 */
function rotuloAnteriorDe(
  periodo: Periodo,
  deAnterior: IsoDay,
  ateAnterior: IsoDay,
  dias: number,
): string {
  switch (periodo) {
    case 'hoje':
      return 'ontem'
    case '7d':
      return 'os 7 dias antes'
    case 'mes':
      return `${mesDe(deAnterior)}, até ao dia ${Number(ateAnterior.slice(8, 10))}`
    case 'custom':
      return dias === 1
        ? `${diaMes(deAnterior)}`
        : `os ${dias} dias antes`
  }
}
