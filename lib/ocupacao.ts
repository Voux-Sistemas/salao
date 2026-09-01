import 'server-only'
import { sql } from '@/lib/db'
import {
  addDays,
  daysBetween,
  isoRange,
  today,
  weekdayOf,
  type IsoDay,
} from '@/lib/time'

/**
 * A OCUPAÇÃO — O NÚMERO QUE FALTAVA À CASA.
 *
 * A faturação diz quanto entrou. As marcações dizem quantas foram. Nem
 * uma nem outra respondem à pergunta de quem tem um salão: DAS HORAS
 * QUE A EQUIPA ESTÁ CÁ, QUANTAS ESTÃO VENDIDAS?
 *
 * É a conta que separa dois problemas que parecem o mesmo. Um dia mau
 * com a equipa cheia é falta de clientes; um dia mau com meia equipa é
 * outra coisa. O painel mostrava «3 h 15 livres» dentro de um buraco da
 * agenda, uma linha de cada vez — nunca o total, nunca a proporção.
 *
 * AS PEÇAS JÁ EXISTIAM TODAS. A escala semanal (`staff_schedule`), os
 * turnos extra por data (`staff_shift`), as ausências (`staff_absence`)
 * e o trabalho marcado (`staff_block`). Isto não inventa dados nem pede
 * colunas novas: subtrai os que já lá estão.
 *
 * O DENOMINADOR É A ESCALA, NÃO O HORÁRIO DA LOJA. Uma loja aberta das
 * nove às oito com uma pessoa escalada até às duas tem seis horas de
 * porta aberta que ninguém podia vender. Contá-las como vazias era
 * dizer que a casa tem um problema que não tem.
 *
 * E O QUE SE VENDE CONTA-SE DENTRO DO TURNO. Um encaixe fora da escala
 * — que acontece — não engorda nem o numerador nem o denominador. Sem
 * isso a ocupação passava dos cem por cento e deixava de se ler.
 *
 * A ESCALA VIVE EM MINUTOS LOCAIS, as ausências e os blocos em
 * instantes absolutos. É o `at time zone` que junta os dois mundos, no
 * fuso da loja a que o turno pertence — que pode não ser o da rede.
 */

export type Ocupacao = {
  /** Minutos escalados, já sem as ausências. */
  escalado: number
  /** Minutos com trabalho marcado por cima. */
  vendido: number
}

export type DiaOcupado = Ocupacao & { day: IsoDay }

/**
 * A OCUPAÇÃO DE UM INTERVALO, DIA A DIA.
 *
 * Era `ocupacaoDaSemana` e só sabia fazer a semana corrente. A conta
 * nunca teve nada de semanal — é uma soma por data — e o painel passou
 * a poder pedir sete dias, um mês ou um ano. Quem quer a semana pede a
 * semana; quem quer o que vem aí pede os sete dias à frente, e a mesma
 * consulta responde às duas.
 *
 * OS DIAS SEM ESCALA VÊM NA MESMA, com zeros. Um dia em que a casa não
 * abriu não é um dia mau — e sem a linha lá, «segunda» calada podia
 * ser qualquer das duas coisas.
 */
export async function ocupacaoPorDia(
  orgId: string,
  de: IsoDay,
  ate: IsoDay,
): Promise<DiaOcupado[]> {
  const dias = isoRange(de, daysBetween(de, ate) + 1)

  const linhas = await sql<DiaOcupado[]>`
    ${turnos(orgId, de, ate)}
    select to_char(j.on_date, 'YYYY-MM-DD') as day,
           greatest(0, sum(
             extract(epoch from (j.fim - j.ini)) / 60 - aus.mins
           ))::int as escalado,
           sum(ven.mins)::int as vendido
      from janelas j
      cross join lateral (
        select coalesce(sum(greatest(0, extract(epoch from (
                 least(j.fim, ab.ends_at) - greatest(j.ini, ab.starts_at)
               )) / 60)), 0) as mins
          from staff_absence ab
         where ab.staff_id = j.staff_id
           and ab.starts_at < j.fim and ab.ends_at > j.ini
      ) aus
      cross join lateral (
        select coalesce(sum(greatest(0, extract(epoch from (
                 least(j.fim, upper(sb.during)) - greatest(j.ini, lower(sb.during))
               )) / 60)), 0) as mins
          from staff_block sb
          join appointment_item ai on ai.id = sb.appointment_item_id
         where ai.staff_id = j.staff_id
           and sb.during && tstzrange(j.ini, j.fim)
      ) ven
     group by j.on_date
     order by j.on_date
  `

  const porDia = new Map(linhas.map((r) => [r.day, r]))
  return dias.map((day) => porDia.get(day) ?? { day, escalado: 0, vendido: 0 })
}

