/**
 * Todo o dinheiro é inteiro, em cêntimos. Nunca vírgula flutuante, em
 * lado nenhum. Este ficheiro é o único sítio onde se converte.
 */

export type Cents = number

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
  es: 'es-ES',
}

/** 4250 -> "42,50 €" */
export function formatCents(
  cents: Cents,
  currency = 'EUR',
  language = 'pt',
): string {
  const locale = LOCALE_BY_LANGUAGE[language] ?? 'pt-PT'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/** 4250 -> "42,50" (sem símbolo; para campos de formulário) */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/**
 * "42,50" | "42.50" | "42" -> 4250
 * Devolve null se não for um número de dinheiro válido.
 */
export function inputToCents(input: string): Cents | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  const [whole = '0', frac = ''] = cleaned.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

/**
 * Reparte `total` por `weights` proporcionalmente, SEM PERDER CÊNTIMOS.
 *
 * Método do maior resto: dá a cada parte a divisão inteira, depois
 * distribui os cêntimos que sobram pelas partes com maior resto. A soma
 * do resultado é exactamente `total` — é isto que impede o desconto de
 * evaporar um cêntimo ao ser rateado pelos itens da comanda.
 *
 * Empates resolvem-se pelo índice (estável e reproduzível).
 */
export function distributeProportionally(
  total: Cents,
  weights: readonly number[],
): Cents[] {
  if (weights.length === 0) return []
  const sum = weights.reduce((a, b) => a + b, 0)

  if (sum <= 0) {
    // Sem base para ratear: reparte igualmente.
    const base = Math.floor(total / weights.length)
    const shares = weights.map(() => base)
    let leftover = total - base * weights.length
    for (let i = 0; leftover > 0; i = (i + 1) % weights.length, leftover--) {
      shares[i] = (shares[i] ?? 0) + 1
    }
    return shares
  }

  const exact = weights.map((w) => (total * w) / sum)
  const floors = exact.map((v) => Math.floor(v))
  let leftover = total - floors.reduce((a, b) => a + b, 0)

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (const { index } of order) {
    if (leftover <= 0) break
    floors[index] = (floors[index] ?? 0) + 1
    leftover--
  }

  return floors
}
