import 'server-only'
import { sql } from '@/lib/db'
import type { Unit } from '@/lib/org'
import { addDays, minutesOfDay, today, weekdayOf, type IsoDay } from '@/lib/time'

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
): Promise<Window[]> {
  const rows = await sql<
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

/** O horário normal da semana, para o mostrar na página da loja. */
export async function weeklyHours(
  unitId: string,
): Promise<Map<number, Window[]>> {
  const rows = await sql<
    { weekday: number; opens_min: number; closes_min: number }[]
  >`
    select weekday, opens_min, closes_min
      from business_hours
     where unit_id = ${unitId}
     order by weekday, opens_min
  `
  const map = new Map<number, Window[]>()
  for (const row of rows) {
    const list = map.get(row.weekday) ?? []
    list.push({ openMin: row.opens_min, closeMin: row.closes_min })
    map.set(row.weekday, list)
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

  const todayWindows = await openingWindows(unit.id, day)
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
    const windows = await openingWindows(unit.id, next)
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
