import 'server-only'

/**
 * Variáveis de ambiente, lidas com preguiça.
 *
 * Nada aqui é avaliado no topo do módulo: o `next build` corre sem base
 * de dados e não deve rebentar por causa disso. Rebenta na primeira
 * chamada em tempo de execução, que é quando faz falta.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Falta a variável de ambiente ${name}. Vê o .env.example.`,
    )
  }
  return value
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

/** Normaliza um telefone para comparação: só dígitos e o + inicial. */
export function normalisePhone(input: string): string {
  const trimmed = input.trim()
  const plus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return plus ? `+${digits}` : digits
}

export const env = {
  get databaseUrl(): string {
    return required('DATABASE_URL')
  },
  get sessionSecret(): string {
    return required('SESSION_SECRET')
  },
  /**
   * O suporte não vive na base de dados: é esta lista.
   * Quem entrar com um destes telefones vê tudo, em todas as lojas.
   */
  get supportPhones(): string[] {
    return optional('SUPPORT_PHONES')
      .split(',')
      .map((p) => normalisePhone(p))
      .filter(Boolean)
  },
  /** Código de instalação que protege o /comecar. */
  get setupCode(): string {
    return required('SETUP_CODE')
  },
  get siteUrl(): string {
    return optional('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
  },
} as const
