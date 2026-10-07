import 'server-only'
import { sql } from '@/lib/db'
import { funnelHref } from '@/lib/cart'
import type { Unit } from '@/lib/org'
import { picksStaffOn } from '@/lib/sunday'
import { isoDay, today } from '@/lib/time'

/**
 * MARCAR NOVAMENTE.
 *
 * A cliente que já veio — ou que desmarcou — abre o link da marcação e
 * encontra um botão que refaz a mesma visita: os mesmos serviços, com a
 * mesma profissional, e ela só escolhe o dia e a hora.
 *
 * Isto não grava nada. Lê a marcação que já existe e monta um endereço
 * do funil já preenchido; a marcação nova nasce depois, pelo caminho de
 * sempre, com todas as verificações de sempre.
 *
 * O que se leva é só o que ainda se pode marcar online HOJE, com as
 * mesmas regras da ementa do funil: serviço activo, aberto ao online,
 * de uma categoria activa, e que alguém desta loja saiba fazer. O que já
 * não se pede assim fica de fora em silêncio — o funil não sabe tratar
 * um carrinho meio estragado, e manda a cliente de volta à ementa vazia.
 *
 * A profissional vai junto só quando foi uma só na visita inteira (o
 * funil escolhe uma pessoa por visita) e ainda serve: activa, nesta
 * loja, aberta ao online, e a saber fazer tudo o que vai no carrinho.
 * Sem ela o funil pergunta-a, como pergunta a qualquer cliente. Ao
 * domingo ninguém foi escolhido — o nome era arrumação do motor — e
 * por isso também não vai.
 */

type Visita = {
  org_id: string
  starts_at: Date
  unit_timezone: string
  items: { service_id: string; staff_id: string; staff_public_name: string }[]
}

export type MarcarDeNovo = {
  /** O passo das horas, já com os serviços (e a profissional). */
  href: string
  /** Os serviços que vão no carrinho, pela ordem da visita. */
  serviceIds: string[]
  /** O nome que se mostra com o botão, quando a profissional vai junto. */
  staffName: string | null
}

export async function marcarDeNovo(
  visita: Visita,
  unit: Unit,
): Promise<MarcarDeNovo | null> {
  /*
    Um atalho nunca pode partir a página que o mostra. Se alguma coisa
    aqui falhar, a cliente vê o botão de sempre («Fazer nova marcação»)
    e o erro fica nos registos.
  */
  try {
    return await montar(visita, unit)
  } catch (erro) {
    console.error('[marcar-de-novo]', erro)
    return null
  }
}

async function montar(visita: Visita, unit: Unit): Promise<MarcarDeNovo | null> {
  const servicos = [...new Set(visita.items.map((item) => item.service_id))]
  if (servicos.length === 0) return null

  const pedidos = await sql<{ id: string }[]>`
    select s.id
      from service s
      join service_category c on c.id = s.category_id and c.is_active
     where s.id = any(${servicos}::uuid[])
       and s.org_id = ${visita.org_id}
       and s.is_active and s.bookable_online
       and exists (
         select 1
           from staff_skill ss
           join staff st on st.id = ss.staff_id and st.is_active
           join staff_unit su on su.staff_id = st.id and su.unit_id = ${unit.id}
          where ss.service_id = s.id
            and st.accepts_online_booking
       )
  `
  const podem = new Set(pedidos.map((r) => r.id))
  // A ordem é a da visita: é a ordem em que ela os pediu.
  const levar = servicos.filter((id) => podem.has(id))
  if (levar.length === 0) return null

  const diaDaVisita = isoDay(visita.starts_at, visita.unit_timezone)
  const pessoas = [...new Set(visita.items.map((item) => item.staff_id))]
  let staffId: string | null = null
  let staffName: string | null = null

  if (picksStaffOn(diaDaVisita) && pessoas.length === 1) {
    const candidata = pessoas[0]!
    const serve = await sql<{ ok: boolean }[]>`
      select true as ok
        from staff st
        join staff_unit su on su.staff_id = st.id and su.unit_id = ${unit.id}
       where st.id = ${candidata}
         and st.org_id = ${visita.org_id}
         and st.is_active and st.accepts_online_booking
         and (
           select count(*) from staff_skill ss
            where ss.staff_id = st.id
              and ss.service_id = any(${levar}::uuid[])
         ) = ${levar.length}
    `
    if (serve.length > 0) {
      staffId = candidata
      staffName =
        visita.items.find((item) => item.staff_id === candidata)?.staff_public_name ?? null
    }
  }

  return {
    href: funnelHref(`/agendar/${unit.slug}/horarios`, {
      day: today(unit.timezone),
      cart: levar.map((serviceId) => ({ serviceId, staffId })),
      staffId,
    }),
    serviceIds: levar,
    staffName,
  }
}
