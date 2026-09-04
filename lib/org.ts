import 'server-only'
import { cache } from 'react'
import { sql } from '@/lib/db'

export type Org = {
  id: string
  name: string
  slug: string
  timezone: string
  currency: string
  default_language: string
  whatsapp_phone: string | null
}

export type Unit = {
  id: string
  org_id: string
  slug: string
  name: string
  timezone: string
  address_line: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  latitude: string | null
  longitude: string | null
  phone: string | null
  email: string | null
  whatsapp_phone: string | null
  min_lead_minutes: number
  max_lead_days: number
  slot_granularity_minutes: number
  gap_between_services_minutes: number
  cancel_window_hours: number
  /** Até quantos minutos antes a cliente ainda pode mudar de hora sozinha. */
  reschedule_window_minutes: number
  assignment_strategy: 'balance_load' | 'first_available' | 'least_busy_week'
  is_active: boolean
  sort_order: number
}

/**
 * Há uma rede só. Se ainda não existir nenhuma, o sistema está por
 * instalar e o /comecar assume o comando.
 */
export const getOrg = cache(async (): Promise<Org | null> => {
  const rows = await sql<Org[]>`
    select id, name, slug, timezone, currency, default_language, whatsapp_phone
      from org
     order by created_at
     limit 1
  `
  return rows[0] ?? null
})

export const requireOrg = cache(async (): Promise<Org> => {
  const org = await getOrg()
  if (!org) throw new Error('Ainda não existe rede criada. Vai a /comecar.')
  return org
})

export const listUnits = cache(async (): Promise<Unit[]> => {
  return sql<Unit[]>`
    select * from unit
     where is_active
     order by sort_order, name
  `
})

export type UnitPhoto = {
  id: string
  unit_id: string
  url: string
  alt: string | null
}

/**
 * A capa de cada loja: a primeira fotografia pela ordem em que a dona as
 * arrumou. `distinct on` traz uma linha por loja sem trazer as outras
 * oito para o servidor e deitá-las fora aqui.
 *
 * Devolve um mapa porque quem chama já tem a lista de lojas em mão e só
 * quer perguntar "e desta, há foto?" — uma pergunta por loja, sem varrer
 * a lista toda de cada vez.
 */
export const listUnitCovers = cache(
  async (): Promise<Map<string, UnitPhoto>> => {
    const rows = await sql<UnitPhoto[]>`
      select distinct on (p.unit_id) p.id, p.unit_id, p.url, p.alt
        from unit_photo p
       order by p.unit_id, p.sort_order, p.created_at
    `
    return new Map(rows.map((row) => [row.unit_id, row]))
  },
)

export const getUnitBySlug = cache(
  async (slug: string): Promise<Unit | null> => {
    const rows = await sql<Unit[]>`
      select * from unit where slug = ${slug} and is_active limit 1
    `
    return rows[0] ?? null
  },
)

