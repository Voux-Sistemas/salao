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
