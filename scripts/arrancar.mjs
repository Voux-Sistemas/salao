/**
 * PÔR A CASA EM CONDIÇÕES DE ABRIR.
 *
 * Duas coisas que o `seed-real` deixou para trás e que não podem ficar
 * assim no dia em que alguém de fora usar isto:
 *
 *   1. A PALAVRA-PASSE PARTILHADA. O seed antigo dava a mesma senha às
 *      cinco pessoas e essa senha estava escrita no guião — que está
 *      num repositório público. Quem lesse o código entrava como dona,
 *      na rede toda. Aqui apaga-se essa senha a quem ainda a tenha; a
 *      senha que alguém já tenha trocado por outra fica de pé.
 *
 *   2. O NOME PÚBLICO DE RESERVA. «Profissional 1» a «Profissional 5»
 *      era o que as clientes liam na montra. Apagado, aparece o nome
 *      próprio, que é o que estava sempre à espera por baixo.
 *
 * Não apaga marcações nem clientes — isso é o `limpar.mjs`.
 *
 *   node scripts/arrancar.mjs                    (base local)
 *   node scripts/_prod.mjs arrancar              (Supabase)
 */
import { scrypt, timingSafeEqual } from 'node:crypto'
import { ligar, loadEnv, hostOf, isLocal } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const host = hostOf(url)
const emCasa = isLocal(url)

/**
 * A senha que andou pelo git. Está aqui em texto de propósito: é
 * exactamente isto que se procura para apagar, e já não abre nada
 * depois de este guião correr uma vez.
 */
const FUGIU = 'nohora2026'

/** Mesma verificação de lib/auth/password.ts, sem depender do Next. */
function matches(password, stored) {
  return new Promise((resolve) => {
    const [alg, N, r, p, salt, key] = String(stored).split('$')
    if (alg !== 'scrypt') return resolve(false)
    scrypt(
      password.normalize('NFKC'),
      Buffer.from(salt, 'base64url'),
      64,
      { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 },
      (error, derived) => {
        if (error) return resolve(false)
        const guardado = Buffer.from(key, 'base64url')
        resolve(
          derived.length === guardado.length &&
            timingSafeEqual(derived, guardado),
        )
      },
    )
  })
}

const sql = ligar()

try {
  console.log(`> arrancar em ${host}\n`)

  // ---- 1. senhas ----------------------------------------------------
  const pessoas = await sql`
    select id, name, phone, password_hash from staff order by sort_order
  `
  const expostas = []
  for (const p of pessoas) {
    if (p.password_hash && (await matches(FUGIU, p.password_hash))) {
      expostas.push(p)
    }
  }

  if (expostas.length === 0) {
    console.log('  Senhas ..... nenhuma com a senha do git. Nada a fazer.')
  } else {
    const ids = expostas.map((p) => p.id)
    await sql.begin(async (tx) => {
      await tx`update staff set password_hash = null where id = any(${ids})`
      // Uma sessão aberta com a senha que fugiu continuava aberta.
      await tx`
        delete from session
         where subject_type = 'staff' and subject_id = any(${ids})
      `
    })
    console.log(`  Senhas ..... apagadas a ${expostas.length}:`)
    for (const p of expostas) console.log(`               ${p.name} (${p.phone})`)
  }

  // ---- 2. nomes públicos --------------------------------------------
  const alias = await sql`
    update staff set public_alias = null
     where public_alias ~ '^Profissional [0-9]+$'
     returning name
  `
  console.log(
    alias.length === 0
      ? '  Nomes ...... nenhum de reserva. Nada a fazer.'
      : `  Nomes ...... ${alias.length} passaram a mostrar o nome próprio: ${alias
          .map((a) => a.name)
          .join(', ')}`,
  )

  // ---- o que falta ---------------------------------------------------
  const [dona] = await sql`
    select s.name, s.phone
      from staff s join staff_role r on r.staff_id = s.id
     where r.role = 'owner' and s.password_hash is null
     limit 1
  `
  console.log('')
  if (dona) {
    console.log('  Falta dar uma palavra-passe à dona — ninguém entra sem isso:')
    console.log(
      `    ${emCasa ? 'node scripts/senha.mjs' : 'node scripts/_prod.mjs senha'} ${dona.phone}`,
    )
    console.log('  As outras definem-se depois na gestão, em Equipa.')
  } else {
    console.log('  A dona já tem palavra-passe própria.')
  }
  console.log('')
} finally {
  await sql.end()
}
