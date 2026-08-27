import 'server-only'
import { cache } from 'react'
import { sql, type Sql } from '@/lib/db'
import type { Unit } from '@/lib/org'
import {
  addDays,
  formatMinutes,
  minutesOfDay,
  today,
  weekdayOf,
  type IsoDay,
} from '@/lib/time'

/**
 * O horário de funcionamento, num sítio só.
 *
 * Regra: se existir QUALQUER linha em special_hours para a data, ela
 * substitui por completo o horário normal desse dia. É assim que um
 * feriado fecha a loja e que a véspera de Natal fecha às 15h.
 */

export type Window = { openMin: number; closeMin: number }

/*
 * UMA CONSULTA, NÃO DUAS.
 *
 * A regra continua a mesma — o dia especial substitui o normal — mas
 * perguntar primeiro pelo especial e só depois pelo normal obrigava a
 * esperar pela primeira resposta antes de fazer a segunda pergunta.
 * Entre a função e a base há um oceano: cada ida-e-volta custa perto de
 * cem milésimos, e esta função é chamada por loja e por dia, na montra,
 * na ficha da loja e no funil de marcação todo.
 *
 * Traz-se tudo de uma vez e escolhe-se cá. O `not exists` no ramo do
 * horário normal faz o mesmo que o `if` fazia — se houver linha
 * especial, o normal nem chega a vir — mas fá-lo do lado de lá, sem
 * gastar uma viagem a perguntar.
 */
export async function openingWindows(
  unitId: string,
  day: IsoDay,
  /* Dentro de uma transação, a pergunta tem de ser feita por ela. */
  db: Sql = sql,
): Promise<Window[]> {
  const rows = await db<
    {
      is_closed: boolean
      opens_min: number | null
      closes_min: number | null
    }[]
  >`
    with especial as (
      select is_closed, opens_min, closes_min
        from special_hours
       where unit_id = ${unitId} and on_date = ${day}
    )
    select is_closed, opens_min, closes_min from especial
    union all
    select false, opens_min, closes_min
      from business_hours
     where unit_id = ${unitId} and weekday = ${weekdayOf(day)}
       and not exists (select 1 from especial)
     order by opens_min nulls first
  `

  // Fechado por inteiro: uma linha basta para o dia não ter janelas.
  if (rows.some((r) => r.is_closed)) return []

  return rows
    .filter((r) => r.opens_min !== null && r.closes_min !== null)
    .map((r) => ({ openMin: r.opens_min!, closeMin: r.closes_min! }))
}

/*
 * O HORÁRIO DA SEMANA VEM TODO DE UMA VEZ, PARA A REDE INTEIRA.
 *
 * Uma página pública pede isto várias vezes: o rodapé mostra as duas
 * casas, e a ficha da loja mostra ainda a tabela do horário. Eram três
 * consultas a fazer a mesma pergunta com um `unit_id` diferente.
 *
 * A tabela toda são sete linhas por loja — cabe num bolso. Traz-se
 * inteira e guarda-se com o `cache` do React, que dura o que dura o
 * pedido: a primeira chamada paga a viagem, as outras leem da memória.
 */
export const allWeeklyHours = cache(async (): Promise<Map<string, Map<number, Window[]>>> => {
  const rows = await sql<
    { unit_id: string; weekday: number; opens_min: number; closes_min: number }[]
  >`
    select unit_id, weekday, opens_min, closes_min
      from business_hours
     order by unit_id, weekday, opens_min
  `
  const byUnit = new Map<string, Map<number, Window[]>>()
  for (const row of rows) {
    const days = byUnit.get(row.unit_id) ?? new Map<number, Window[]>()
    const list = days.get(row.weekday) ?? []
    list.push({ openMin: row.opens_min, closeMin: row.closes_min })
    days.set(row.weekday, list)
    byUnit.set(row.unit_id, days)
  }
  return byUnit
})

/*
 * OS DIAS EM QUE CADA CASA ABRE.
 *
 * Um dia sem linha nenhuma em `business_hours` é um dia de porta
 * fechada — é assim que a tabela diz «não abrimos». Serve o editor da
 * escala, para avisar quem marca um turno num domingo de porta
 * fechada: o turno fica lá, nunca dá vaga, e ninguém dá por isso.
 */
export async function openWeekdaysFor(
  unitIds: string[],
): Promise<Map<string, number[]>> {
  const all = await allWeeklyHours()
  const out = new Map<string, number[]>()
  for (const id of unitIds) {
    out.set(id, [...(all.get(id)?.keys() ?? [])].sort((a, b) => a - b))
  }
  return out
}

/** O horário normal da semana, para o mostrar na página da loja. */
export async function weeklyHours(
  unitId: string,
): Promise<Map<number, Window[]>> {
  return (await allWeeklyHours()).get(unitId) ?? new Map()
}

/*
 * VÁRIOS DIAS SEGUIDOS, NUMA VIAGEM SÓ.
 *
 * A mesma regra do dia único — o especial substitui o normal — mas
 * aplicada a uma faixa de datas de uma vez. Serve o `unitStatus`, que
 * às vezes tem de olhar uma semana à frente para saber quando é que a
 * casa volta a abrir; perguntar dia a dia eram oito viagens de oceano
 * para responder "abre segunda às nove".
 *
 * O `generate_series` desenha os dias do lado de lá e o `dow` do
 * Postgres conta o domingo como zero, tal como o `weekdayOf` daqui.
 */
