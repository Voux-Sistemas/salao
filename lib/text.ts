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

/**
 * Indicativos que aparecem de facto na agenda deste salão: Portugal e
 * os países de onde vêm as clientes. Testam-se do mais longo para o
 * mais curto, que é como se desmonta um número E.164.
 */
const DIAL_CODES = [
  '351', '352', '353', '212', '238', '239', '244', '245', '258', '291',
  '31', '32', '33', '34', '39', '41', '43', '44', '49', '55',
  '1',
]

/** Espaço inquebrável — o que segura os grupos do número na mesma linha. */
const NBSP = '\u00a0'

/**
 * Um telefone legível: "+351211000001" -> "+351 211 000 001".
 *
 * Guardamos sempre em E.164 porque é o telefone que identifica a
 * cliente — mas ninguém lê catorze dígitos seguidos. O indicativo fica
 * à cabeça e o resto agrupa de três em três a partir do fim.
 *
 * Os espaços são inquebráveis. No telemóvel a linha partia o número a
 * meio — «+351 961 000» numa linha, «001» na seguinte — e um número
 * partido deixa de ser um número. Agora desce inteiro ou não desce.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!trimmed.startsWith('+') || digits.length < 8) return trimmed

  const country = DIAL_CODES.find((code) => digits.startsWith(code))
  if (!country) return trimmed
  const rest = digits.slice(country.length)

  const groups: string[] = []
  for (let i = rest.length; i > 0; i -= 3) {
    groups.unshift(rest.slice(Math.max(0, i - 3), i))
  }
  return `+${country}${NBSP}${groups.join(NBSP)}`
}

/**
 * A mesma palavra, sem se importar com maiúsculas nem com espaços em
 * excesso. Serve para não repetir a cidade quando ela já é o nome da
 * casa — a de Cascais chama-se Cascais e fica em Cascais.
 */
export function sameWord(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false
  return a.trim().toLocaleLowerCase('pt') === b.trim().toLocaleLowerCase('pt')
}

/** "Ana Sofia Marques" -> "Ana M." */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  const firstPart = parts[0] ?? ''
  if (parts.length === 1) return firstPart
  const last = parts[parts.length - 1] ?? ''
  return `${firstPart} ${last.charAt(0)}.`
}

/**
 * O ENDEREÇO DE UMA FOTOGRAFIA, VINDO DE UM CAMPO DE TEXTO.
 *
 * Quem escreve isto é a dona, na área de gestão, e o que escrever vai
 * parar a um `src=` na montra pública. Um `javascript:` colado ali
 * corria no navegador de todas as clientes — por isso só passam duas
 * formas: um caminho do próprio site (`/fotos/...`) ou um `https://`.
 *
 * Não valida se a imagem existe: isso vê-se na pré-visualização, e uma
 * foto que não carrega cai no monograma da casa, que é o desenho normal
 * de "este serviço não tem fotografia".
 */
export function safePhotoUrl(input: string | null | undefined): string | null {
  const value = (input ?? '').trim()
  if (!value) return null

  // `//exemplo.com` herda o protocolo da página e é um endereço de fora
  // disfarçado de caminho local. Fica de fora com o resto.
  if (value.startsWith('/') && !value.startsWith('//')) {
    return value.length <= 500 ? value : null
  }
  if (/^https:\/\/[^\s]+$/i.test(value)) {
    return value.length <= 500 ? value : null
  }
  return null
}
