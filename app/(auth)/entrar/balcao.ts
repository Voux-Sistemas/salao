'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOrg } from '@/lib/org'
import { burnTime } from '@/lib/auth/password'
import { createSession, marcarBalcao } from '@/lib/auth/session'
import { lerCodigo, quemAbreComCodigo } from '@/lib/balcao'

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

  /*
    DOIS ERROS DIFERENTES, DUAS FRASES DIFERENTES.

    Diziam ambos «esse código não abre nada» — e quando isto falhou no
    salão, a frase não dizia se o código estava errado, se nunca tinha
    sido criado, ou se a casa não tinha dona para abrir. Quem está ao
    balcão não sabe o que fazer a seguir com nenhuma delas.

    O que se protege é o código: esse continua a responder o mesmo,
    demore o que demorar. O resto pode ser dito por palavras.
  */
  if (!donaId) {
    await burnTime()
    const { codigo: existe } = await lerCodigo(org.id)
    return {
      error: existe
        ? 'Esse código não está certo. Confirme os seis algarismos.'
        : 'Ainda não há código do balcão. A dona cria-o em Gestão · Balcão.',
    }
  }

  await createSession('staff', donaId)
  await marcarBalcao('staff', true)
  // Aqui a sessão é nova e a árvore viria limpa de qualquer maneira; fica
  // pela mesma razão que nas outras — quem lê isto não tem de descobrir
  // qual das quatro é a excepção.
  revalidatePath('/', 'layout')
  redirect('/agenda')
}
