import 'server-only'
import { randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'
import { findByPhone } from '@/lib/clients'
import type { Language } from '@/lib/i18n/config'
import {
  formatDayShort,
  formatTime,
  formatWeekdayShort,
  isoDay,
} from '@/lib/time'

/**
 * AS MARCAÇÕES QUE A CLIENTE AINDA TEM PELA FRENTE — SEM CÓDIGO.
 *
 * O código de uso único não tinha canal nenhum: o sistema gerava-o e
 * deixava-o nos Avisos à espera de alguém do salão. Ninguém o mandava,
 * e a cliente que queria mudar o dia ficava presa. A dona decidiu: nada
 * de códigos, e nada de mandar a cliente falar com o salão.
 *
 * Por isso há duas maneiras de chegar às marcações, e nenhuma pede nada
 * que ela não tenha:
 *
 *   NO MESMO TELEMÓVEL, pelas chaves que o próprio navegador guardou no
 *   recibo de cada marcação. Ela não escreve nada.
 *
 *   NOUTRO TELEMÓVEL, pelo telemóvel e pelo primeiro nome com que marcou.
 *   É um preço que a dona aceitou de olhos abertos: quem souber os dois
 *   dados de uma cliente vê e desmarca as marcações dela — o mesmo nível
 *   de um salão que desmarca ao telefone a quem disser o nome. O travão
 *   de pedidos por endereço impede que alguém os experimente às cegas.
 */

export type ResumoMarcacao = {
  chave: string
  /** «Qua 16/09 · 18:45» */
  quando: string
  loja: string
  servicos: string
}

type Linha = {
  id: string
  manage_token: string | null
  starts_at: Date
  timezone: string
  loja: string
  servicos: string | null
}

/* As chaves são 18 bytes em base64url — vinte e quatro caracteres. O que
   não tiver esta forma não é uma chave, e nem chega à base. */
const FORMA_DA_CHAVE = /^[A-Za-z0-9_-]{24}$/

export function chavesValidas(lista: readonly string[]): string[] {
  return [...new Set(lista.filter((c) => FORMA_DA_CHAVE.test(c)))].slice(0, 20)
}

function resumir(linhas: Linha[], language: Language): ResumoMarcacao[] {
  return linhas
    .filter((l): l is Linha & { manage_token: string } => l.manage_token !== null)
    .map((l) => {
      const dia = isoDay(l.starts_at, l.timezone)
      const semana = formatWeekdayShort(dia, l.timezone, language).replace('.', '')
      return {
        chave: l.manage_token,
        quando: `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${formatDayShort(dia, l.timezone, language)} · ${formatTime(l.starts_at, l.timezone, language)}`,
        loja: l.loja,
        servicos: l.servicos ?? '',
      }
    })
}

/** No mesmo telemóvel: as chaves que o navegador guardou. */
export async function marcacoesPelasChaves(
  chaves: readonly string[],
  language: Language,
): Promise<ResumoMarcacao[]> {
  const validas = chavesValidas(chaves)
  if (validas.length === 0) return []

  const linhas = await sql<Linha[]>`
    select a.id, a.manage_token, a.starts_at, u.timezone, u.name as loja,
           (select string_agg(i.service_name, ' + ' order by i.sort_order)
              from appointment_item i where i.appointment_id = a.id) as servicos
      from appointment a
      join unit u on u.id = a.unit_id
     where a.manage_token = any(${validas}::text[])
       and a.status in ('booked', 'confirmed')
       and a.starts_at > now()
     order by a.starts_at
  `
  return resumir(linhas, language)
}

/**
 * Noutro telemóvel: telemóvel + primeiro nome.
 *
 * O nome compara-se sem maiúsculas nem acentos, e só a primeira palavra:
 * a ficha pode ter nascido «CATIA SOFIA» ao balcão e ela escreve «Cátia».
 *
 * As marcações antigas nasceram antes de haver chave. Em vez de pedir um
 * SQL à parte, a chave dá-se aqui, no momento em que a própria cliente
 * as vem buscar — é a única altura em que fazem falta.
 */
export async function marcacoesPeloNome(
  orgId: string,
  phone: string,
  nome: string,
  language: Language,
): Promise<ResumoMarcacao[] | null> {
  const escrito = primeiroNome(nome)
  if (!escrito) return null
  const ficha = await findByPhone(orgId, phone)
  if (!ficha || primeiroNome(ficha.name) !== escrito) return null

  // Uma de cada vez, porque cada uma leva a sua chave; o ciclo acaba quando
  // já não houver nenhuma sem chave. Numa ficha normal são zero ou uma.
  for (let i = 0; i < 20; i++) {
    const semChave = await sql<{ id: string }[]>`
      select id from appointment
       where client_id = ${ficha.id}
         and manage_token is null
         and status in ('booked', 'confirmed')
         and starts_at > now()
       limit 1
    `
    const alvo = semChave[0]
    if (!alvo) break
    await sql`
      update appointment
         set manage_token = ${randomBytes(18).toString('base64url')}
       where id = ${alvo.id} and manage_token is null
    `
  }

  const linhas = await sql<Linha[]>`
    select a.id, a.manage_token, a.starts_at, u.timezone, u.name as loja,
           (select string_agg(i.service_name, ' + ' order by i.sort_order)
              from appointment_item i where i.appointment_id = a.id) as servicos
      from appointment a
      join unit u on u.id = a.unit_id
     where a.client_id = ${ficha.id}
       and a.status in ('booked', 'confirmed')
       and a.starts_at > now()
     order by a.starts_at
  `
  return resumir(linhas, language)
}

function primeiroNome(nome: string): string {
  return (
    nome
      .trim()
      .split(/\s+/)[0]
      ?.normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase() ?? ''
  )
}
