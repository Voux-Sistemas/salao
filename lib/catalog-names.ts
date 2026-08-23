import 'server-only'
import { sql } from '@/lib/db'
import type { Language } from '@/lib/i18n/config'

/**
 * O NOME DO SERVIÇO PARA A CLIENTE, NA LÍNGUA DELA.
 *
 * Há dois nomes para o mesmo serviço e é de propósito.
 *
 * O nome da CASA — o que está em `service.name` e o que ficou congelado
 * em `appointment_item.service_name` no momento da marcação — é sempre
 * português. É esse que aparece na agenda, na comanda, na caixa e nos
 * relatórios, e é esse que continua a aparecer daqui a um ano quando o
 * preçário já mudou de nome. Traduzir a comanda de uma cliente
 * espanhola era pôr o balcão a ler uma língua que não fala.
 *
 * O nome PARA FORA é este: sai da tradução da ficha do serviço e muda
 * com o cookie da língua. Não se guarda em lado nenhum — pede-se de
 * cada vez que se escreve um ecrã que a cliente vai ler.
 *
 * Quando não há tradução, ou quando o serviço desapareceu do catálogo,
 * cai-se no nome congelado. Nunca fica um espaço em branco.
 */
export async function serviceNamesFor(
  serviceIds: readonly string[],
  language: Language,
): Promise<Map<string, string>> {
  const ids = [...new Set(serviceIds)]
  if (ids.length === 0) return new Map()

  // Em português não há nada a fazer: o nome da casa já é o nome de
  // fora, e a ida à base seria uma consulta a pedir o que já se tem.
  if (language === 'pt') return new Map()

  const rows = await sql<{ id: string; name: string }[]>`
    select id, name_in(${language}, name, name_en, name_es) as name
      from service
     where id = any(${ids}::uuid[])
  `
  return new Map(rows.map((row) => [row.id, row.name]))
}
