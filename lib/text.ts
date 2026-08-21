/** Combinantes que sobram depois de separar o acento da letra. */
const DIACRITICS = /[̀-ͯ]/g

/** Um endereço legível a partir de um nome próprio. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** A primeira letra, para os avatares sem fotografia. */
export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

/** "Ana Sofia Marques" -> "Ana M." */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  const firstPart = parts[0] ?? ''
  if (parts.length === 1) return firstPart
  const last = parts[parts.length - 1] ?? ''
  return `${firstPart} ${last.charAt(0)}.`
}
