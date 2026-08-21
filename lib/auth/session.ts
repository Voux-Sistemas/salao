import 'server-only'
import { cookies, headers } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'
import { env } from '@/lib/env'

/**
 * Duas portas separadas que não se cruzam: a equipa entra com
 * palavra-passe, a cliente com código. Cada porta tem o seu cookie e o
 * seu tipo de sujeito — uma sessão de cliente nunca abre a área da
 * equipa, mesmo que alguém troque os identificadores.
 */

export type SubjectType = 'staff' | 'client'

const COOKIE: Record<SubjectType, string> = {
  staff: 'salao_desk',
  client: 'salao_conta',
}

const TTL_DAYS: Record<SubjectType, number> = {
  staff: 14,
  client: 60,
}

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export async function createSession(
  subjectType: SubjectType,
  subjectId: string,
): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(
    Date.now() + TTL_DAYS[subjectType] * 86_400_000,
  )

  const headerList = await headers()
  await sql`
    insert into session (subject_type, subject_id, token_hash, expires_at, user_agent)
    values (${subjectType}, ${subjectId}, ${hash(token)}, ${expiresAt},
            ${headerList.get('user-agent')?.slice(0, 300) ?? null})
  `

  const jar = await cookies()
  jar.set(COOKIE[subjectType], token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    expires: expiresAt,
  })
}

/** Devolve o id do sujeito, ou null. Renova o last_seen_at. */
export async function readSession(
  subjectType: SubjectType,
): Promise<string | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE[subjectType])?.value
  if (!token) return null

  const rows = await sql<{ subject_id: string }[]>`
    update session
       set last_seen_at = now()
     where token_hash = ${hash(token)}
       and subject_type = ${subjectType}
       and expires_at > now()
    returning subject_id
  `
  return rows[0]?.subject_id ?? null
}

export async function destroySession(subjectType: SubjectType): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE[subjectType])?.value
  if (token) {
    await sql`delete from session where token_hash = ${hash(token)}`
  }
  jar.delete(COOKIE[subjectType])
}

/** Fecha todas as sessões de alguém (ao mudar a palavra-passe). */
export async function destroyAllSessions(
  subjectType: SubjectType,
  subjectId: string,
): Promise<void> {
  await sql`
    delete from session
     where subject_type = ${subjectType} and subject_id = ${subjectId}
  `
}