/**
 * A semana corrente, da segunda ao domingo. Uma comodidade sobre o
 * `ocupacaoPorDia` — a fita de hoje só quer a coluna de hoje, e pedir a
 * semana inteira custa o mesmo que pedir um dia.
 */
export async function ocupacaoDaSemana(
  orgId: string,
  timezone: string,
  hoje = today(timezone),
): Promise<DiaOcupado[]> {
  const segunda = segundaDe(hoje)
  return ocupacaoPorDia(orgId, segunda, addDays(segunda, 6))
}

/** O intervalo inteiro somado — o número grande. */
export function somar(dias: readonly Ocupacao[]): Ocupacao {
  return dias.reduce(
    (total, dia) => ({
      escalado: total.escalado + dia.escalado,
      vendido: total.vendido + dia.vendido,
    }),
    { escalado: 0, vendido: 0 },
  )
}

export type DiaDaSemanaOcupado = Ocupacao & {
  /** 0 = domingo, como o `getDay` e o `extract(dow)`. */
  weekday: number
}

/**
 * A MÉDIA POR DIA DA SEMANA — E PORQUE SUBSTITUIU «ESTA SEMANA».
 *
 * O painel mostrava a semana corrente, dia a dia. Uma semana é ruído:
 * uma quinta a 5% pode ter sido feriado, doença, ou a chuva. Não se
 * decide nada com ela.
 *
 * A mesma barra sobre um mês ou um trimestre passa a dizer outra
 * coisa: se as quintas estão a 5% em média de oito quintas, isso é a
 * casa e não o acaso — e é uma decisão à espera de ser tomada.
 *
 * SOMA-SE ANTES DE DIVIDIR. Fazer a média das percentagens de cada
 * quinta daria o mesmo peso a uma quinta com uma pessoa escalada e a
 * outra com quatro. Somam-se os minutos escalados e os vendidos de
 * todas as quintas, e divide-se uma vez — é a ocupação verdadeira das
 * quintas, não a média de umas quantas contas.
 */
export function porDiaDaSemana(
  dias: readonly DiaOcupado[],
): DiaDaSemanaOcupado[] {
  const baldes = new Map<number, Ocupacao>()
  for (const dia of dias) {
    const d = weekdayOf(dia.day)
    const balde = baldes.get(d) ?? { escalado: 0, vendido: 0 }
    balde.escalado += dia.escalado
    balde.vendido += dia.vendido
    baldes.set(d, balde)
  }

  // Segunda primeiro, domingo no fim — a semana da casa.
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    ...(baldes.get(weekday) ?? { escalado: 0, vendido: 0 }),
  }))
}

/** A percentagem, ou nulo quando não houve escala nenhuma para dividir. */
export function percentagem(o: Ocupacao): number | null {
  if (o.escalado <= 0) return null
  return Math.min(100, Math.round((o.vendido / o.escalado) * 100))
}

/**
 * O DIA MAIS FRACO DO QUE VEM AÍ.
 *
 * Não é o dia com menos marcações — é o com menos proporção vendida. A
 * diferença conta: uma segunda com duas marcações e uma pessoa
 * escalada está mais cheia do que um sábado com quatro e a equipa
 * toda, e é no sábado que há o que fazer.
 *
 * OS DIAS SEM ESCALA NÃO CONCORREM. Um domingo fechado tem zero
 * vendido e zero escalado; apontá-lo como o dia fraco era mandar a
 * dona abrir a casa ao domingo por engano.
 */
export function diaMaisFraco(
  dias: readonly DiaOcupado[],
): { dia: DiaOcupado; pc: number } | null {
  let pior: { dia: DiaOcupado; pc: number } | null = null
  for (const dia of dias) {
    const pc = percentagem(dia)
    if (pc === null) continue
    if (!pior || pc < pior.pc) pior = { dia, pc }
  }
  return pior
}

/**
 * O MAPA DAS HORAS QUE SOBRAM.
 *
 * O período escolhido em cima, uma casa por dia-da-semana e por hora.
 * Diz onde a casa NUNCA vende — e é aí que se põe uma promoção, não no
 * sábado à tarde que já está cheio.
 *
 * Era sempre seis semanas, fosse qual fosse o resto da página. Duas
 * janelas diferentes no mesmo ecrã são duas verdades que não batem
 * certo: a ocupação dizia 32% desta semana e o mapa mostrava a mancha
 * de mês e meio, sem nada a avisar que falavam de tempos diferentes.
 *
 * O turno é cortado hora a hora ANTES de se medir o que lá está
 * marcado: uma coloração das 10:30 às 12:00 conta meia hora nas dez,
 * uma hora nas onze, e nada nas nove. Sem esse corte, uma marcação
 * longa pintava a hora em que começou e deixava as seguintes brancas.
 */
