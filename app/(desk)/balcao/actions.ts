'use server'

import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/auth/actor'
import { sql } from '@/lib/db'
import { burnTime, verifyPassword } from '@/lib/auth/password'
import { baixarSessao, elevarSessao } from '@/lib/auth/session'

export type AbrirState = { error?: string }

/**
 * «SOU A NOHORA» — a palavra-passe dela, ali no tablet.
 *
 * Abre a Gestão e os números NESTE aparelho, por meia hora, e volta ao
 * balcão sozinho. Não depende de ninguém se lembrar de fechar, que é o
 * ponto todo: se dependesse, falhava à terceira e o tablet ficava aberto
 * de par em par até ao fim da tarde.
 *
 * VERIFICA-SE A PALAVRA-PASSE DE QUEM A SESSÃO JÁ É, e não a de alguém
 * que se identifique. Não é um login — é a mesma pessoa a provar que é
 * ela antes de o aparelho voltar a ser dela.
 */
export async function abrirAction(
  _previous: AbrirState,
  form: FormData,
): Promise<AbrirState> {
  const actor = await requireActor()
  const password = String(form.get('password') ?? '')

  if (!password) return { error: 'Escreva a palavra-passe.' }

  const rows = await sql<{ password_hash: string | null }[]>`
    select password_hash from staff where id = ${actor.id}
  `
  const hash = rows[0]?.password_hash
  if (!hash) {
    // Gasta o mesmo tempo, para «não tem palavra-passe» e «está errada»
    // não se distinguirem pelo relógio.
    await burnTime()
    return { error: 'Esta conta não tem palavra-passe.' }
  }

  if (!(await verifyPassword(password, hash))) {
    return { error: 'A palavra-passe não está certa.' }
  }

  await elevarSessao('staff')
  redirect('/')
}

/** «Voltar já» — desiste do resto da meia hora. */
export async function voltarAoBalcaoAction(): Promise<void> {
  await requireActor()
  await baixarSessao('staff')
  redirect('/agenda')
}
