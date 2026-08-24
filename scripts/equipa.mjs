/**
 * DEIXAR A EQUIPA PRONTA PARA O DIA UM.
 *
 * A casa vai começar do zero: os nomes que estão na base foram
 * inventados para as telas terem gente, e as pessoas verdadeiras hão-de
 * entrar uma a uma, sem nome, numeradas — Profissional 1, 2, 3. Este
 * guião faz essa passagem e mais nada:
 *
 *   1. Garante os acessos que já existiam. Cria o que faltar; NUNCA
 *      toca em quem já lá está — nem no nome, nem na palavra-passe.
 *      Quem já entrou continua a entrar exactamente como entrava.
 *
 *   2. Deixa um só profissional, chamado «Profissional 1», com o
 *      catálogo todo, as lojas todas e uma escala igual ao horário de
 *      abertura de uma delas. É o contrário de limitar: fica tudo
 *      aberto e ela corta o que não quiser no ecrã da Equipa.
 *
 *   3. Apaga os outros profissionais inventados.
 *
 * A ORDEM IMPORTA: corra primeiro o `limpar`. Enquanto houver marcações
 * de teste, apagar uma pessoa é apagar quem fez o trabalho — e a base
 * não deixa, e ainda bem. Este guião confirma isso antes de mexer e,
 * se encontrar movimento, não apaga NADA e diz o que falta correr.
 *
 * Corre-se as vezes que forem precisas: a segunda não faz nada de novo.
 *
 *   node scripts/limpar.mjs   &&  node scripts/equipa.mjs
 *   node scripts/_prod.mjs limpar --a-serio
 *   node scripts/_prod.mjs equipa --a-serio
 */
import { randomBytes, scrypt } from 'node:crypto'
import { ligar, loadEnv, hostOf, isLocal } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const host = hostOf(url)
const emCasa = isLocal(url)

if (!emCasa && !process.argv.includes('--a-serio')) {
  console.error(`Isto apaga profissionais em ${host}.`)
  console.error('Se é mesmo o que quer, repita com --a-serio.')
  process.exit(1)
}

/**
 * OS ACESSOS, COMO ESTAVAM.
 *
 * Só se cria o que faltar. A palavra-passe aqui escrita é a de arranque
 * e só serve para a conta nascer — a primeira coisa a fazer no dia em
 * que isto for a sério é trocá-las todas com o `scripts/senha.mjs`,
 * porque este ficheiro está num repositório aberto.
 */
const ACESSOS = [
  {
    login: 'master',
    nome: 'Pietro',
    telefone: '+351900000000',
    senha: 'master123',
    papel: 'master',
    loja: null,
    cor: '#D9C08A',
    ordem: 999,
  },
  {
    login: 'gerente',
    nome: 'Gerente de Teste',
    telefone: '+351930000009',
    senha: 'gerente123',
    papel: 'manager',
    loja: 'valongo',
    cor: '#7C8AA5',
    ordem: 90,
  },
]

/** O nome do primeiro, e o molde de todos os que ela vier a criar. */
const PRIMEIRO = 'Profissional 1'

/**
 * As tabelas que são da própria pessoa: caem com ela e ninguém dá pela
 * falta. Tudo o resto que aponte para `staff` é trabalho feito — e
 * trabalho feito trava o apagar, de propósito.
 */
const PROPRIAS = new Set([
  'staff_role.staff_id',
  'staff_unit.staff_id',
  'staff_skill.staff_id',
  'staff_schedule.staff_id',
  'staff_absence.staff_id',
  'price_override.staff_id',
])

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

const sql = ligar()

