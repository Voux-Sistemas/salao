import nohora from '@/instalacoes/nohora/marca'
import demo from '@/instalacoes/demo/marca'

/**
 * O NOME DA CASA VIVE NA BASE DE DADOS (org.name, unit.name) — é lá que
 * se muda. Aqui ficam só as coisas que a base de dados não guarda: o que
 * aparece antes de haver rede criada, e o texto de marca do site.
 *
 * Cada instalação tem a sua, em `instalacoes/<id>/marca.ts`, ao lado do
 * logótipo, das fotografias e do cartão do link dela (ver
 * `scripts/instalacao.mjs`). A escolha é da NEXT_PUBLIC_INSTALACAO; sem
 * ela, é a Nohora.
 */
export type Marca = {
  /** Usado enquanto o /comecar ainda não criou a rede. */
  fallbackName: string
  fallbackTagline: string

  /** Assinatura no rodapé e no título das páginas públicas. */
  legalName: string

  /** As iniciais do monograma (o logótipo é a autoridade). */
  monogram: string

  social: {
    instagram: string
    facebook: string
  }

  /** Endereço curto do cartaz e da bio do Instagram. */
  shortBookingPath: string

  /**
   * As famílias do catálogo que têm fotografia em public/fotos/familias.
   *
   * Escrito à mão de propósito: o servidor não vai ao disco perguntar se
   * o ficheiro existe a cada pedido, e uma família sem fotografia mostra
   * o disco de ouro com a inicial em vez de uma imagem partida. Quando
   * chegar a oitava família, acrescenta-se aqui o nome do ficheiro.
   */
  familyPhotos: readonly string[]

  /**
   * As marcas de produto da fita da montra («Com que trabalhamos»).
   *
   * Saem do preçário da casa, não de uma lista de marcas bonitas: a fita
   * é prova, não enfeite. Vazia, a secção não aparece — uma casa que não
   * disse com que trabalha não mostra fita nenhuma.
   */
  productBrands: readonly string[]

  /**
   * Se a montra entra nos motores de busca. Uma casa a sério quer ser
   * encontrada; a de demonstração não — é um salão que não existe, com
   * moradas inventadas, e não pode aparecer a quem procura um de verdade.
   * Sem índice, todas as páginas levam `noindex` e o mapa do sítio sai
   * vazio.
   */
  indexar: boolean
}

const INSTALACOES: Record<string, Marca> = { nohora, demo }

const id = process.env.NEXT_PUBLIC_INSTALACAO || 'nohora'
const marca = INSTALACOES[id]

// Uma pasta nova em `instalacoes/` que não se registou aqui em cima.
// Rebenta o build — antes isso do que uma montra com a marca de outra.
if (!marca) {
  throw new Error(`A instalação "${id}" não está registada em lib/branding.ts.`)
}

export const BRAND: Marca = marca
