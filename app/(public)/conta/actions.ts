'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  cancelBooking,
  forgetPhone,
  rememberedPhone,
  rememberPhone,
  updateDetails,
} from '@/lib/account'
import { burnTime } from '@/lib/auth/password'
import { consumeCode, issueCode } from '@/lib/auth/otp'
import { getClientActor } from '@/lib/auth/client-actor'
import { createSession, destroySession } from '@/lib/auth/session'
import { findByPhone } from '@/lib/clients'
import { env, normalisePhone } from '@/lib/env'
import { dictionaryFor, getDictionary } from '@/lib/i18n'
import { isLanguage, LANGUAGE_COOKIE } from '@/lib/i18n/config'
import { getOrg } from '@/lib/org'

/**
 * A PORTA DA CLIENTE.
 *
 * Entra-se com um código de uso único — nunca com palavra-passe. E o
 * sistema NÃO envia o código sozinho: gera-o e fica à espera que alguém
 * da casa abra a conversa e o mande. É a mesma regra dos avisos.
 *
 * A resposta a "este telefone tem conta?" é sempre a mesma, exista ou
 * não. Caso contrário esta tela passava a ser um localizador de
 * clientes.
 */

export type AccountState = { error: string | null; done: string | null }

/**
 * Gera o código. Existindo ficha ou não, a resposta é a mesma e o
 * caminho é o mesmo — só muda o que acontece do lado de dentro.
 */
async function generate(phone: string): Promise<void> {
  const org = await getOrg()
  if (!org) return

  const client = await findByPhone(org.id, phone)
  if (!client) {
    await burnTime()
    return
  }

  const code = await issueCode('client_login', phone)
  // Não há canal automático. O código fica legível na fila dos avisos
  // para que uma pessoa o mande pelo WhatsApp.
  console.info(`[código de acesso] ${phone}: ${code}`)
}

export async function requestCodeAction(
  _previous: AccountState,
  form: FormData,
): Promise<AccountState> {
  const dict = await getDictionary()
  const phone = normalisePhone(String(form.get('phone') ?? ''))

  if (phone.replace(/\D/g, '').length < 6) {
    return { error: dict.errors.phoneInvalid, done: null }
  }

  await generate(phone)
  await rememberPhone(phone)
  redirect('/conta/verificar')
}

/** Pedir outra vez apaga o código anterior — é o que issueCode faz. */
export async function resendCodeAction(): Promise<void> {
  const phone = await rememberedPhone()
  if (!phone) redirect('/conta/entrar')

  await generate(phone)
  await rememberPhone(phone)
  redirect('/conta/verificar')
}

export async function verifyCodeAction(
  _previous: AccountState,
  form: FormData,
): Promise<AccountState> {
  const dict = await getDictionary()
  const phone = (await rememberedPhone()) || normalisePhone(String(form.get('phone') ?? ''))
  const code = String(form.get('code') ?? '')

  if (!phone) redirect('/conta/entrar')

  const org = await getOrg()
  if (!org) redirect('/')

  const valid = await consumeCode('client_login', phone, code)
  if (!valid) return { error: dict.account.codeInvalid, done: null }

  const client = await findByPhone(org.id, phone)
  if (!client) return { error: dict.account.codeInvalid, done: null }

  await createSession('client', client.id)
  await forgetPhone()

  redirect('/conta')
}

export async function signOutAction(): Promise<void> {
  await destroySession('client')
  redirect('/')
}

/**
 * A janela de cancelamento é da loja. Passado o prazo, a cliente fala
 * connosco — e uma marcação que não é dela responde o mesmo que uma que
 * não existe.
 */
export async function cancelAction(
  _previous: AccountState,
  form: FormData,
): Promise<AccountState> {
  const dict = await getDictionary()
  const client = await getClientActor()
  if (!client) redirect('/conta/entrar')

  const appointmentId = String(form.get('appointment') ?? '')
  if (!appointmentId) return { error: dict.errors.generic, done: null }

  const result = await cancelBooking(client.id, appointmentId)
  if (!result.ok) {
    return {
      error:
        result.reason === 'too_late'
          ? dict.account.cancelTooLate
          : dict.errors.generic,
      done: null,
    }
  }

  revalidatePath('/conta')
  return { error: null, done: dict.account.cancelled }
}

export async function saveDetailsAction(
  _previous: AccountState,
  form: FormData,
): Promise<AccountState> {
  const dict = await getDictionary()
  const client = await getClientActor()
  if (!client) redirect('/conta/entrar')

  const language = String(form.get('language') ?? '')
  const saved = await updateDetails(client.id, {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    language,
  })
  if (!saved) return { error: dict.errors.nameRequired, done: null }

  // Escolher a língua na ficha é uma escolha explícita: vale também
  // para o que ela está a ver agora.
  if (isLanguage(language)) {
    const jar = await cookies()
    jar.set(LANGUAGE_COOKIE, language, {
      sameSite: 'lax',
      secure: env.isProduction,
      path: '/',
      maxAge: 365 * 86_400,
    })
  }

  revalidatePath('/conta')
  const shown = isLanguage(language) ? dictionaryFor(language) : dict
  return { error: null, done: shown.account.detailsSaved }
}