export type CasaDoMapa = {
  /** 0 = domingo, como o `extract(dow)` do Postgres. */
  weekday: number
  hour: number
  escalado: number
  vendido: number
}

export async function mapaDasHoras(
  orgId: string,
  de: IsoDay,
  ate: IsoDay,
): Promise<CasaDoMapa[]> {
  return sql<CasaDoMapa[]>`
    ${turnos(orgId, de, ate)},
    /*
      Cada turno partido pelas horas que atravessa, já aparado às pontas
      dele. Corta-se aqui e não no fim: as contas de ausência e de
      trabalho marcado passam a correr sobre pedaços pequenos, e cada
      pedaço já sabe a que hora pertence.
    */
    celulas as (
      select j.on_date, j.staff_id, g.hora,
             greatest(j.ini, (j.on_date + make_interval(mins => g.hora * 60))
                             at time zone j.tz) as ini,
             least(j.fim, (j.on_date + make_interval(mins => (g.hora + 1) * 60))
                          at time zone j.tz) as fim
        from janelas j
        cross join generate_series(0, 23) g(hora)
       where (j.on_date + make_interval(mins => (g.hora + 1) * 60))
             at time zone j.tz > j.ini
         and (j.on_date + make_interval(mins => g.hora * 60))
             at time zone j.tz < j.fim
    )
    select extract(dow from c.on_date)::int as weekday,
           c.hora as hour,
           greatest(0, sum(
             extract(epoch from (c.fim - c.ini)) / 60 - aus.mins
           ))::int as escalado,
           sum(ven.mins)::int as vendido
      from celulas c
      cross join lateral (
        select coalesce(sum(greatest(0, extract(epoch from (
                 least(c.fim, ab.ends_at) - greatest(c.ini, ab.starts_at)
               )) / 60)), 0) as mins
          from staff_absence ab
         where ab.staff_id = c.staff_id
           and ab.starts_at < c.fim and ab.ends_at > c.ini
      ) aus
      cross join lateral (
        select coalesce(sum(greatest(0, extract(epoch from (
                 least(c.fim, upper(sb.during)) - greatest(c.ini, lower(sb.during))
               )) / 60)), 0) as mins
          from staff_block sb
          join appointment_item ai on ai.id = sb.appointment_item_id
         where ai.staff_id = c.staff_id
           and sb.during && tstzrange(c.ini, c.fim)
      ) ven
     group by 1, 2
     order by 1, 2
  `
}

// ---------------------------------------------------------------------
// A peça comum
// ---------------------------------------------------------------------

/**
 * Os turnos da rede entre dois dias, já convertidos em instantes: a
 * escala semanal com a vigência testada dia a dia, mais os turnos extra
 * que entram pela data.
 *
 * Fragmento novo a cada uso — o mesmo pedaço não se serve a duas
 * consultas, que é a regra desta casa desde a lista de clientes.
 */
function turnos(orgId: string, de: IsoDay, ate: IsoDay) {
  return sql`
    with dias as (
      select d::date as on_date, extract(dow from d)::int as weekday
        from generate_series(${de}::date, ${ate}::date, interval '1 day') d
    ),
    escalados as (
      select dias.on_date, ss.staff_id, ss.unit_id, ss.starts_min, ss.ends_min
        from dias
        join staff_schedule ss
          on ss.weekday = dias.weekday
         and ss.valid_from <= dias.on_date
         and (ss.valid_to is null or ss.valid_to >= dias.on_date)
      union all
      select sh.day, sh.staff_id, sh.unit_id, sh.starts_min, sh.ends_min
        from staff_shift sh
       where sh.day between ${de}::date and ${ate}::date
    ),
    janelas as (
      select e.on_date, e.staff_id, u.timezone as tz,
             (e.on_date + make_interval(mins => e.starts_min))
               at time zone u.timezone as ini,
             (e.on_date + make_interval(mins => e.ends_min))
               at time zone u.timezone as fim
        from escalados e
        join unit u on u.id = e.unit_id
       where u.org_id = ${orgId} and u.is_active
    )
  `
}

/** A segunda-feira da semana de um dia. */
function segundaDe(day: IsoDay): IsoDay {
  const dow = weekdayOf(day)
  return addDays(day, dow === 0 ? -6 : 1 - dow)
}
