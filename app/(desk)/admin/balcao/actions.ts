'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOrgScope } from '@/lib/auth/actor'
import {
  marcarBalcao,
  terminarAparelho,
  trancarAparelho,
} from '@/lib/auth/session'
import { gerarCodigo, guardarCodigo } from '@/lib/balcao'

export type BalcaoState = { error?: string }

/**
 * AS ACÇÕES DO BALCÃO — todas atrás do `requireOrgScope`, que é a dona.
 *
 * E o portão vale por si: numa sessão que JÁ está no balcão, o
 * `requireOrgScope` manda-a para o ecrã fechado. Ou seja, ninguém no
 * balcão pode mexer no código nem trancar aparelhos, mesmo chamando
 * estas acções à mão.
 */

/**
 * Deixa ESTE aparelho no balcão.
 *
 * SEM CONFIRMAÇÃO, de propósito. Uma confirmação ganha o seu lugar
 * quando o engano é caro, e este desfaz-se com a palavra-passe dela na
 * própria coluna — é o contrário do cancelar, que tem dois toques
 * porque não tem volta. O que fecha está escrito no botão, antes do
 * toque.
 */
export async function deixarNoBalcaoAction(): Promise<void> {
  await requireOrgScope()
  await marcarBalcao('staff', true)
  redirect('/agenda')
}

/** Um código novo. O antigo deixa de servir no instante em que este nasce. */
export async function trocarCodigoAction(): Promise<BalcaoState> {
  const actor = await requireOrgScope()
  await guardarCodigo(actor.orgId, gerarCodigo())
  revalidatePath('/admin/balcao')
  return {}
}

/**
 * Tranca um aparelho à distância. NUNCA destranca — destrancar de longe
 * era abrir um tablet num salão onde ela não está.
 */
export async function trancarAparelhoAction(
  _previous: BalcaoState,
  form: FormData,
): Promise<BalcaoState> {
  const actor = await requireOrgScope()
  const id = String(form.get('sessao') ?? '')
  if (!id) return { error: 'Aparelho desconhecido.' }

  await trancarAparelho('staff', actor.id, id)
  revalidatePath('/admin/balcao')
  return {}
}

/** Termina um aparelho à distância — o botão de emergência. */
export async function terminarAparelhoAction(
  _previous: BalcaoState,
  form: FormData,
): Promise<BalcaoState> {
  const actor = await requireOrgScope()
  const id = String(form.get('sessao') ?? '')
  if (!id) return { error: 'Aparelho desconhecido.' }

  await terminarAparelho('staff', actor.id, id)
  revalidatePath('/admin/balcao')
  return {}
}
