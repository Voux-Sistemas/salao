import 'server-only'
import { sql } from '@/lib/db'

/**
 * O /comecar só existe enquanto não houver dona criada. Esta é a
 * pergunta que o faz desaparecer.
 */
export async function ownerExists(): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (select 1 from staff_role where role = 'owner') as exists
  `
  return rows[0]?.exists ?? false
}
