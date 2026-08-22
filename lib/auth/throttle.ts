import 'server-only'
import { headers } from 'next/headers'
import { sql } from '@/lib/db'

/**
 * O travão das portas públicas.
 *
 * Entrar, pedir um código e marcar são as três coisas que qualquer
 * pessoa na internet pode fazer sem se identificar primeiro. O código de
 * uso único já só aceita cinco tentativas — mas pedir códigos não tinha
 * limite nenhum, e cinco tentativas repetidas mil vezes deixam de ser
 * cinco.
 *
 * A contagem está na base de dados de propósito. Em produção o servidor
 * não é um só: dois pedidos seguidos podem cair em máquinas diferentes,
 * e um contador na memória de cada uma não conta coisa nenhuma.
 */

/**
 * O endereço de quem está do outro lado.
 *
 * Atrás de um proxy o `x-forwarded-for` traz a cadeia toda; o primeiro
 * da lista é o cliente, os outros são os saltos pelo caminho. O Netlify
 * põe o mesmo valor, já limpo, num cabeçalho seu.
 *
 * Isto pode ser forjado — por isso nunca é a única chave. Serve para
 * travar o ruído, não para provar quem alguém é.
 */
export async function callerIp(): Promise<string> {
  const list = await headers()
  const netlify = list.get('x-nf-client-connection-ip')
  if (netlify) return netlify.trim()
  const forwarded = list.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return list.get('x-real-ip')?.trim() ?? 'desconhecido'
}

/**
 * Conta uma tentativa neste balde e diz se ela ainda cabe.
 *
 * Falha para o lado aberto: se a base de dados não responder, deixa
 * passar. Não é generosidade — é que sem base de dados a acção a seguir
 * também não vai a lado nenhum, e prender aqui só trocaria um erro
 * honesto por um "tente mais tarde" que mentia sobre a causa.
 */
export async function allow(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const rows = await sql<{ ok: boolean }[]>`
      select rate_limit_hit(
        ${bucket}, ${limit}, ${`${windowSeconds} seconds`}::interval
      ) as ok
    `
    return rows[0]?.ok ?? true
  } catch {
    return true
  }
}

/**
 * Os limites, num sítio só, para se poderem ler todos de uma vez.
 *
 * São largos de propósito. Uma recepcionista atrapalhada engana-se
 * quatro ou cinco vezes na palavra-passe num minuto mau; quem anda a
 * adivinhar faz isso mil vezes. O número está entre as duas coisas, mais
 * perto do engano do que da máquina.
 */
export const LIMITS = {
  /** Tentar entrar com palavra-passe, por telefone. */
  signIn: { limit: 10, windowSeconds: 900 },
  /** Tentar entrar, por endereço — apanha quem varre telefones. */
  signInByIp: { limit: 40, windowSeconds: 900 },
  /** Pedir um código novo, por telefone. */
  issueCode: { limit: 5, windowSeconds: 3600 },
  /** Pedir um código novo, por endereço. */
  issueCodeByIp: { limit: 20, windowSeconds: 3600 },
  /** Confirmar um código, por telefone. */
  verifyCode: { limit: 15, windowSeconds: 900 },
  /** Marcar pelo site, por endereço. */
  book: { limit: 12, windowSeconds: 3600 },
} as const

type Limit = { limit: number; windowSeconds: number }

/** Açúcar: `allowed('entrar', phone, LIMITS.signIn)`. */
export async function allowed(
  kind: string,
  key: string,
  { limit, windowSeconds }: Limit,
): Promise<boolean> {
  return allow(`${kind}:${key}`, limit, windowSeconds)
}
