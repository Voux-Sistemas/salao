'use server'

import { revalidatePath } from 'next/cache'
import { requireOrgScope } from '@/lib/auth/actor'
import { payCommissions, removeRule, saveRule } from '@/lib/commissions'
import { formatCents } from '@/lib/money'

export type RuleState = { error: string | null; done?: string | null }

/**
 * Uma regra é uma percentagem e um alcance. Gravar a mesma combinação
 * outra vez muda a percentagem — não cria uma segunda regra a discutir
 * com a primeira.
 */
export async function saveRuleAction(
  _previous: RuleState,
  form: FormData,
): Promise<RuleState> {
  const actor = await requireOrgScope()

  const staffId = String(form.get('staff') ?? '').trim() || null
  const serviceId = String(form.get('service') ?? '').trim() || null

  const raw = String(form.get('percent') ?? '')
    .trim()
    .replace(',', '.')
  const percent = Number(raw)
  if (raw === '' || !Number.isFinite(percent)) {
    return { error: 'Escreva a percentagem.' }
  }
  if (percent < 0 || percent > 100) {
    return { error: 'A percentagem vai de 0 a 100.' }
  }

  const result = await saveRule(actor.orgId, { staffId, serviceId, percent })
  if (!result.ok) return { error: 'Percentagem inválida.' }

  revalidatePath('/admin/comissoes')
  return { error: null, done: 'Regra guardada.' }
}

/**
 * Apagar a regra não mexe em comissão nenhuma já gerada: essa levou a
 * percentagem congelada consigo. Só muda o que vier a seguir.
 */
export async function removeRuleAction(form: FormData): Promise<void> {
  const actor = await requireOrgScope()
  const id = String(form.get('id') ?? '')
  if (id) await removeRule(actor.orgId, id)
  revalidatePath('/admin/comissoes')
}

export type PayState = { error: string | null; done?: string | null }

/**
 * Pagar em lote, com duas travas: o botão só aparece depois de armado,
 * e o servidor volta a somar antes de gravar. Se entretanto fechou
 * outra comanda, não se paga — mostra-se a conta nova.
 */
export async function payAction(
  _previous: PayState,
  form: FormData,
): Promise<PayState> {
  const actor = await requireOrgScope()

  const staffId = String(form.get('staff') ?? '')
  if (!staffId) return { error: 'Escolha o colaborador.' }

  const expectedCents = Number(form.get('total') ?? NaN)
  const expectedEntries = Number(form.get('entries') ?? NaN)
  if (!Number.isInteger(expectedCents) || !Number.isInteger(expectedEntries)) {
    return { error: 'Recarregue a página e tente outra vez.' }
  }

  const result = await payCommissions({
    orgId: actor.orgId,
    staffId,
    expectedCents,
    expectedEntries,
    note: String(form.get('note') ?? '').trim() || null,
    byStaffId: actor.id,
  })

  if (!result.ok) {
    if (result.reason === 'nothing') {
      revalidatePath('/admin/comissoes')
      return { error: 'Já não há nada por pagar a este colaborador.' }
    }
    revalidatePath('/admin/comissoes')
    return {
      error: `A conta mudou entretanto: são agora ${result.entries} linha${
        result.entries === 1 ? '' : 's'
      }, ${formatCents(result.totalCents ?? 0)}. Confira e pague de novo.`,
    }
  }

  revalidatePath('/admin/comissoes')
  revalidatePath('/admin')
  return {
    error: null,
    done: `Pago ${formatCents(result.totalCents)} — ${result.entries} linha${
      result.entries === 1 ? '' : 's'
    }.`,
  }
}
