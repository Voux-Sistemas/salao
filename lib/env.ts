import 'server-only'
import { DEFAULT_DIAL_CODE, NATIONAL_LENGTH } from '@/lib/phone'

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
 * é que via a ficha partida ao meio. O pior tipo de defeito, o que se
 * acumula em silêncio.
 *
 * DEIXOU DE ADIVINHAR, E É POR ISSO QUE ISTO MUDOU.
 *
 * Havia aqui uma lista de indicativos e a pergunta «este número começa
 * por algum deles?». Não se pode responder a essa pergunta olhando só
 * para os dígitos, e a casa pagava-a cara:
 *
 *     212 345 678   Lisboa      guardado como Marrocos
 *     238 123 456   Seia        guardado como Cabo Verde
 *     239 123 456   Coimbra     guardado como São Tomé
 *     245 123 456   Ponte de Sor  guardado como Guiné-Bissau
 *     258 123 456   Viana       guardado como Moçambique
 *     291 123 456   MADEIRA     guardado como país nenhum
 *
 * Seis regiões de Portugal, com as fichas partidas em duas e ninguém a
 * dar por isso — que é exactamente o defeito que este ficheiro dizia
 * estar a evitar.
 *
 * A informação que faltava estava lá desde o princípio e era deitada
 * fora na primeira linha: O «+». Quem escreve «+» ou «00» está a dizer
 * que o número é de fora; quem não escreve nada está a falar de casa.
 * É a única leitura que não tem de adivinhar nada.
 *
 * FICA UMA EXCEPÇÃO, e é estreita de propósito: dígitos que comecem
 * pelo indicativo de casa E tenham o comprimento exacto de um número
 * inteiro — «351» mais nove — são o que sai de uma folha de Excel, e
 * seriam impossíveis como número nacional.
 */
export function normalisePhone(input: string): string {
  const bruto = input.trim()
  const digits = bruto.replace(/\D/g, '')
  if (!digits) return ''

  // «00» é como se marca o estrangeiro a partir de um telefone fixo, e
  // é o que sai de muita agenda antiga. Vale o mesmo que o «+».
  const trazIndicativo = bruto.startsWith('+') || digits.startsWith('00')
  if (trazIndicativo) {
    const sem = digits.startsWith('00') ? digits.slice(2) : digits
    return sem ? `+${sem}` : ''
  }

  const casa = DEFAULT_DIAL_CODE
  const inteiro = casa.length + (NATIONAL_LENGTH[casa] ?? 9)
  if (digits.startsWith(casa) && digits.length === inteiro) {
    return `+${digits}`
  }

  return `+${casa}${digits}`
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
