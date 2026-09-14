/**
 * As iniciais de uma pessoa, para o círculo que fica no lugar do retrato.
 *
 * «Profissional 01» dá P1; «Ana Ribeiro» dá AR.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  const firstLetter = parts[0]!.charAt(0)
  const last = parts[parts.length - 1]!
  // Um número no fim («01») vale mais do que a letra: é o que distingue
  // uma «Profissional» da outra.
  const tail = /^\d+$/.test(last) ? String(Number(last)) : last.charAt(0)
  return (firstLetter + tail).toUpperCase()
}
