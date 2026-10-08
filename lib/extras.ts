import 'server-only'
import { sql } from '@/lib/db'

/**
 * OS EXTRAS DA VISITA (mockup «Extras na marcação · B»).
 *
 * Quem escolhe um serviço no funil pode ver, por cima da barra de
 * «Escolher hora», os serviços que a casa sugere com ele — a lista que
 * se monta na ficha de cada serviço, na Gestão.
 *
 * Isto só diz QUAIS. Se aparecem ou não decide-o o passo dos serviços,
 * com as regras da própria ementa: só o que a profissional escolhida
 * faz, o que se marca neste dia e o que ainda cabe no tempo que lhe
 * resta.
 *
 * Um extra nunca pode partir o passo dos serviços. Sem a tabela (antes
 * da migração) ou com um erro qualquer, não há sugestões e o funil fica
 * igual ao de hoje.
 */
export async function sugeridosPara(
  orgId: string,
  serviceIds: string[],
): Promise<string[]> {
  if (serviceIds.length === 0) return []
  try {
    const rows = await sql<{ suggested_id: string }[]>`
      select ss.suggested_id
        from service_suggestion ss
       where ss.org_id = ${orgId}
         and ss.service_id = any(${serviceIds}::uuid[])
       order by array_position(${serviceIds}::uuid[], ss.service_id), ss.sort_order
    `
    return [...new Set(rows.map((r) => r.suggested_id))]
  } catch (erro) {
    console.error('[extras]', erro)
    return []
  }
}
