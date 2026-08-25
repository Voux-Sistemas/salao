import 'server-only'
import { cache } from 'react'
import { sql } from '@/lib/db'
import { requireMaster, type Actor } from '@/lib/auth/actor'

/**
 * A CASA FECHADA PARA OBRAS.
 *
 * Quem monta o sistema precisa de um momento em que ninguém lhe mexe
 * por baixo — sobretudo a meio de um deploy, quando o servidor troca de
 * versão e uma cliente pode estar a meio do funil de marcação.
 *
 * Fecha tudo: a montra, o funil, a área da cliente e o balcão. Só a
 * porta de entrada (`/entrar`) fica aberta, senão quem tem a chave
 * ficava fechado de fora com toda a gente.
 *
 * Quem é `master` atravessa. Não é uma excepção de conveniência: é a
 * única maneira de a pessoa que fechou a casa poder lá andar dentro
 * para fazer o que veio fazer — e de a poder voltar a abrir.
 */

export type Maintenance = {
  /** Nulo: a casa está aberta. */
  since: Date | null
  note: string | null
}

export const maintenance = cache(async (): Promise<Maintenance> => {
  const rows = await sql<{ maintenance_since: Date | null; maintenance_note: string | null }[]>`
    select maintenance_since, maintenance_note
      from org
     order by created_at
     limit 1
  `
  const row = rows[0]
  return {
    since: row?.maintenance_since ?? null,
    note: row?.maintenance_note ?? null,
  }
})

/**
 * A pergunta que os layouts fazem: mostro a casa, ou mostro a porta
 * fechada? Devolve o estado quando é para travar, e nulo quando é para
 * deixar passar — o `master` passa sempre.
 */
export async function closedFor(actor: Actor | null): Promise<Maintenance | null> {
  const state = await maintenance()
  if (state.since === null) return null
  if (actor?.role === 'master') return null
  return state
}

/** Fechar ou abrir. Só quem monta o sistema — e o portão é o do `master`. */
export async function setMaintenance(
  on: boolean,
  note: string | null,
): Promise<void> {
  await requireMaster()
  await sql`
    update org
       set maintenance_since = ${on ? sql`coalesce(maintenance_since, now())` : null},
           maintenance_note = ${on ? note : null}
     where id = (select id from org order by created_at limit 1)
  `
}

/** «há 12 minutos», «há 3 horas» — o suficiente para dar por si. */
export function howLong(since: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - since.getTime()) / 60000))
  if (minutes < 1) return 'agora mesmo'
  if (minutes === 1) return 'há 1 minuto'
  if (minutes < 60) return `há ${minutes} minutos`
  const hours = Math.round(minutes / 60)
  if (hours === 1) return 'há 1 hora'
  if (hours < 24) return `há ${hours} horas`
  const days = Math.round(hours / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}
