import type { MetadataRoute } from 'next'
import { listUnits } from '@/lib/org'
import { env } from '@/lib/env'

/*
 * O MAPA DA MONTRA
 *
 * Só entra aqui o que é público e estável: a entrada, a lista de lojas,
 * o começo da marcação, e depois cada loja com o seu par de endereços —
 * a página da casa e o primeiro passo de quem já decidiu marcar.
 *
 * Lê a base de dados, por isso não pré-renderiza: uma loja nova tem de
 * aparecer no mapa sem ninguém reconstruir o sítio.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, '')

  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/agendar`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/loja`, changeFrequency: 'monthly', priority: 0.8 },
  ]

  /*
   * Se a base de dados não responder, o mapa sai só com as fixas em vez
   * de devolver erro. Um sitemap incompleto é um contratempo; um 500
   * neste endereço faz o robô desconfiar do sítio inteiro.
   */
  let units: Awaited<ReturnType<typeof listUnits>> = []
  try {
    units = await listUnits()
  } catch {
    return fixed
  }

  return [
    ...fixed,
    ...units.flatMap((unit) => [
      {
        url: `${base}/loja/${unit.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      },
      {
        url: `${base}/agendar/${unit.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      },
    ]),
  ]
}
