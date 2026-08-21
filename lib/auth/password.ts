import 'server-only'
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto'

// `promisify` perde a sobrecarga com opções, por isso embrulha-se à mão.
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

// Parâmetros do scrypt. Ficam gravados dentro do próprio hash, por isso
// podem subir no futuro sem invalidar as palavras-passe já existentes.
const COST = 16384
const BLOCK_SIZE = 8
const PARALLELISM = 1
const KEY_LENGTH = 64
const MAX_MEMORY = 64 * 1024 * 1024

/** scrypt$N$r$p$salt$chave, tudo em base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = (await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAX_MEMORY,
  }))
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

/**
 * Comparação em tempo constante. Devolve false para hash malformado ou
 * ausente — nunca lança, para o ecrã de entrada não distinguir "conta
 * sem senha" de "senha errada".
 */
export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false
  const [scheme, n, r, p, salt, key] = stored.split('$')
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !key) return false

  try {
    const expected = Buffer.from(key, 'base64url')
    const actual = (await scryptAsync(
      password.normalize('NFKC'),
      Buffer.from(salt, 'base64url'),
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEMORY },
    ))
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

/**
 * Gasta o mesmo tempo que uma verificação real, para que "este telefone
 * não existe" e "a palavra-passe está errada" demorem igual.
 */
export async function burnTime(): Promise<void> {
  await verifyPassword(
    'x',
    'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  )
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'A palavra-passe precisa de pelo menos 8 caracteres.'
  if (password.length > 200) return 'Palavra-passe demasiado longa.'
  return null
}