export async function openingWindowsRange(
  unitId: string,
  from: IsoDay,
  days: number,
): Promise<Map<IsoDay, Window[]>> {
  const to = addDays(from, days - 1)

  const rows = await sql<
    {
      day: IsoDay
      is_closed: boolean
      opens_min: number | null
      closes_min: number | null
    }[]
  >`
    with dias as (
      select d::date as on_date, extract(dow from d)::int as weekday
        from generate_series(${from}::date, ${to}::date, interval '1 day') d
    ),
    especial as (
      select on_date, is_closed, opens_min, closes_min
        from special_hours
       where unit_id = ${unitId}
         and on_date between ${from}::date and ${to}::date
    )
    select to_char(dias.on_date, 'YYYY-MM-DD') as day,
           e.is_closed, e.opens_min, e.closes_min
      from dias
      join especial e on e.on_date = dias.on_date
    union all
    select to_char(dias.on_date, 'YYYY-MM-DD') as day,
           false, b.opens_min, b.closes_min
      from dias
      join business_hours b
        on b.unit_id = ${unitId} and b.weekday = dias.weekday
     where not exists (
       select 1 from especial e where e.on_date = dias.on_date
     )
     order by day, opens_min nulls first
  `

  // Fechado por inteiro tranca o dia: uma linha basta, mesmo que
  // venham outras atrás dela.
  const fechados = new Set(rows.filter((r) => r.is_closed).map((r) => r.day))

  const map = new Map<IsoDay, Window[]>()
  for (let i = 0; i < days; i++) map.set(addDays(from, i), [])
  for (const row of rows) {
    if (fechados.has(row.day)) continue
    if (row.opens_min === null || row.closes_min === null) continue
    map.get(row.day)?.push({ openMin: row.opens_min, closeMin: row.closes_min })
  }
  return map
}

/**
 * "aberto agora / fecha às X / abre amanhã às Y" — o estado que a
 * montra mostra. Olha até sete dias à frente antes de desistir.
 */
export type UnitStatus =
  | { open: true; closesAtMin: number }
  | { open: false; nextDay: IsoDay; nextMin: number; isToday: boolean; isTomorrow: boolean }
  | { open: false; nextDay: null }

export async function unitStatus(
  unit: Unit,
  now: Date = new Date(),
): Promise<UnitStatus> {
  const day = today(unit.timezone, now)
  const nowMin = minutesOfDay(now, unit.timezone)

  // Hoje e os sete dias seguintes de uma vez. Antes vinha um por um, e
  // ao domingo à noite — quando a casa está fechada e a montra tem
  // mesmo de olhar longe — isso eram oito esperas em fila.
  const semana = await openingWindowsRange(unit.id, day, 8)

  const todayWindows = semana.get(day) ?? []
  for (const w of todayWindows) {
    if (nowMin >= w.openMin && nowMin < w.closeMin) {
      return { open: true, closesAtMin: w.closeMin }
    }
  }

  const laterToday = todayWindows
    .filter((w) => w.openMin > nowMin)
    .sort((a, b) => a.openMin - b.openMin)[0]
  if (laterToday) {
    return {
      open: false,
      nextDay: day,
      nextMin: laterToday.openMin,
      isToday: true,
      isTomorrow: false,
    }
  }

  for (let i = 1; i <= 7; i++) {
    const next = addDays(day, i)
    const windows = [...(semana.get(next) ?? [])]
    const first = windows.sort((a, b) => a.openMin - b.openMin)[0]
    if (first) {
      return {
        open: false,
        nextDay: next,
        nextMin: first.openMin,
        isToday: false,
        isTomorrow: i === 1,
      }
    }
  }

  return { open: false, nextDay: null }
}

/**
 * "Seg–Sáb · 09:00–21:00" — a semana condensada em duas ou três linhas.
 *
 * Junta dias seguidos com o mesmo horário. Viveu dentro do
 * `public-chrome` enquanto só o rodapé o usava, e saiu de lá com as
 * moradas; volta aqui, ao pé das horas, que é o sítio dele — agora que
 * a ficha de cada loja também precisa de dizer a semana em vez de
 * dizer «hoje».
 *
 * O «hoje» era o problema: mudava conforme a hora a que se olhava para
 * ele, e ficava a contradizer o distintivo do estado mesmo quando os
 * dois estavam certos.
 */
export function weekDigest(
  hours: Map<number, Window[]>,
  shortNames: readonly string[],
  closedLabel: string,
): { days: string; hours: string }[] {
  const ORDER = [1, 2, 3, 4, 5, 6, 0]
  const label = (windows: Window[]) =>
    windows.length === 0
      ? closedLabel
      : windows
          .map((w) => `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`)
          .join(' · ')

  const rows: { days: string; hours: string }[] = []
  let start = 0
  while (start < ORDER.length) {
    const signature = label(hours.get(ORDER[start]!) ?? [])
    let end = start
    while (
      end + 1 < ORDER.length &&
      label(hours.get(ORDER[end + 1]!) ?? []) === signature
    ) {
      end++
    }
    const days =
      start === end
        ? shortNames[ORDER[start]!]!
        : `${shortNames[ORDER[start]!]}–${shortNames[ORDER[end]!]}`
    rows.push({ days, hours: signature })
    start = end + 1
  }
  return rows
}
