import { getUploadedImage } from '@/lib/imagens'

/**
 * A FOTOGRAFIA CARREGADA, SERVIDA DE VOLTA.
 *
 * O `service.image_url` guarda `/imagens/<id>`; isto vai buscar os
 * bytes à base de dados e entrega-os como qualquer imagem. O conteúdo
 * de um id nunca muda — trocar a fotografia cria um id novo — por isso
 * o navegador pode guardá-la para sempre.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response('Não há nada aqui.', { status: 404 })
  }

  const image = await getUploadedImage(id)
  if (!image) return new Response('Não há nada aqui.', { status: 404 })

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      'Content-Type': image.mime,
      'Content-Length': String(image.bytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
