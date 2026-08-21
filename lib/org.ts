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

export const getUnitBySlug = cache(
  async (slug: string): Promise<Unit | null> => {
    const rows = await sql<Unit[]>`
      select * from unit where slug = ${slug} and is_active limit 1
    `
    return rows[0] ?? null
  },
)
