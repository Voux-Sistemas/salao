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
 *
 * E A COLUNA ENCOLHE SEM NINGUÉM ACTUALIZAR A PÁGINA.
 *
 * A coluna das portas vive no LAYOUT, e o Next reaproveita o layout
 * quando se anda entre páginas que o partilham. O servidor já sabia que
 * este aparelho estava no balcão — mas a moldura desenhada continuava a
 * ser a de antes, com as cinco portas e a Gestão à vista, até alguém
 * carregar em F5. Para a dona isso lê-se como «não funcionou».
 *
 * `revalidatePath('/', 'layout')` deita fora a árvore inteira, layouts
 * incluídos. É o martelo grande, e é o certo aqui: o que mudou não foi
 * uma página, foi quem esta pessoa é em todas elas.
 *
 * ANTES DO `redirect`, sempre — o `redirect` atira, e o que vier a
 * seguir não corre.
 */
export async function deixarNoBalcaoAction(): Promise<void> {
  await requireOrgScope()
  await marcarBalcao('staff', true)
  revalidatePath('/', 'layout')
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
  revalidatePath('/', 'layout')
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
  revalidatePath('/', 'layout')
  return {}
}
