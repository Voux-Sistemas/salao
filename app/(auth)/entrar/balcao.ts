'use server'

import { redirect } from 'next/navigation'
import { requireOrg } from '@/lib/org'
import { burnTime } from '@/lib/auth/password'
import { createSession, marcarBalcao } from '@/lib/auth/session'
import { quemAbreComCodigo } from '@/lib/balcao'

export type EntrarState = { error?: string }

/**
 * ENTRAR COM O CÓDIGO DO BALCÃO.
 *
 * Abre uma sessão da dona JÁ EM MODO BALCÃO — nunca uma sessão inteira.
 * A ordem importa: cria-se e marca-se de seguida, na mesma resposta, e
 * a página só se desenha depois. Não há instante nenhum em que este
 * aparelho tenha a sessão dela por trancar.
 *
 * É PARA UM DIA MAU. O tablet do salão desligou-se, a dona está noutro
 * salão, e há uma cliente ao balcão a perguntar se dá para a semana. Sem
 * isto, a única saída era ela ditar a palavra-passe dela ao telefone —
 * que é exactamente o que este modo todo existe para evitar.
 *
 * ERRAR DEMORA O MESMO QUE ACERTAR. Um código de seis dígitos responde
 * depressa demais para quem o esteja a tentar adivinhar; o `burnTime`
 * gasta o tempo de uma verificação a sério.
 */
export async function entrarNoBalcaoAction(
  _previous: EntrarState,
  form: FormData,
): Promise<EntrarState> {
  const codigo = String(form.get('codigo') ?? '').trim()
  if (!codigo) return { error: 'Escreva o código do balcão.' }

  const org = await requireOrg()
  const donaId = await quemAbreComCodigo(org.id, codigo)

  if (!donaId) {
    await burnTime()
    return { error: 'Esse código não abre nada.' }
  }

  await createSession('staff', donaId)
  await marcarBalcao('staff', true)
  redirect('/agenda')
}
