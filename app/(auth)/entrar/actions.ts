'use server'

import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import { env, normalisePhone } from '@/lib/env'
import { getOrg } from '@/lib/org'
import { burnTime, hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password'
import { createSession, destroyAllSessions, destroySession } from '@/lib/auth/session'
import { consumeCode, issueCode } from '@/lib/auth/otp'
import { LIMITS, allowed, callerIp } from '@/lib/auth/throttle'

/** A mesma resposta para as três portas, para não dizer qual estourou. */
const TOO_MANY = 'Demasiadas tentativas. Espere uns minutos e tente outra vez.'

export type FormState = { error: string | null; done?: string | null }

/**
 * A equipa entra com palavra-passe; a cliente com código. São portas
 * separadas e não se cruzam.
 */
export async function signInAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const escrito = String(form.get('phone') ?? '').trim()
  const password = String(form.get('password') ?? '')

  if (!escrito || !password) {
    return { error: 'Escreva a entrada e a palavra-passe.' }
  }

  /*
   * A ENTRADA É O QUE A PESSOA ESCOLHER.
   *
   * O telemóvel era o identificador porque já era o da cliente, e
   * pareceu natural que servisse para toda a gente. Não serve: muda de
   * operadora, muda de país, e não é coisa que se escreva vinte vezes
   * por dia. Cada pessoa passa a poder ter um usuário seu.
   *
   * O telemóvel continua a valer — quem nunca escolheu nome nenhum
   * entra como sempre entrou, e ninguém fica de fora.
   *
   * O balde do travão conta pelo que foi escrito, em minúsculas, para
   * que «Admin» e «admin» partilhem o mesmo balde. Sem isso, mudar a
   * caixa de uma letra dava dez tentativas novas.
   */
  const chave = escrito.toLowerCase()

  /*
   * O `burnTime` abaixo faz com que errar demore o mesmo que acertar —
   * mas demorar igual não impede ninguém de tentar outra vez. Dois
   * baldes: um pelo telefone, que apanha quem martela uma conta; outro
   * pelo endereço, que apanha quem varre a lista de telefones toda.
   */
  const ip = await callerIp()
  const [chaveOk, ipOk] = await Promise.all([
    allowed('entrar', chave, LIMITS.signIn),
    allowed('entrar-ip', ip, LIMITS.signInByIp),
  ])
  if (!chaveOk || !ipOk) return { error: TOO_MANY }

  const org = await getOrg()
  if (!org) redirect('/comecar')

  const phone = normalisePhone(escrito)

  /*
   * Uma consulta só, pelas duas portas. `lower(login)` porque o índice
   * é assim e ninguém se lembra de como escreveu o próprio nome; o
   * telemóvel compara-se já normalizado, para que «+351 912 345 678» e
   * «912345678» encontrem a mesma pessoa.
   */
  const rows = await sql<{ id: string; password_hash: string | null }[]>`
    select id, password_hash
      from staff
     where org_id = ${org.id}
       and is_active
       and (
         lower(login) = ${chave}
         or (${phone} <> '' and phone = ${phone})
       )
     limit 1
  `
  const staff = rows[0]

  // Conta que não existe demora o mesmo que conta com senha errada.
  if (!staff || !staff.password_hash) {
    await burnTime()
    return { error: 'Entrada ou palavra-passe erradas.' }
  }

  const ok = await verifyPassword(password, staff.password_hash)
  if (!ok) return { error: 'Entrada ou palavra-passe erradas.' }

  await createSession('staff', staff.id)
  redirect('/')
}

export async function signOutAction(): Promise<void> {
  await destroySession('staff')
  redirect('/entrar')
}

/**
 * Recuperar a palavra-passe: pede-se um código. A resposta é sempre a
 * mesma, exista a conta ou não.
 */
export async function requestResetAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (!email) return { error: 'Escreva o e-mail.' }

  // Sem travão, este formulário era uma máquina de encher a caixa de
  // correio de outra pessoa — e de gastar códigos até um acertar.
  const ip = await callerIp()
  const [emailOk, ipOk] = await Promise.all([
    allowed('recuperar', email, LIMITS.issueCode),
    allowed('recuperar-ip', ip, LIMITS.issueCodeByIp),
  ])
  if (!emailOk || !ipOk) return { error: TOO_MANY }

  const org = await getOrg()
  if (!org) redirect('/comecar')

  const rows = await sql<{ id: string }[]>`
    select id from staff
     where org_id = ${org.id} and lower(email) = ${email} and is_active
     limit 1
  `

  let hint: string | null = null
  if (rows[0]) {
    const code = await issueCode('staff_password_reset', email)
    // Não há canal automático de envio. Em desenvolvimento mostra-se o
    // código; em produção fica no registo do servidor, e quem administra
    // passa-o à pessoa.
    console.info(`[código de recuperação] ${email}: ${code}`)
    if (!env.isProduction) hint = `Código (só em desenvolvimento): ${code}`
  } else {
    await burnTime()
  }

  return {
    error: null,
    done: hint ?? 'Se esta conta existir, o código já foi gerado.',
  }
}

export async function resetPasswordAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const code = String(form.get('code') ?? '')
  const password = String(form.get('password') ?? '')
  const repeat = String(form.get('repeat') ?? '')

  if (password !== repeat) return { error: 'As palavras-passe não coincidem.' }
  const problem = passwordProblem(password)
  if (problem) return { error: problem }

  // O código já só aceita cinco tentativas, mas pedir códigos novos
  // renova essas cinco. Este balde conta as tentativas todas.
  if (!(await allowed('recuperar-conf', email, LIMITS.verifyCode))) {
    return { error: TOO_MANY }
  }

  const org = await getOrg()
  if (!org) redirect('/comecar')

  const valid = await consumeCode('staff_password_reset', email, code)
  if (!valid) return { error: 'Código errado ou expirado.' }

  const rows = await sql<{ id: string }[]>`
    select id from staff
     where org_id = ${org.id} and lower(email) = ${email} and is_active
     limit 1
  `
  const staff = rows[0]
  if (!staff) return { error: 'Código errado ou expirado.' }

  await sql`
    update staff set password_hash = ${await hashPassword(password)}
     where id = ${staff.id}
  `
  // Mudar a palavra-passe fecha as sessões abertas.
  await destroyAllSessions('staff', staff.id)
  await createSession('staff', staff.id)
  redirect('/')
}
