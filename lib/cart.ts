import type { CartLine } from '@/lib/availability'

/**
 * O carrinho do funil vive na barra de endereço, não em sessão.
 *
 * É isso que faz o "voltar" funcionar, que deixa partilhar a ligação e
 * que permite trocar de língua a meio sem perder o que já foi escolhido.
 *
 * Formato: `servico~profissional,servico~profissional` — a profissional
 * é opcional (vazio = sem preferência).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Uma visita não é uma lista de compras. Seis serviços já é generoso. */
export const MAX_CART_LINES = 6

export const CART_PARAM = 'c'
export const DAY_PARAM = 'd'
export const TIME_PARAM = 't'

/**
 * A profissional da visita, escolhida no passo dela.
 *
 * Vive à parte do carrinho de propósito: é escolhida ANTES dos
 * serviços, e um carrinho vazio não tem onde a guardar. Quando os
 * serviços entram, cada linha leva-a também — é o `staffId` de sempre,
 * que o motor já sabe respeitar — mas o parâmetro fica, porque é ele
 * que sobrevive a tirar o último serviço da visita.
 */
export const STAFF_PARAM = 'p'

export function parseCart(value: string | string[] | undefined): CartLine[] {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return []

  const lines: CartLine[] = []
  for (const entry of raw.split(',')) {
    if (!entry) continue
    const [serviceId = '', staffId = ''] = entry.split('~')
    if (!UUID.test(serviceId)) continue
    lines.push({
      serviceId,
      staffId: UUID.test(staffId) ? staffId : null,
    })
    if (lines.length >= MAX_CART_LINES) break
  }
  return lines
}

export function cartToParam(cart: CartLine[]): string {
  return cart
    .map((line) => (line.staffId ? `${line.serviceId}~${line.staffId}` : line.serviceId))
    .join(',')
}

export function addLine(cart: CartLine[], serviceId: string): CartLine[] {
  if (cart.length >= MAX_CART_LINES) return cart
  return [...cart, { serviceId, staffId: null }]
}

export function removeAt(cart: CartLine[], index: number): CartLine[] {
  return cart.filter((_, i) => i !== index)
}

export function setStaffAt(
  cart: CartLine[],
  index: number,
  staffId: string | null,
): CartLine[] {
  return cart.map((line, i) => (i === index ? { ...line, staffId } : line))
}

export function hasService(cart: CartLine[], serviceId: string): boolean {
  return cart.some((line) => line.serviceId === serviceId)
}

/** Monta um endereço do funil mantendo o que já foi escolhido. */
export function funnelHref(
  path: string,
  params: {
    cart?: CartLine[]
    day?: string | null
    staffId?: string | null
    time?: string | null
  },
): string {
  const search = new URLSearchParams()
  if (params.cart && params.cart.length > 0) {
    search.set(CART_PARAM, cartToParam(params.cart))
  }
  if (params.day) search.set(DAY_PARAM, params.day)
  if (params.staffId) search.set(STAFF_PARAM, params.staffId)
  if (params.time) search.set(TIME_PARAM, params.time)
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

/** Lê um parâmetro que pode vir repetido — ficamos com o primeiro. */
export function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && raw.length > 0 ? raw : null
}

/** Lê a profissional do endereço. Só um UUID passa. */
export function parseStaff(value: string | string[] | undefined): string | null {
  const raw = first(value)
  return raw && UUID.test(raw) ? raw : null
}
