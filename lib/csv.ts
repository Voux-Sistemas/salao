/**
 * Um leitor de CSV pequeno e sem dependências, para a importação de
 * clientes. Aguenta aspas, vírgulas dentro de aspas, ponto-e-vírgula
 * (é o que o Excel português escreve), CRLF e a marca de ordem de bytes.
 *
 * Não adivinha nada: o que não entende deixa em branco, e a pré-visualização
 * mostra à pessoa o que vai acontecer antes de acontecer.
 */

/** Vírgula ou ponto-e-vírgula: ganha o que aparecer mais na primeira linha. */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const line = text.slice(0, text.indexOf('\n') + 1 || text.length)
  const counts = {
    ',': (line.match(/,/g) ?? []).length,
    ';': (line.match(/;/g) ?? []).length,
    '\t': (line.match(/\t/g) ?? []).length,
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';'
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t'
  return ','
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const delimiter = detectDelimiter(text)

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        // Duas aspas seguidas são uma aspa a sério.
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field.trim())
      field = ''
    } else if (char === '\n') {
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.trim())
    rows.push(row)
  }

  // Linhas totalmente vazias não contam.
  return rows.filter((line) => line.some((cell) => cell !== ''))
}

/* --- do cabeçalho para os nossos campos ----------------------------- */

export type ClientField =
  | 'name'
  | 'phone'
  | 'email'
  | 'language'
  | 'birthdate'
  | 'notes'
  | 'tags'

/** Os nomes de coluna que reconhecemos, em português e em inglês. */
const HEADERS: Record<ClientField, string[]> = {
  name: ['nome', 'name', 'cliente', 'nome completo', 'full name'],
  phone: ['telefone', 'telemovel', 'telemóvel', 'phone', 'contacto', 'whatsapp', 'numero', 'número'],
  email: ['email', 'e-mail', 'correio'],
  language: ['idioma', 'lingua', 'língua', 'language'],
  birthdate: ['aniversario', 'aniversário', 'nascimento', 'data de nascimento', 'birthdate', 'birthday'],
  notes: ['notas', 'nota', 'observacoes', 'observações', 'notes'],
  tags: ['etiquetas', 'tags', 'marcadores'],
}

function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** Onde está cada campo, ou -1 se a coluna não veio no ficheiro. */
export function mapHeader(header: readonly string[]): Record<ClientField, number> {
  const found = {} as Record<ClientField, number>
  for (const field of Object.keys(HEADERS) as ClientField[]) {
    const names = HEADERS[field].map(normalise)
    found[field] = header.findIndex((cell) => names.includes(normalise(cell)))
  }
  return found
}

/** O ficheiro traz cabeçalho? Só se a primeira linha nomear nome ou telefone. */
export function looksLikeHeader(row: readonly string[]): boolean {
  const map = mapHeader(row)
  return map.name >= 0 || map.phone >= 0
}

export type ParsedClient = {
  line: number
  name: string
  phone: string
  email: string | null
  language: string | null
  birthdate: string | null
  notes: string | null
  tags: string[]
}

function cell(row: readonly string[], index: number): string {
  if (index < 0) return ''
  return row[index] ?? ''
}

/** Datas em 1999-04-30 ou 30/04/1999. O resto fica por preencher. */
export function parseDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) return value
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value)
  if (br) {
    const [, day = '', month = '', year = ''] = br
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return null
}

/**
 * Transforma o ficheiro em fichas. Se não houver cabeçalho reconhecível,
 * assume-se a ordem mais comum: nome, telefone, email.
 */
export function readClients(text: string): {
  header: string[] | null
  records: ParsedClient[]
} {
  const rows = parseCsv(text)
  const first = rows[0]
  if (!first) return { header: null, records: [] }

  const hasHeader = looksLikeHeader(first)
  const map = hasHeader
    ? mapHeader(first)
    : ({ name: 0, phone: 1, email: 2, language: -1, birthdate: -1, notes: -1, tags: -1 } as Record<ClientField, number>)

  const body = hasHeader ? rows.slice(1) : rows
  const offset = hasHeader ? 2 : 1

  const records = body.map((row, index) => {
    const tags = cell(row, map.tags)
    return {
      line: index + offset,
      name: cell(row, map.name),
      phone: cell(row, map.phone),
      email: cell(row, map.email) || null,
      language: cell(row, map.language).slice(0, 2).toLowerCase() || null,
      birthdate: parseDate(cell(row, map.birthdate)),
      notes: cell(row, map.notes) || null,
      tags: tags
        ? tags
            .split(/[;,|]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
    }
  })

  return { header: hasHeader ? first : null, records }
}
