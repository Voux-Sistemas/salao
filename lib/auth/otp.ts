import 'server-only'
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { sql } from '@/lib/db'
import { env } from '@/lib/env'

/**
 * O código de uso único.
 *
 * Três regras que não se negoceiam:
 *   · tem validade;
 *   · tem um número limitado de tentativas;
 *   · serve um só propósito — um código pedido para recuperar a
 *     palavra-passe não abre a sessão da cliente.
 *
 * E uma que é da porta, não daqui: a resposta a "este telefone existe?"
 * é sempre a mesma, exista ou não. Caso contrário a tela de entrada
 * passa a ser um localizador de clientes.
 */

export type OtpPurpose = 'client_login' | 'staff_password_reset'

const TTL_MINUTES = 10
const MAX_ATTEMPTS = 5

const digest = (code: string) =>
  createHmac('sha256', env.sessionSecret).update(code).digest('hex')

function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/**
 * Emite um código novo e invalida os anteriores do mesmo propósito e
 * alvo — pedir outro código apaga o de antes.
 */
export async function issueCode(
  purpose: OtpPurpose,
  target: string,
): Promise<string> {
  const code = newCode()
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000)

  await sql.begin(async (tx) => {
    await tx`
      update otp_code set consumed_at = now(), code_plain = null
       where purpose = ${purpose} and target = ${target} and consumed_at is null
    `
    await tx`
      insert into otp_code (purpose, target, code_hash, code_plain, expires_at, max_attempts)
      values (${purpose}, ${target}, ${digest(code)}, ${code}, ${expiresAt}, ${MAX_ATTEMPTS})
    `
  })

  return code
}

/**
 * Verifica e gasta. Devolve false para código errado, expirado, já usado
 * ou com as tentativas esgotadas — sem dizer qual dos casos é.
 */
export async function consumeCode(
  purpose: OtpPurpose,
  target: string,
  code: string,
): Promise<boolean> {
  const clean = code.replace(/\D/g, '')
  if (clean.length !== 6) return false

  return sql.begin(async (tx) => {
    const rows = await tx<
      { id: string; code_hash: string; attempts: number; max_attempts: number }[]
    >`
      select id, code_hash, attempts, max_attempts
        from otp_code
       where purpose = ${purpose}
         and target = ${target}
         and consumed_at is null
         and expires_at > now()
       order by created_at desc
       limit 1
         for update
    `
    const row = rows[0]
    if (!row) return false

    if (row.attempts >= row.max_attempts) {
      await tx`
        update otp_code set consumed_at = now(), code_plain = null
         where id = ${row.id}
      `
      return false
    }

    const given = Buffer.from(digest(clean), 'hex')
    const stored = Buffer.from(row.code_hash, 'hex')
    const matches =
      given.length === stored.length && timingSafeEqual(given, stored)

    if (!matches) {
      await tx`update otp_code set attempts = attempts + 1 where id = ${row.id}`
      return false
    }

    await tx`
      update otp_code set consumed_at = now(), code_plain = null
       where id = ${row.id}
    `
    return true
  })
}

/** Limpeza oportunista: códigos velhos não têm nada que ficar. */
export async function purgeExpiredCodes(): Promise<void> {
  await sql`
    delete from otp_code
     where expires_at < now() - interval '1 day'
        or (consumed_at is not null and consumed_at < now() - interval '1 day')
  `
}
