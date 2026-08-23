/**
 * DAR UMA PALAVRA-PASSE A ALGUÉM DA EQUIPA.
 *
 * Serve para a primeira de todas — a da dona — porque enquanto ninguém
 * tem senha ninguém entra na gestão, e é na gestão que se dão as
 * outras. Depois disso não é preciso: a dona abre Equipa, escolhe a
 * pessoa e escreve-lhe uma.
 *
 * A palavra-passe escreve-se aqui no momento e nunca sai daqui: não vai
 * na linha de comandos (que fica no histórico da consola), não passa
 * por ficheiro nenhum, não aparece no ecrã enquanto se escreve e o que
 * chega à base de dados é o scrypt, nunca o texto.
 *
 *   node scripts/senha.mjs +351916649600          (base local)
 *   node scripts/_prod.mjs senha +351916649600    (Supabase)
 */
import { createInterface } from 'node:readline'
import { randomBytes, scrypt } from 'node:crypto'
import { ligar, loadEnv, hostOf } from './_ligar.mjs'

// O `_prod.mjs` já pôs o ambiente de pé antes de nos importar. Quando se
// corre este guião directamente é contra a base local, e aí lê-se o .env.
loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

// O argumento vem em [2] quando se corre isto directamente e em [3]
// quando é o _prod.mjs a chamar (que ocupa o [2] com o nome do guião).
const telefone = (process.argv[3] ?? process.argv[2] ?? '').trim()
if (!telefone.startsWith('+')) {
  console.error('Diga o telemóvel com indicativo: node scripts/senha.mjs +351...')
  process.exit(1)
}

/** Só dígitos e o + inicial — a mesma normalização do lib/env.ts. */
function normalisePhone(input) {
  const trimmed = input.trim()
  const plus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return plus ? `+${digits}` : digits
}

/** scrypt$N$r$p$salt$chave — mesmo formato de lib/auth/password.ts. */
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16)
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error)
        else
          resolve(
            [
              'scrypt',
              16384,
              8,
              1,
              salt.toString('base64url'),
              key.toString('base64url'),
            ].join('$'),
          )
      },
    )
  })
}

/**
 * Ler sem escrever no ecrã. O readline normal ecoa cada tecla; aqui
 * intercepta-se a escrita da saída enquanto a pergunta está de pé, para
 * a palavra-passe não ficar visível por cima do ombro nem no scrollback.
 */
function askSecret(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const write = process.stdout.write.bind(process.stdout)
    let muted = false
    process.stdout.write = (chunk, ...rest) => (muted ? true : write(chunk, ...rest))

    rl.question(question, (answer) => {
      process.stdout.write = write
      write('\n')
      rl.close()
      resolve(answer)
    })
    muted = true
  })
}

const sql = ligar()
const host = hostOf(url)

try {
  const phone = normalisePhone(telefone)
  const rows = await sql`
    select s.id, s.name, o.name as org
      from staff s
      join org o on o.id = s.org_id
     where s.phone = ${phone} and s.is_active
     limit 1
  `
  const staff = rows[0]
  if (!staff) {
    console.error(`Não há ninguém activo com o telemóvel ${phone} em ${host}.`)
    process.exit(1)
  }

  console.log(`${staff.name} — ${staff.org} — ${host}\n`)
  const senha = await askSecret('Palavra-passe nova (não aparece): ')
  const outra = await askSecret('Outra vez: ')

  if (senha !== outra) {
    console.error('As duas não são iguais. Nada mudou.')
    process.exit(1)
  }
  if (senha.length < 8) {
    console.error('Pelo menos 8 caracteres. Nada mudou.')
    process.exit(1)
  }

  await sql`
    update staff set password_hash = ${await hashPassword(senha)}
     where id = ${staff.id}
  `
  // Mudar a palavra-passe fecha o que estivesse aberto — a regra é a
  // mesma do ecrã de recuperação em app/(auth)/entrar/actions.ts.
  await sql`delete from session where subject_type = 'staff' and subject_id = ${staff.id}`

  console.log(`\nFeito. ${staff.name} já pode entrar em /entrar.`)
} finally {
  await sql.end()
}
