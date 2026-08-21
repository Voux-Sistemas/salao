/**
 * Aritmética de intervalos [início, fim) em milissegundos.
 * Meio-aberto de propósito: dois blocos que se tocam (um acaba às 10:00,
 * o outro começa às 10:00) NÃO se sobrepõem — é assim que a agenda
 * encosta serviços sem falso conflito, e é assim que o `tstzrange` da
 * base de dados também se comporta.
 */

export type Interval = { start: number; end: number }

export const interval = (start: number, end: number): Interval => ({ start, end })

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end
}

export function overlapsAny(a: Interval, list: readonly Interval[]): boolean {
  for (const b of list) if (overlaps(a, b)) return true
  return false
}

export function containedInAny(
  inner: Interval,
  list: readonly Interval[],
): boolean {
  for (const outer of list) if (contains(outer, inner)) return true
  return false
}

/** Junta intervalos que se tocam ou sobrepõem, por ordem. */
export function merge(list: readonly Interval[]): Interval[] {
  if (list.length === 0) return []
  const sorted = [...list].sort((a, b) => a.start - b.start)
  const out: Interval[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!
    const last = out[out.length - 1]!
    if (next.start <= last.end) {
      last.end = Math.max(last.end, next.end)
    } else {
      out.push({ ...next })
    }
  }
  return out
}

/** `base` menos `holes`. Usado para tirar as ausências da escala. */
export function subtract(
  base: readonly Interval[],
  holes: readonly Interval[],
): Interval[] {
  if (holes.length === 0) return base.map((i) => ({ ...i }))
  const cuts = merge(holes)
  let out = base.map((i) => ({ ...i }))

  for (const hole of cuts) {
    const next: Interval[] = []
    for (const piece of out) {
      if (!overlaps(piece, hole)) {
        next.push(piece)
        continue
      }
      if (piece.start < hole.start) next.push({ start: piece.start, end: hole.start })
      if (hole.end < piece.end) next.push({ start: hole.end, end: piece.end })
    }
    out = next
  }
  return out
}

export function totalMinutes(list: readonly Interval[]): number {
  return list.reduce((sum, i) => sum + (i.end - i.start), 0) / 60_000
}
