import { getUploadedImage } from '@/lib/imagens'
import { isUuid } from '@/lib/id'

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
  // Trinta e seis caracteres de «hex ou traco» nao e um UUID: trinta e
  // seis tracos passavam, e a base levantava erro onde esta rota ja
  // sabia responder 404.
  if (!isUuid(id)) {
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
