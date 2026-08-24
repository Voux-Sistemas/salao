/**
 * O TELEFONE, ESCRITO COMO SE ESCREVE EM PORTUGAL.
 *
 * Guardamos sempre E.164 — «+351912345678» — porque é o telefone que
 * identifica a cliente e tem de comparar-se dígito a dígito. Mas ninguém
 * escreve assim nem lê assim: em Portugal um número diz-se de três em
 * três, «912 345 678», e é isso que tem de aparecer no campo enquanto se
 * escreve. A máscara é só a camada de cima; o que vai no formulário
 * volta a passar pelo `normalisePhone` do lado do servidor, que deita
 * fora tudo o que não seja dígito. Espaços a mais aqui não fazem mal
 * nenhum lá.
 *
 * A casa recebe estrangeiras — o site fala três línguas — por isso a
 * máscara não obriga a Portugal: assume-o quando ninguém diz outra
 * coisa, e sai da frente mal se escreva um «+» ou um «00».
 */

/**
 * Indicativos que aparecem de facto na agenda deste salão: Portugal e os
 * países de onde vêm as clientes. A ordem é lei — testa-se do mais longo
 * para o mais curto, senão o «1» dos Estados Unidos comia o «1» final do
 * «351» e todos os números portugueses passavam a americanos.
 */
export const DIAL_CODES = [
  '351', '352', '353', '212', '238', '239', '244', '245', '258', '291',
  '31', '32', '33', '34', '39', '41', '43', '44', '49', '55',
  '1',
]

/** O indicativo de casa. Tudo o que se escreve sem «+» é daqui. */
export const DEFAULT_DIAL_CODE = '351'

/**
 * Como se parte o número depois do indicativo, país a país. Portugal são
 * nove dígitos de três em três — vale para telemóvel e para fixo. Onde
 * não houver regra escrita, parte-se de três em três, que é o menos
 * errado em quase todo o lado.
 */
const GROUPS: Record<string, number[]> = {
  '351': [3, 3, 3],
  '34': [3, 3, 3],
  '33': [1, 2, 2, 2, 2],
  '44': [4, 3, 3],
  '49': [3, 3, 4],
  '39': [3, 3, 4],
  '55': [2, 5, 4],
  '1': [3, 3, 4],
}

/** Quantos dígitos leva um número inteiro, para saber quando parar. */
const NATIONAL_LENGTH: Record<string, number> = {
  '351': 9,
  '34': 9,
  '33': 9,
  '44': 10,
  '49': 11,
  '39': 10,
  '55': 11,
  '1': 10,
}

/** O E.164 aguenta quinze dígitos ao todo, indicativo incluído. */
const E164_MAX = 15

/** Parte os dígitos pelo padrão do país e, esgotado o padrão, de três em três. */
function group(national: string, code: string): string[] {
  const pattern = GROUPS[code] ?? [3, 3, 3]
  const out: string[] = []
  let rest = national
  for (const size of pattern) {
    if (!rest) break
    out.push(rest.slice(0, size))
    rest = rest.slice(size)
  }
  while (rest) {
    out.push(rest.slice(0, 3))
    rest = rest.slice(3)
  }
  return out
}

/**
 * O que se escreve → o que se vê. Recebe o campo inteiro tal como está
 * (já com a máscara anterior lá dentro) e devolve-o outra vez formatado.
 *
 *   ""               → ""              (vazio fica vazio; não se impõe nada a ninguém)
 *   "9"              → "+351 9"        (sem «+», é de cá)
 *   "912345678"      → "+351 912 345 678"
 *   "00351912345678" → "+351 912 345 678"
 *   "+34600123456"   → "+34 600 123 456"
 *   "+3"             → "+3"            (indicativo a meio: deixa-se escrever)
 */
export function maskPhone(input: string, fallbackCode = DEFAULT_DIAL_CODE): string {
  let plus = input.trimStart().startsWith('+')
  let digits = input.replace(/\D/g, '')

  // O «00» internacional é o «+» de quem marca no teclado do telefone.
  if (!plus && digits.startsWith('00')) {
    plus = true
    digits = digits.slice(2)
  }

  if (!digits) return plus ? '+' : ''

  let code: string
  let national: string

  if (plus) {
    const found = DIAL_CODES.find((c) => digits.startsWith(c))
    // Ainda vai a meio do indicativo: devolve-se o que lá está, sem
    // adivinhar. Adivinhar aqui era o campo a saltar debaixo do dedo.
    if (!found) return `+${digits.slice(0, 4)}`
    code = found
    national = digits.slice(found.length)
  } else {
    code = fallbackCode
    const full = NATIONAL_LENGTH[code] ?? 9
    // Colado ao indicativo mas sem «+» — o que sai de uma folha de Excel
    // ou de um copiar-colar do WhatsApp.
    national = digits.startsWith(code) && digits.length > full ? digits.slice(code.length) : digits
  }

  national = national.slice(0, E164_MAX - code.length)
  const groups = group(national, code)
  return groups.length ? `+${code} ${groups.join(' ')}` : `+${code} `
}

/**
 * Onde fica o cursor depois de reescrever o campo.
 *
 * Sem isto a máscara é insuportável: acrescenta-se um espaço a meio e o
 * cursor salta para o fim, ou pior — o «+351» que o campo pôs sozinho
 * empurra o cursor três casas para trás e escreve-se o número ao
 * contrário. Conta-se por dígitos do número, não por letras da máscara,
 * e ignora-se o indicativo, que ninguém escreveu.
 */
export function caretAfter(masked: string, nationalDigits: number): number {
  // Salta o «+351 » — o cursor nunca tem de lá voltar.
  const head = masked.indexOf(' ')
  let i = head === -1 ? masked.length : head + 1
  if (nationalDigits <= 0) return i

  let seen = 0
  while (i < masked.length && seen < nationalDigits) {
    if (/\d/.test(masked[i] as string)) seen += 1
    i += 1
  }
  return i
}

/**
 * Quantos dígitos do NÚMERO (não do indicativo) ficam à esquerda do
 * cursor. É a medida que sobrevive à reescrita da máscara.
 */
export function nationalDigitsBefore(value: string, caret: number): number {
  const before = value.slice(0, caret)
  const digitsBefore = before.replace(/\D/g, '').length
  if (!value.trimStart().startsWith('+')) return digitsBefore

  const digits = value.replace(/\D/g, '')
  const code = DIAL_CODES.find((c) => digits.startsWith(c))
  if (!code) return digitsBefore
  return Math.max(0, digitsBefore - code.length)
}

/** Está inteiro? Serve para acender o campo quando o número fecha. */
export function phoneLooksComplete(masked: string): boolean {
  const digits = masked.replace(/\D/g, '')
  if (digits.length < 8) return false
  const code = DIAL_CODES.find((c) => digits.startsWith(c))
  if (!code) return digits.length >= 9
  const full = NATIONAL_LENGTH[code]
  return full ? digits.length - code.length === full : digits.length - code.length >= 8
}