try {
  console.log(`> equipa em ${host}\n`)

  const [org] = await sql`select id, name from org order by created_at limit 1`
  if (!org) {
    console.error('Não há salão nenhum nesta base. Corra o seed primeiro.')
    process.exit(1)
  }

  const lojas = new Map(
    (await sql`select id, slug, name from unit order by sort_order, name`).map(
      (u) => [u.slug, u],
    ),
  )

  // --- 1. os acessos ------------------------------------------------
  for (const a of ACESSOS) {
    const [existe] = await sql`
      select id, name from staff
       where org_id = ${org.id}
         and (lower(login) = ${a.login} or phone = ${a.telefone})
       limit 1
    `
    if (existe) {
      console.log(`  acesso  ${a.login.padEnd(10)} já lá estava (${existe.name})`)
      continue
    }
    const unitId = a.loja ? (lojas.get(a.loja)?.id ?? null) : null
    const [novo] = await sql`
      insert into staff (org_id, name, phone, login, password_hash,
                         display_color, sort_order, accepts_online_booking)
      values (${org.id}, ${a.nome}, ${a.telefone}, ${a.login},
              ${await hashPassword(a.senha)}, ${a.cor}, ${a.ordem}, false)
      returning id
    `
    await sql`
      insert into staff_role (staff_id, role, unit_id)
      values (${novo.id}, ${a.papel}, ${unitId})
    `
    if (unitId) {
      await sql`
        insert into staff_unit (staff_id, unit_id) values (${novo.id}, ${unitId})
        on conflict do nothing
      `
    }
    console.log(`  acesso  ${a.login.padEnd(10)} criado (${a.nome}, ${a.papel})`)
  }

  // --- 2. quem são os profissionais ---------------------------------
  const profissionais = await sql`
    select s.id, s.name, s.sort_order
      from staff s
      join staff_role r on r.staff_id = s.id and r.role = 'professional'
     where s.org_id = ${org.id}
     order by s.sort_order, s.name
  `

  let ficaId = profissionais[0]?.id ?? null
  const saem = profissionais.slice(1)

  // --- 3. o movimento trava o apagar --------------------------------
  if (saem.length > 0) {
    const fks = await sql`
      select tc.table_name, kcu.column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name
       where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'staff'
       order by tc.table_name, kcu.column_name
    `
    const ids = saem.map((p) => p.id)
    const presos = []
    for (const f of fks) {
      const alvo = `${f.table_name}.${f.column_name}`
      if (PROPRIAS.has(alvo)) continue
      const [r] = await sql.unsafe(
        `select count(*)::int as n from ${f.table_name} where ${f.column_name} = any($1::uuid[])`,
        [ids],
      )
      if (r.n > 0) presos.push([alvo, r.n])
    }
    if (presos.length > 0) {
      console.error('\n  Não se apaga ninguém: ainda há trabalho em nome deles.\n')
      for (const [alvo, n] of presos) {
        console.error(`    ${alvo.padEnd(38)} ${String(n).padStart(6)} linha(s)`)
      }
      console.error(
        emCasa
          ? '\n  Corra primeiro:  node scripts/limpar.mjs\n'
          : '\n  Corra primeiro:  node scripts/_prod.mjs limpar --a-serio\n',
      )
      process.exit(1)
    }
  }

  // --- 4. um só, sem nome, com tudo aberto --------------------------
  const servicos = await sql`
    select id from service where org_id = ${org.id} and is_active
  `

  /*
   * A ESCALA É NUMA LOJA SÓ, PORQUE NINGUÉM ESTÁ EM DOIS SÍTIOS.
   *
   * A base tem uma exclusão que impede a mesma pessoa de ter duas
   * escalas que se sobreponham no mesmo dia da semana — e as duas lojas
   * abrem à mesma hora, portanto sobrepunham-se sempre. Fica a loja
   * onde a pessoa já trabalhava; se não tiver escala nenhuma, a
   * primeira. Nas outras continua a poder ser marcada à mão: o `staff_unit`
   * abaixo mete-a em todas.
   */
  const [jaEra] = ficaId
    ? await sql`
        select unit_id from staff_schedule where staff_id = ${ficaId} limit 1
      `
    : []
  const escalaUnitId = jaEra?.unit_id ?? [...lojas.values()][0]?.id ?? null

  await sql.begin(async (tx) => {
    if (!ficaId) {
      // Não sobrou nenhum profissional (ou nunca houve): nasce um.
      const [novo] = await tx`
        insert into staff (org_id, name, phone, display_color, sort_order)
        values (${org.id}, ${PRIMEIRO}, '+351930000001', '#B08968', 1)
        returning id
      `
      ficaId = novo.id
    } else {
      await tx`
        update staff
           set name = ${PRIMEIRO}, public_alias = null,
               is_active = true, sort_order = 1, updated_at = now()
         where id = ${ficaId}
      `
    }

    await tx`
      insert into staff_role (staff_id, role, unit_id)
      select ${ficaId}, 'professional', null
       where not exists (
         select 1 from staff_role where staff_id = ${ficaId} and role = 'professional'
       )
    `

    // As duas lojas e o catálogo todo. Ninguém quer descobrir ao balcão,
    // com a cliente à frente, que o serviço não se pode marcar porque
    // falta uma cruz num ecrã de gestão.
    for (const loja of lojas.values()) {
      await tx`
        insert into staff_unit (staff_id, unit_id) values (${ficaId}, ${loja.id})
        on conflict do nothing
      `
    }
    for (const s of servicos) {
      await tx`
        insert into staff_skill (staff_id, service_id) values (${ficaId}, ${s.id})
        on conflict do nothing
      `
    }

    // A escala é a da porta aberta: enquanto a loja estiver aberta, há
    // com quem marcar. Ela aperta depois, pessoa a pessoa.
    await tx`delete from staff_schedule where staff_id = ${ficaId}`
    if (escalaUnitId) {
      await tx`
        insert into staff_schedule (staff_id, unit_id, weekday, starts_min,
                                    ends_min, valid_from)
        select ${ficaId}, b.unit_id, b.weekday, b.opens_min, b.closes_min,
               current_date - 1
          from business_hours b
         where b.unit_id = ${escalaUnitId}
      `
    }

    // --- 5. os outros saem -----------------------------------------
    for (const p of saem) {
      await tx`delete from staff_schedule where staff_id = ${p.id}`
      await tx`delete from staff_skill where staff_id = ${p.id}`
      await tx`delete from staff_unit where staff_id = ${p.id}`
      await tx`delete from staff_role where staff_id = ${p.id}`
      await tx`delete from staff_absence where staff_id = ${p.id}`
      await tx`delete from price_override where staff_id = ${p.id}`
      // A sessão guarda só o id, sem chave estrangeira: não cai sozinha.
      await tx`
        delete from session
         where subject_type = 'staff' and subject_id = ${p.id}
      `
      await tx`delete from staff where id = ${p.id}`
    }
  })

  for (const p of saem) console.log(`  fora    ${p.name}`)
  const casa = [...lojas.values()].find((u) => u.id === escalaUnitId)
  console.log(
    `  fica    ${PRIMEIRO} — ${servicos.length} serviços, ${lojas.size} loja(s),` +
      ` escala em ${casa?.name ?? '—'}`,
  )

  // --- o retrato final ----------------------------------------------
  const equipa = await sql`
    select s.name, s.login, s.phone, s.sort_order,
           (select string_agg(r.role, '+' order by r.role)
              from staff_role r where r.staff_id = s.id) as papeis
      from staff s
     where s.org_id = ${org.id} and s.is_active
     order by s.sort_order, s.name
  `
  console.log('')
  for (const s of equipa) {
    console.log(
      `  ${String(s.name).padEnd(20)} ${String(s.login ?? '—').padEnd(10)}` +
        ` ${String(s.phone).padEnd(15)} ${s.papeis}`,
    )
  }
  console.log('')
} finally {
  await sql.end()
}
