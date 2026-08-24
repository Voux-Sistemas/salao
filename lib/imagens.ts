import 'server-only'
import { sql } from '@/lib/db'

/**
 * FOTOGRAFIAS CARREGADAS DO TELEMÓVEL.
 *
 * O ficheiro vive na base de dados (tabela `uploaded_image`) e serve-se
 * por `/imagens/<id>` — ver `app/imagens/[id]/route.ts`. O que as
 * outras tabelas guardam é sempre o endereço, nunca o ficheiro.
 */

/** O que o navegador de qualquer telemóvel sabe mostrar. */
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** O tecto do check na tabela. O formulário encolhe muito antes disto. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export async function saveUploadedImage(
  orgId: string,
  file: File,
): Promise<{ url: string } | { error: 'type' | 'size' | 'empty' }> {
  if (file.size === 0) return { error: 'empty' }
  if (!MIMES.has(file.type)) return { error: 'type' }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'size' }

  const bytes = Buffer.from(await file.arrayBuffer())
  const rows = await sql<{ id: string }[]>`
    insert into uploaded_image (org_id, mime, bytes, byte_size)
    values (${orgId}, ${file.type}, ${bytes}, ${bytes.length})
    returning id
  `
  const row = rows[0]
  if (!row) return { error: 'empty' }
  return { url: `/imagens/${row.id}` }
}

export async function getUploadedImage(
  id: string,
): Promise<{ mime: string; bytes: Buffer } | null> {
  const rows = await sql<{ mime: string; bytes: Buffer }[]>`
    select mime, bytes from uploaded_image where id = ${id}
  `
  return rows[0] ?? null
}

/**
 * Apaga uma imagem carregada que deixou de ser usada — chamada quando um
 * serviço troca ou tira a fotografia. Só apaga se mais nenhum serviço a
 * apontar; um endereço que não é `/imagens/…` não é nosso e fica quieto.
 */
export async function dropUploadedImageIfOrphan(url: string | null): Promise<void> {
  const id = idFromUrl(url)
  if (!id) return
  await sql`
    delete from uploaded_image i
     where i.id = ${id}
       and not exists (
         select 1 from service s where s.image_url = ${url}
       )
  `
}

const IMAGE_PATH = /^\/imagens\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function idFromUrl(url: string | null | undefined): string | null {
  const match = IMAGE_PATH.exec(url ?? '')
  return match?.[1] ?? null
}
