// DIAGNÓSTICO TEMPORÁRIO — apagar depois de medido.
import { sql } from '@/lib/db'
import { getOrg, listUnits } from '@/lib/org'
import { getActor } from '@/lib/auth/actor'
import { openingWindows, weeklyHours } from '@/lib/hours'
import { today } from '@/lib/time'

export const dynamic = 'force-dynamic'
const CHAVE = 'nr-2026-diag'

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get('k') !== CHAVE) {
    return new Response('não', { status: 404 })
  }

  const passos: Record<string, number> = {}
  async function medir<T>(nome: string, f: () => Promise<T>): Promise<T> {
    const t = Date.now()
    const r = await f()
    passos[nome] = Date.now() - t
    return r
  }

  const total0 = Date.now()

  await medir('01_ligacao_e_1a_consulta', () => sql`select 1`)
  const voltas: number[] = []
  for (let i = 0; i < 3; i++) {
    const t = Date.now()
    await sql`select 1`
    voltas.push(Date.now() - t)
  }
  passos['02_ida_e_volta_vazia'] = Math.min(...voltas)

  const org = (await medir('03_getOrg', () => getOrg()))!
  await medir('04_getActor_sem_sessao', () => getActor())
  const units = await medir('05_listUnits', () => listUnits())

  await medir('06_montra_paralelo_4', () =>
    Promise.all([
      sql`select c.id, s.id, s.name from service s
            join service_category c on c.id = s.category_id and c.is_active
           where s.org_id = ${org.id} and s.is_active and s.bookable_online
           order by c.sort_order, c.name, s.sort_order, s.name`,
      sql`select distinct s.id, coalesce(s.public_alias, s.name) as name
            from staff s where s.org_id = ${org.id} and s.is_active
           order by s.sort_order, coalesce(s.public_alias, s.name)`,
      sql`select p.id, p.unit_id, p.url from unit_photo p
            join unit u on u.id = p.unit_id and u.is_active
           order by u.sort_order, u.name, p.sort_order`,
    ]),
  )

  await medir('07_openingWindows_por_loja', () =>
    Promise.all(units.map((u) => openingWindows(u.id, today(u.timezone)))),
  )
  await medir('08_weeklyHours_rodape', () =>
    Promise.all(units.map((u) => weeklyHours(u.id))),
  )

  passos['09_TOTAL'] = Date.now() - total0

  return Response.json({
    regiao_da_funcao: process.env.AWS_REGION ?? '(desconhecida)',
    base: /@([^/:]+)/.exec(process.env.DATABASE_URL ?? '')?.[1] ?? '?',
    lojas: units.length,
    passos,
  })
}
