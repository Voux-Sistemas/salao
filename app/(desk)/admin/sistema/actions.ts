'use server'

import { revalidatePath } from 'next/cache'
import { setMaintenance } from '@/lib/maintenance'

export type SystemState = { error: string | null; done?: string | null }

/**
 * Fechar e abrir a casa. O portão é o `requireMaster` lá dentro do
 * `setMaintenance` — aqui não se decide nada sobre quem pode.
 *
 * Revalida a raiz inteira porque isto muda o que TODA a gente vê, em
 * todas as páginas: a montra, o funil, a área da cliente e o balcão.
 */
export async function setMaintenanceAction(
  _previous: SystemState,
  form: FormData,
): Promise<SystemState> {
  const on = String(form.get('on') ?? '') === '1'
  const note = String(form.get('note') ?? '').trim() || null

  await setMaintenance(on, note)
  revalidatePath('/', 'layout')

  return {
    error: null,
    done: on ? 'A casa está fechada ao público.' : 'A casa está aberta.',
  }
}
