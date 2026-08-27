import 'server-only'
import { DEFAULT_DIAL_CODE, DIAL_CODES } from '@/lib/phone'

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

/**
 * O TELEFONE TEM DE TER UMA FORMA SÓ.
 *
 * É ele que identifica a cliente — a ficha é única na rede e o histórico
 * atravessa as lojas por causa dele. Mas o mesmo número chega escrito de
 * maneiras diferentes conforme a porta: da folha de Excel vem
 * «912345678», do campo do site vem «+351 912 345 678», de um
 * copiar-colar do WhatsApp vem «00351912345678».
 *
 * Guardar o que veio era guardar três clientes onde há uma. E não se
 * notava: a marcação era aceite, a página dizia que sim, e só o balcão
 * é que via a ficha partida ao meio — as alergias numa, a marcação nova
 * noutra. O pior tipo de defeito, o que se acumula em silêncio.
 *
 * Por isso aqui não se limpa o texto: escolhe-se UMA forma. E.164, com
 * indicativo, sempre — que é a forma que a base já dizia guardar.
 *
 * Quem não tiver indicativo nenhum leva o de casa. Quem já o trouxer
 * fica como está: um número de nove dígitos que comece por «351» é
 * ambíguo por natureza, e nesse empate ganha o que a pessoa escreveu.
 */
export function normalisePhone(input: string): string {
  const digits = input.trim().replace(/^\+/, '').replace(/\D/g, '')
  if (!digits) return ''

  // «00» é como se marca o estrangeiro a partir de um telefone fixo, e
  // é o que sai de muita agenda antiga. Vale o mesmo que o «+».
  const semZeros = digits.startsWith('00') ? digits.slice(2) : digits

  const code = DIAL_CODES.find((c) => semZeros.startsWith(c))
  if (code) {
    // Começar pelo indicativo não chega para o ser: «351123456» tem
    // nove dígitos e é um número de casa que por acaso principia
    // assim. Só é indicativo se o que sobra tiver comprimento de
    // número nacional.
    const resto = semZeros.length - code.length
    if (resto >= 6) return `+${semZeros}`
  }

  return `+${DEFAULT_DIAL_CODE}${semZeros}`
}

export const env = {
  get databaseUrl(): string {
    return required('DATABASE_URL')
  },
  get sessionSecret(): string {
    return required('SESSION_SECRET')
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
