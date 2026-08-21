import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { readSession } from '@/lib/auth/session'
import type { Language } from '@/lib/i18n/config'

/**
 * A cliente não é um dos quatro degraus da equipa: entra por uma porta
 * própria e só vê as marcações dela.
 */
export type ClientActor = {
  id: string
  orgId: string
  name: string
  phone: string
  email: string | null
  language: Language
}

export const getClientActor = cache(async (): Promise<ClientActor | null> => {
  const id = await readSession('client')
  if (!id) return null

  const rows = await sql<
    {
      id: string
      org_id: string
      name: string
      phone: string
      email: string | null
      language: Language
    }[]
  >`
    select id, org_id, name, phone, email, language
      from client
     where id = ${id} and is_active
  `
  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    language: row.language,
  }
})

export async function requireClientActor(): Promise<ClientActor> {
  const client = await getClientActor()
  if (!client) redirect('/conta/entrar')
  return client
}
