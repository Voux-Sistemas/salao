'use server'

import { revalidatePath } from 'next/cache'
import { canSeeUnit, requireManagement } from '@/lib/auth/actor'
import { addMovement, closeCash, openCash } from '@/lib/cash'
import { inputToCents } from '@/lib/money'
import { getUnitBySlug } from '@/lib/org'
import { today } from '@/lib/time'

export type CashState = { error: string | null; done?: string | null }

const NOT_FOUND: CashState = { error: 'Essa loja não existe.' }

async function reach(slug: string) {
  const actor = await requireManagement()
  const unit = await getUnitBySlug(slug)
  if (!unit || unit.org_id !== actor.orgId || !canSeeUnit(actor, unit.id)) {
    return null
  }
  return { actor, unit }
}

/** A caixa abre-se com o que já está na gaveta. */
export async function openCashAction(
  _previous: CashState,
  form: FormData,
): Promise<CashState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return NOT_FOUND

  const cents = inputToCents(String(form.get('amount') ?? ''))
  if (cents === null) return { error: 'Valor inválido.' }

  const result = await openCash({
    unitId: found.unit.id,
    businessDate: today(found.unit.timezone),
    openingCents: cents,
    byStaffId: found.actor.id,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'already_open'
          ? 'Já há uma caixa aberta nesta loja.'
          : result.reason === 'day_closed'
            ? 'A caixa de hoje já foi fechada. Amanhã abre-se outra.'
            : 'Não foi possível abrir a caixa.',
    }
  }

  revalidatePath(`/caixa/${found.unit.slug}`)
  return { error: null, done: 'Caixa aberta.' }
}

/** Reforço e sangria são à mão. As vendas entram sozinhas. */
export async function movementAction(
  _previous: CashState,
  form: FormData,
): Promise<CashState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return NOT_FOUND

  const kind = String(form.get('kind') ?? '')
  if (kind !== 'reinforcement' && kind !== 'withdrawal') {
    return { error: 'Movimento desconhecido.' }
  }

  const cents = inputToCents(String(form.get('amount') ?? ''))
  if (cents === null || cents <= 0) return { error: 'Valor inválido.' }

  const note = String(form.get('note') ?? '').trim()
  if (kind === 'withdrawal' && !note) {
    return { error: 'Uma sangria leva sempre motivo.' }
  }

  const result = await addMovement({
    unitId: found.unit.id,
    kind,
    cents,
    note: note || null,
    byStaffId: found.actor.id,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'not_found'
          ? 'A caixa desta loja está fechada.'
          : 'Valor inválido.',
    }
  }

  revalidatePath(`/caixa/${found.unit.slug}`)
  return {
    error: null,
    done: kind === 'withdrawal' ? 'Sangria registada.' : 'Reforço registado.',
  }
}

/** Fechar é contar a gaveta — e a diferença fica escrita. */
export async function closeCashAction(
  _previous: CashState,
  form: FormData,
): Promise<CashState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return NOT_FOUND

  const cents = inputToCents(String(form.get('counted') ?? ''))
  if (cents === null) return { error: 'Valor inválido.' }

  const result = await closeCash({
    unitId: found.unit.id,
    countedCents: cents,
    note: String(form.get('note') ?? '').trim() || null,
    byStaffId: found.actor.id,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'not_found'
          ? 'Não há caixa aberta nesta loja.'
          : 'Valor inválido.',
    }
  }

  revalidatePath(`/caixa/${found.unit.slug}`)
  revalidatePath('/')
  return { error: null, done: 'Caixa fechada.' }
}
