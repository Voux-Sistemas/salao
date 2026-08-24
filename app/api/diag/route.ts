// DIAGNÓSTICO TEMPORÁRIO — apagar depois de medido.
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CHAVE = 'nr-2026-diag'

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('k') !== CHAVE) {
    return new Response('não', { status: 404 })
  }

  const marcas: Record<string, unknown> = {}

  const t0 = Date.now()
  await sql`select 1`
  marcas.primeira_consulta_ms = Date.now() - t0

  const voltas: number[] = []
  for (let i = 0; i < 5; i++) {
    const t = Date.now()
    await sql`select 1`
    voltas.push(Date.now() - t)
  }
  voltas.sort((a, b) => a - b)
  marcas.ida_e_volta_ms = { min: voltas[0], mediana: voltas[2], max: voltas[4] }

  const t2 = Date.now()
  await sql`select count(*) from service`
  marcas.consulta_real_ms = Date.now() - t2

  return Response.json({
    regiao_da_funcao:
      process.env.AWS_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      process.env.NETLIFY_REGION ??
      '(desconhecida)',
    base_de_dados: /@([^/:]+)/.exec(process.env.DATABASE_URL ?? '')?.[1] ?? '?',
    porta: /:(\d+)\//.exec(process.env.DATABASE_URL ?? '')?.[1] ?? '?',
    marcas,
  })
}
