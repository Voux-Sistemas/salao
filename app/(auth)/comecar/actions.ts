'use server'

import { redirect } from 'next/navigation'
import { timingSafeEqual } from 'node:crypto'
import { sql } from '@/lib/db'
import { env, normalisePhone } from '@/lib/env'
import { hashPassword, passwordProblem } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { slugify } from '@/lib/text'
import { ownerExists } from '@/lib/auth/setup'
import type { FormState } from '@/app/(auth)/entrar/actions'

/**
 * A instalação. Só existe enquanto não houver dona criada — depois
 * deixa de existir. Está protegida por um código que vive no ambiente,
 * não na base de dados.
 */
export async function setupAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const already = await ownerExists()
  if (already) redirect('/entrar')

  const setupCode = String(form.get('setup') ?? '')
  if (!sameCode(setupCode, env.setupCode)) {
    return { error: 'Código de instalação errado.' }
  }

  const orgName = String(form.get('org') ?? '').trim()
  const name = String(form.get('name') ?? '').trim()
  const phone = normalisePhone(String(form.get('phone') ?? ''))
  const email = String(form.get('email') ?? '').trim() || null
  const password = String(form.get('password') ?? '')
  const repeat = String(form.get('repeat') ?? '')
  const timezone = String(form.get('timezone') ?? 'Europe/Lisbon')

  if (!orgName) return { error: 'Escreva o nome da rede.' }
  if (!name) return { error: 'Escreva o seu nome.' }
  if (phone.replace(/\D/g, '').length < 9) {
    return { error: 'Esse número não parece válido.' }
  }
  if (password !== repeat) return { error: 'As palavras-passe não coincidem.' }
  const problem = passwordProblem(password)
  if (problem) return { error: problem }

  const hash = await hashPassword(password)

  const staffId = await sql.begin(async (tx) => {
    const orgRows = await tx<{ id: string }[]>`
      insert into org (name, slug, timezone)
      values (${orgName}, ${slugify(orgName) || 'rede'}, ${timezone})
      returning id
    `
    const org = orgRows[0]
    if (!org) throw new Error('não foi possível criar a rede')

    const staffRows = await tx<{ id: string }[]>`
      insert into staff (org_id, name, phone, email, password_hash)
      values (${org.id}, ${name}, ${phone}, ${email}, ${hash})
      returning id
    `
    const staff = staffRows[0]
    if (!staff) throw new Error('não foi possível criar a conta')

    // Dona é sempre escopo rede: papel sem loja associada.
    await tx`
      insert into staff_role (staff_id, role, unit_id)
      values (${staff.id}, 'owner', null)
    `

    return staff.id
  })

  await createSession('staff', staffId)
  redirect('/')
}

function sameCode(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
