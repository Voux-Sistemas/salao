'use server'

import { normalisePhone } from '@/lib/env'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { getOrg } from '@/lib/org'
import { LIMITS, allowed, callerIp } from '@/lib/auth/throttle'
import { marcacoesPeloNome, type ResumoMarcacao } from '@/lib/minhas-marcacoes'

export type ProcurarState = {
  error: string | null
  marcacoes: ResumoMarcacao[] | null
}

/**
 * NOUTRO TELEMÓVEL: telemóvel + primeiro nome, sem código.
 *
 * A resposta é a mesma quando a ficha não existe e quando o nome não
 * bate — senão esta porta dizia a quem experimentasse que números têm
 * ficha na casa.
 *
 * O travão é por endereço e aproveita o balde de quem tenta entrar: vinte
 * tentativas por hora chegam a quem se engana a escrever, e não chegam
 * a quem quer adivinhar nomes.
 */
export async function procurarAction(
  _previous: ProcurarState,
  form: FormData,
): Promise<ProcurarState> {
  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  const phone = normalisePhone(String(form.get('phone') ?? ''))
  const nome = String(form.get('nome') ?? '').trim()
  if (!phone || !nome) {
    return { error: dict.remarcar.fillBoth, marcacoes: null }
  }

  const ip = await callerIp()
  if (!(await allowed('remarcar-ip', ip, LIMITS.issueCodeByIp))) {
    return { error: dict.errors.tooMany, marcacoes: null }
  }

  const org = await getOrg()
  if (!org) return { error: dict.errors.generic, marcacoes: null }

  const marcacoes = await marcacoesPeloNome(org.id, phone, nome, language)
  if (!marcacoes || marcacoes.length === 0) {
    return { error: dict.remarcar.notFound, marcacoes: null }
  }
  return { error: null, marcacoes }
}
