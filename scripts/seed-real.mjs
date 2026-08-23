/**
 * O SALÃO A SÉRIO — Nohora Ramirez, Valongo e Maia.
 *
 * As lojas, o preçário, a equipa e as escalas saíram do `precario.pdf`
 * e das mensagens da dona; está tudo registado em `CONTEUDO.md` e
 * `EQUIPA.md`. Onde ela ainda não disse nada há um palpite, e cada
 * palpite está marcado aqui em cima do sítio onde vive.
 *
 * As CLIENTES e as MARCAÇÕES são inventadas, e só nascem contra a base
 * local: existem para as telas da gestão terem carne enquanto se testa
 * — agenda cheia, comandas por fechar, relatórios com números, caixa
 * aberto. Contra a Supabase o salão fica com o catálogo, a equipa e as
 * escalas, e mais nada.
 *
 * Volta a correr as vezes que quiseres: apaga a rede pelo slug antes de
 * semear. Determinístico — o mesmo resultado sempre, salvo o dia.
 *
 *   node scripts/_prod.mjs seed-real     (Supabase)
 *   node scripts/seed-real.mjs           (base local, lê o .env)
 */
import { randomBytes, scrypt } from 'node:crypto'
import { ligar, loadEnv, hostOf, isLocal } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

// Este guião começa por um `truncate cascade`. Contra uma base local
// isso é o que se quer; contra a Supabase é apagar o salão. Fora de
// casa exige-se a intenção escrita, para não se perder um dia de
// trabalho por causa de um .env trocado.
const host = hostOf(url)
const emCasa = isLocal(url)
if (!emCasa && !process.argv.includes('--apagar-tudo')) {
  console.error(`Isto APAGA tudo o que está em ${host} e semeia de novo.`)
  console.error('Se é mesmo o que quer, repita com --apagar-tudo.')
  process.exit(1)
}

/*
 * CLIENTES E MARCAÇÕES INVENTADAS: em casa sim, na Supabase não.
 *
 * Em casa é o que se quer — as telas da gestão só se testam com carne:
 * agenda cheia, comandas por fechar, relatórios com números. Na base a
 * sério é o contrário: a dona abre a agenda no primeiro dia e vê meio
 * milhar de marcações que nunca aconteceram, com nomes de gente que não
 * existe. Quem quiser mesmo encher a produção pede-o por escrito.
 */
const MOVIMENTO = emCasa || process.argv.includes('--com-movimento')

/*
 * A PALAVRA-PASSE DA EQUIPA.
 *
 * Em casa é sempre a mesma, para entrar sem cerimónia. Fora de casa
 * não: uma palavra-passe escrita num ficheiro que está no git, igual
 * para as cinco pessoas, não é uma palavra-passe — é um convite. Na
 * Supabase a equipa nasce SEM senha (a gestão mostra-lhes "Sem senha"),
 * e dá-se uma a cada pessoa na ficha dela. Para a primeira, a da dona,
 * há o `scripts/senha.mjs`, que nunca escreve nada no disco.
 */
const SENHA = emCasa ? 'nohora2026' : process.env.SEED_PASSWORD || null

const sql = ligar()

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
            ['scrypt', 16384, 8, 1, salt.toString('base64url'), key.toString('base64url')].join('$'),
          )
      },
    )
  })
}

/** Aleatório com semente: duas corridas dão a mesma agenda. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260822)
const pick = (list) => list[Math.floor(rand() * list.length)]

/** Instantes na hora de Lisboa (verão = UTC+1). */
function onDay(offsetDays, hour, minute) {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`
}
const atMinute = (offsetDays, minutes) =>
  onDay(offsetDays, Math.floor(minutes / 60), minutes % 60)
function dateOf(offsetDays) {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}
const weekdayOf = (offsetDays) => {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  return now.getUTCDay()
}

const ORG_SLUG = 'nohora-ramirez'
const min = (h, m = 0) => h * 60 + m

// ---------------------------------------------------------------------
// O catálogo — 67 serviços, preçário igual nas duas lojas
// ---------------------------------------------------------------------
//
// [nome, preço em euros, duração em minutos, origem]
//
//   'dito'    ela disse o número
//   'deduz'   deduzido de um serviço parecido que ela disse
//   'palpite' ninguém disse nada — a lista está em CONTEUDO.md
//
// Nove serviços de cabelo têm preço e tempo diferentes conforme o
// comprimento. O esquema não tem variantes, portanto são dois serviços.
//
// Quando ela deu um intervalo ("30 a 40") fica o valor de cima:
// reservar 45 e acabar em 30 devolve tempo à agenda, reservar 30 e
// demorar 45 estraga a tarde inteira.

const CATALOGO = [
  {
    slug: 'cabelo',
    nome: 'Cabelo',
    servicos: [
      ['Brushing · cabelo curto', 15, 30, 'deduz'],
      ['Brushing · cabelo comprido', 20, 40, 'dito'],
      ['Brushing (ondas babyliss)', 25, 60, 'palpite'],
      ['Corte senhora (s/ brushing)', 15, 90, 'dito'],
      ['Corte criança (até 8 anos)', 10, 30, 'palpite'],
      ['Franja', 10, 15, 'palpite'],
      ['Lavar sem secar', 10, 15, 'palpite'],
      ['Penteados · cabelo curto', 35, 60, 'deduz'],
      ['Penteados · cabelo comprido', 45, 90, 'deduz'],
      ['Madeixas + Brushing · cabelo curto', 80, 120, 'palpite'],
      ['Madeixas + Brushing · cabelo comprido', 100, 180, 'palpite'],
      ['Balayage / Babylights / Ombré · cabelo curto', 120, 180, 'dito'],
      ['Balayage / Babylights / Ombré · cabelo comprido', 150, 240, 'dito'],
    ],
  },
  {
    slug: 'coloracao',
    nome: 'Coloração',
    servicos: [
      ['Coloração raíz', 50, 90, 'dito'],
      ['Coloração raíz (s/ amoníaco)', 50, 90, 'deduz'],
      ['Coloração (inoa)', 50, 90, 'deduz'],
      ['Descoloração raíz', 60, 90, 'palpite'],
      ['Descoloração total', 90, 150, 'palpite'],
      ['Matização', 30, 45, 'palpite'],
    ],
  },
  {
    slug: 'tratamentos-capilares',
    nome: 'Tratamentos capilares',
    servicos: [
      ['Botox capilar · cabelo curto', 80, 90, 'palpite'],
      ['Botox capilar · cabelo comprido', 120, 120, 'palpite'],
      ['Alisamento · cabelo curto', 100, 120, 'palpite'],
      ['Alisamento · cabelo comprido', 180, 180, 'palpite'],
      ['Permanente · cabelo curto', 60, 90, 'palpite'],
      ['Permanente · cabelo comprido', 100, 120, 'palpite'],
      ['Tratamento Truss · cabelo curto', 40, 60, 'palpite'],
      ['Tratamento Truss · cabelo comprido', 60, 90, 'palpite'],
      ['Tratamento Brae · cabelo curto', 40, 60, 'palpite'],
      ['Tratamento Brae · cabelo comprido', 60, 90, 'palpite'],
      ['Tratamento plex', 30, 45, 'palpite'],
      ['Ampola', 15, 30, 'palpite'],
      ['Máscara básica', 5, 20, 'palpite'],
    ],
  },
  {
    slug: 'barbearia',
    nome: 'Barbearia',
    servicos: [
      ['Corte masculino', 15, 30, 'dito'],
      ['Barba (navalha)', 15, 30, 'palpite'],
      ['Barba (tesoura / máquina)', 10, 20, 'palpite'],
      ['Aparar bigode', 6, 10, 'palpite'],
    ],
  },
  {
    slug: 'maos-e-pes',
    nome: 'Mãos e Pés',
    servicos: [
      ['Manicure normal', 15, 45, 'dito'],
      ['Verniz gel extra-forte', 20, 60, 'dito'],
      ['Manutenção gel', 25, 90, 'dito'],
      ['Manutenção acrílico', 30, 90, 'deduz'],
      ['Manutenção cliente nova', 30, 90, 'deduz'],
      ['Aplicação gel', 30, 120, 'dito'],
      ['Aplicação acrílico', 30, 120, 'dito'],
      ['Remoção gel', 15, 30, 'palpite'],
      ['Nail art elaborada (+2 unhas)', 30, 30, 'palpite'],
      ['Pintura e cutículas', 20, 30, 'palpite'],
      ['Verniz normal (mãos)', 10, 20, 'palpite'],
      ['Verniz normal (pés)', 20, 30, 'palpite'],
      ['Pedicure completa', 25, 60, 'dito'],
      ['Pedicure completa + verniz normal', 30, 75, 'palpite'],
      ['Pedicure completa + verniz gel', 35, 90, 'palpite'],
    ],
  },
  {
    slug: 'rosto',
    nome: 'Tratamentos de rosto',
    servicos: [
      ['Sobrancelha', 10, 15, 'palpite'],
      ['Sobrancelha a linha', 15, 20, 'palpite'],
      ['Buço', 6, 10, 'palpite'],
      ['Queixo', 6, 10, 'palpite'],
      ['Aplicação de Henna', 18, 30, 'palpite'],
      ['Limpeza facial simples', 32, 45, 'palpite'],
      ['Limpeza facial c/ peeling', 50, 60, 'palpite'],
      ['Maquilhagem simples', 35, 60, 'deduz'],
      ['Maquilhagem elaborada', 50, 90, 'deduz'],
    ],
  },
  {
    slug: 'corpo',
    nome: 'Corpo (cera)',
    servicos: [
      ['Axilas', 8, 15, 'palpite'],
      ['Meia perna', 12, 20, 'palpite'],
      ['Perna completa', 20, 30, 'palpite'],
      ['Virilha completa', 20, 20, 'palpite'],
      ['Peito e abdómen', 20, 30, 'palpite'],
      ['Braços', 15, 20, 'palpite'],
      ['Costas', 15, 20, 'palpite'],
    ],
  },
]

// ---------------------------------------------------------------------
// As lojas
// ---------------------------------------------------------------------

const LOJAS = [
  {
    slug: 'valongo',
    nome: 'Valongo',
    morada: 'Centro Comercial Continente Valongo, Loja 07',
    cidade: 'Valongo',
    // PALPITE: ela não deu o horário da loja. Segunda a sábado das 9
    // às 21 cobre a escala de todas as que lá trabalham.
    horario: [1, 2, 3, 4, 5, 6].map((d) => [d, 9, 21]),
    fotos: [
      ['01-montra.jpg', 'A montra do salão, vista do corredor'],
      ['02-colorbar.jpg', 'O balcão de coloração'],
      ['03-lavagem.jpg', 'A zona de lavagem'],
      ['04-sala.jpg', 'A sala de cortes'],
      ['05-maquilhagem.jpg', 'O canto da maquilhagem'],
      ['06-colorbar-lavagem.jpg', 'O balcão de coloração e a lavagem'],
    ],
  },
  {
    slug: 'maia',
    nome: 'Maia',
    morada: 'PCT Zona Comercial Chantre, Loja 19',
    cidade: 'Maia',
    // PALPITE: 09:00-20:00 foi o que ela disse. Os dias, não.
    horario: [1, 2, 3, 4, 5, 6].map((d) => [d, 9, 20]),
    fotos: [
      ['01-lavagem.jpg', 'A zona de lavagem'],
      ['02-espelhos.jpg', 'Os espelhos da sala'],
      ['03-cadeiras.jpg', 'As cadeiras de atendimento'],
    ],
  },
]

// ---------------------------------------------------------------------
// A equipa — weekday: 0 domingo … 6 sábado
// ---------------------------------------------------------------------
//
// Os telemóveis são inventados (menos o da dona): ela ainda não os deu.
// Servem para entrar no sistema e trocam-se na ficha de cada uma.
//
// Sem `alias`: quem aparece no site é o nome próprio. O nome público só
// se escreve quando alguém não quer o seu no sítio — e escreve-se na
// gestão, não aqui. Chegou a estar «Profissional 1» a fazer de reserva e
// era isso que as clientes liam.

const EQUIPA = [
  {
    nome: 'Ariadna',
    telefone: '+351930000001',
    cor: '#B08968',
    loja: 'valongo',
    papel: 'professional',
    categorias: ['cabelo', 'coloracao', 'tratamentos-capilares', 'barbearia'],
    escala: [[2, 9, 21], [3, 9, 21], [4, 9, 21], [5, 9, 21], [6, 9, 21]],
  },
  {
    nome: 'Adyr',
    telefone: '+351930000002',
    cor: '#8C7A6B',
    loja: 'valongo',
    papel: 'professional',
    categorias: ['cabelo', 'coloracao', 'tratamentos-capilares', 'barbearia'],
    // Os "domingos alternados" não estão aqui: ela não disse quais. Ou
    // se define a regra, ou abrem-se à mão na gestão, um a um.
    escala: [[1, 14, 21], [3, 10, 21], [4, 14, 21], [5, 10, 21], [6, 10, 21]],
  },
  {
    nome: 'Nana',
    telefone: '+351930000003',
    cor: '#C6A96B',
    loja: 'valongo',
    papel: 'professional',
    categorias: ['maos-e-pes'],
    escala: [[1, 10, 18], [2, 10, 18], [4, 9, 17]],
  },
  {
    nome: 'Filipa',
    telefone: '+351930000004',
    cor: '#A47C6F',
    loja: 'valongo',
    papel: 'professional',
    // PALPITE: ela não disse o que a Filipa faz. O cabelo está coberto
    // pelas outras duas e as unhas pela Nana; fica com a estética,
    // senão ninguém faz cera nem rosto em Valongo.
    categorias: ['rosto', 'corpo'],
    escala: [[1, 9, 18], [2, 9, 15], [3, 9, 18], [5, 9, 21], [6, 9, 21]],
  },
  {
    nome: 'Nohora Ramirez',
    telefone: '+351934730344',
    cor: '#9C8F7A',
    loja: 'maia',
    papel: 'owner',
    // Cabeleireira unisexo, sozinha na Maia. Sem mais ninguém lá, a
    // loja só marca o que ela faz: unhas e estética ficam de fora.
    categorias: ['cabelo', 'coloracao', 'tratamentos-capilares', 'barbearia'],
    // PALPITE: ela deu a hora (09:00-20:00), não deu os dias.
    escala: [[1, 9, 20], [2, 9, 20], [3, 9, 20], [4, 9, 20], [5, 9, 20], [6, 9, 20]],
  },
]

// Clientes de teste. Fictícias — ver o cabeçalho.
const CLIENTES = [
  ['Ana Sofia Moreira', '+351962000001', 'ana.moreira@gmail.com', ['vip'], 0],
  ['Cátia Pinto', '+351962000002', null, [], 0],
  ['Rita Azevedo', '+351962000003', 'rita.azevedo@sapo.pt', [], 0],
  ['Sandra Leal', '+351962000004', null, ['alergia'], 0],
  ['Teresa Magalhães', '+351962000005', 'teresa.m@icloud.com', ['vip'], 0],
  ['Bruno Carvalho', '+351962000006', null, [], 2],
  ['Carolina Sousa', '+351962000007', 'carol.sousa@gmail.com', [], 0],
  ['Inês Ferreira', '+351962000008', null, [], 0],
  ['Helena Braga', '+351962000009', 'h.braga@gmail.com', ['noiva'], 0],
  ['Marta Oliveira', '+351962000010', null, [], 0],
  ['Beatriz Correia', '+351962000011', null, [], 1],
  ['Laura Teixeira', '+351962000012', 'laura.t@outlook.com', [], 0],
  ['Diogo Faria', '+351962000013', null, [], 0],
  ['Patrícia Rocha', '+351962000014', 'p.rocha@gmail.com', [], 0],
]

// ---------------------------------------------------------------------

const totalServicos = CATALOGO.reduce((n, c) => n + c.servicos.length, 0)
const origens = { dito: 0, deduz: 0, palpite: 0 }

function resumo(marcacoes, faturado) {
  console.log('')
  console.log('  Rede ........ Nohora Ramirez')
  console.log('  Lojas ....... Valongo (6 fotos) e Maia (3 fotos)')
  console.log(`  Serviços .... ${totalServicos} em ${CATALOGO.length} categorias`)
  console.log(`                ${origens.dito} com o tempo dito por ela`)
  console.log(`                ${origens.deduz} deduzidos de serviços parecidos`)
  console.log(`                ${origens.palpite} a palpite — a lista está em CONTEUDO.md`)
  if (marcacoes) {
    console.log(
      `  Movimento ... ${marcacoes} marcações de teste, ${(faturado / 100).toFixed(2)} € faturados`,
    )
    console.log('                (fictício; sem `--com-movimento` não é semeado)')
  } else {
    console.log('  Movimento ... nenhum — só o salão')
  }
  console.log('')
  if (SENHA) {
    console.log('  Entrar em /entrar com a palavra-passe do seed:')
  } else {
    console.log('  A equipa ficou SEM palavra-passe. Dê uma à dona com')
    console.log(`    node scripts/_prod.mjs senha ${EQUIPA.find((p) => p.papel === 'owner')?.telefone ?? ''}`)
    console.log('  e as outras definem-se na gestão, em Equipa.')
  }
  for (const p of EQUIPA) {
    const papel = p.papel === 'owner' ? 'dona, rede toda' : `profissional, ${p.loja}`
    console.log(`    ${p.telefone}  ${p.nome}`.padEnd(52) + papel)
  }
  console.log('')
}

try {
  // Reset total. `delete` não chega: há tabelas (payment, cash_movement)
  // cuja chave para unit não cascateia, e o apagar bate na parede.
  await sql`truncate table org cascade`

  const [org] = await sql`
    insert into org (name, slug, timezone, currency, default_language, whatsapp_phone)
    values ('Nohora Ramirez', ${ORG_SLUG}, 'Europe/Lisbon', 'EUR', 'pt', '+351934730344')
    returning id
  `
  const orgId = org.id

  // --- lojas ---------------------------------------------------------
  const lojas = new Map()
  for (const [i, l] of LOJAS.entries()) {
    const [unit] = await sql`
      insert into unit (org_id, slug, name, timezone, address_line, city, country,
                        phone, whatsapp_phone, min_lead_minutes, max_lead_days,
                        slot_granularity_minutes, cancel_window_hours, sort_order)
      values (${orgId}, ${l.slug}, ${l.nome}, 'Europe/Lisbon',
              ${l.morada}, ${l.cidade}, 'PT',
              '+351934730344', '+351934730344', 120, 60, 15, 24, ${i})
      returning id
    `
    lojas.set(l.slug, unit.id)

    for (const [dia, abre, fecha] of l.horario) {
      await sql`
        insert into business_hours (unit_id, weekday, opens_min, closes_min)
        values (${unit.id}, ${dia}, ${min(abre)}, ${min(fecha)})
      `
    }
    for (const [j, [ficheiro, alt]] of l.fotos.entries()) {
      await sql`
        insert into unit_photo (unit_id, url, alt, sort_order)
        values (${unit.id}, ${`/fotos/${l.slug}/${ficheiro}`}, ${alt}, ${j})
      `
    }
  }

  // --- catálogo ------------------------------------------------------
  const porCategoria = new Map()

  for (const [i, cat] of CATALOGO.entries()) {
    const [row] = await sql`
      insert into service_category (org_id, slug, name, sort_order)
      values (${orgId}, ${cat.slug}, ${cat.nome}, ${i})
      returning id
    `
    const lista = []
    for (const [j, [nome, euros, minutos, origem]] of cat.servicos.entries()) {
      const slug = nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)
      const [s] = await sql`
        insert into service (org_id, category_id, slug, name,
                             base_price_cents, duration_minutes, sort_order)
        values (${orgId}, ${row.id}, ${slug}, ${nome},
                ${euros * 100}, ${minutos}, ${j})
        returning id
      `
      lista.push({ id: s.id, name: nome, priceCents: euros * 100, minutes: minutos })
      origens[origem]++
    }
    porCategoria.set(cat.slug, lista)
  }

  // --- equipa --------------------------------------------------------
  const passwordHash = SENHA ? await hashPassword(SENHA) : null
  const equipa = []

  for (const [i, p] of EQUIPA.entries()) {
    const unitId = lojas.get(p.loja)
    const [s] = await sql`
      insert into staff (org_id, name, public_alias, phone, password_hash,
                         display_color, sort_order)
      values (${orgId}, ${p.nome}, ${p.alias ?? null}, ${p.telefone},
              ${passwordHash}, ${p.cor}, ${i})
      returning id
    `
    await sql`
      insert into staff_role (staff_id, role, unit_id)
      values (${s.id}, ${p.papel}, ${p.papel === 'owner' ? null : unitId})
    `
    await sql`insert into staff_unit (staff_id, unit_id) values (${s.id}, ${unitId})`

    // A dona atende na Maia mas manda nas duas: precisa de lá pôr os pés.
    if (p.papel === 'owner') {
      await sql`
        insert into staff_unit (staff_id, unit_id)
        values (${s.id}, ${lojas.get('valongo')})
        on conflict do nothing
      `
    }

    const skills = p.categorias.flatMap((c) => porCategoria.get(c) ?? [])
    for (const servico of skills) {
      await sql`insert into staff_skill (staff_id, service_id) values (${s.id}, ${servico.id})`
    }

    for (const [dia, entra, sai] of p.escala) {
      await sql`
        insert into staff_schedule (staff_id, unit_id, weekday, starts_min, ends_min, valid_from)
        values (${s.id}, ${unitId}, ${dia}, ${min(entra)}, ${min(sai)},
                current_date - interval '1 year')
      `
    }

    equipa.push({ ...p, id: s.id, unitId, skills })
  }

  const dona = equipa.find((p) => p.papel === 'owner')

  // PALPITE: ela ainda não falou de comissões. 30% é o valor de partida
  // do sistema; muda-se na gestão sem tocar em código.
  await sql`
    insert into commission_rule (org_id, staff_id, service_id, percent)
    values (${orgId}, null, null, 30)
  `

  if (!MOVIMENTO) {
    resumo(0, 0)
  } else {
    // -----------------------------------------------------------------
    // MOVIMENTO DE TESTE — clientes e marcações inventadas
    // -----------------------------------------------------------------
    const clientIds = []
    for (const [nome, telefone, email, tags, faltas] of CLIENTES) {
      const [row] = await sql`
        insert into client (org_id, phone, name, email, tags, no_show_count,
                            preferred_unit_id, language)
        values (${orgId}, ${telefone}, ${nome}, ${email}, ${tags}, ${faltas},
                ${rand() < 0.75 ? lojas.get('valongo') : lojas.get('maia')}, 'pt')
        returning id
      `
      clientIds.push(row.id)
    }
    await sql`
      insert into client_note (client_id, author_id, body)
      values (${clientIds[3]}, ${equipa[2].id}, 'Alergia a acetona — usar removedor sem acetona.'),
             (${clientIds[0]}, ${equipa[0].id}, 'Base 7.1 no último retoque. Prefere marcar ao fim da tarde.'),
             (${clientIds[8]}, ${equipa[3].id}, 'Casamento em Outubro — prova de maquilhagem duas semanas antes.')
    `

    /** Marcação completa: envelope + item + bloco + evento de estado. */
    async function marcar({ unitId, clientId, staffId, service, startsAt, status, source }) {
      const start = new Date(startsAt)
      const end = new Date(start.getTime() + service.minutes * 60000)
      const [appt] = await sql`
        insert into appointment (org_id, unit_id, client_id, status, source,
                                 starts_at, ends_at, created_by_staff_id)
        values (${orgId}, ${unitId}, ${clientId}, ${status}, ${source},
                ${start.toISOString()}, ${end.toISOString()}, ${dona.id})
        returning id
      `
      const [item] = await sql`
        insert into appointment_item (appointment_id, service_id, staff_id, starts_at,
                                      ends_at, price_cents, duration_minutes, service_name)
        values (${appt.id}, ${service.id}, ${staffId}, ${start.toISOString()},
                ${end.toISOString()}, ${service.priceCents}, ${service.minutes}, ${service.name})
        returning id
      `
      if (!status.startsWith('cancelled')) {
        await sql`
          insert into staff_block (staff_id, unit_id, appointment_item_id, during)
          values (${staffId}, ${unitId}, ${item.id},
                  tstzrange(${start.toISOString()}, ${end.toISOString()}))
        `
      }
      await sql`
        insert into appointment_status_event (appointment_id, from_status, to_status, by_staff_id)
        values (${appt.id}, null, ${status}, ${dona.id})
      `
      return { apptId: appt.id, itemId: item.id }
    }

    /** Fecha a comanda: pagamento e comissão congelada a 30%. */
    async function fechar({ apptId, itemId }, { unitId, staffId, service, whenIso }) {
      await sql`
        update appointment set closed_at = ${whenIso}, closed_by_staff_id = ${staffId}
        where id = ${apptId}
      `
      const method = pick(['cash', 'cash', 'debit', 'debit', 'debit', 'credit'])
      const [pay] = await sql`
        insert into payment (appointment_id, unit_id, method, amount_cents,
                             received_by_staff_id, received_at)
        values (${apptId}, ${unitId}, ${method}, ${service.priceCents}, ${staffId}, ${whenIso})
        returning id
      `
      const amount = Math.round((service.priceCents * 30) / 100)
      const pago = rand() < 0.55
      await sql`
        insert into commission_entry (org_id, unit_id, appointment_id, appointment_item_id,
                                      staff_id, item_price_cents, discount_share_cents,
                                      base_cents, percent, amount_cents, status,
                                      paid_at, generated_at)
        values (${orgId}, ${unitId}, ${apptId}, ${itemId}, ${staffId},
                ${service.priceCents}, 0, ${service.priceCents}, 30, ${amount},
                ${pago ? 'paid' : 'pending'}, ${pago ? whenIso : null}, ${whenIso})
      `
      return pay.id
    }

    /**
     * Enche o dia de uma profissional dentro da escala dela.
     * O cursor anda com a duração de cada serviço, portanto nunca há
     * dois blocos sobrepostos — que é o que a exclusão GiST proíbe.
     */
    async function encherDia(pro, offset, ocupacao, futuro) {
      const dia = weekdayOf(offset)
      const turno = pro.escala.find(([d]) => d === dia)
      if (!turno) return
      const fim = min(turno[2])
      let cursor = min(turno[1]) + (rand() < 0.5 ? 0 : 30)

      while (cursor < fim) {
        if (rand() > ocupacao) {
          cursor += 30
          continue
        }
        const service = pick(pro.skills)
        if (cursor + service.minutes > fim) break

        const roll = rand()
        let status
        if (futuro) status = roll < 0.5 ? 'confirmed' : 'booked'
        else if (roll < 0.05) status = 'no_show'
        else if (roll < 0.09) status = 'cancelled_by_client'
        else status = 'completed'

        const made = await marcar({
          unitId: pro.unitId,
          clientId: pick(clientIds),
          staffId: pro.id,
          service,
          startsAt: atMinute(offset, cursor),
          status,
          source: pick(['site', 'site', 'counter', 'phone', 'whatsapp']),
        })
        if (status === 'completed') {
          await fechar(made, {
            unitId: pro.unitId,
            staffId: pro.id,
            service,
            whenIso: atMinute(offset, Math.min(cursor + service.minutes + 5, fim)),
          })
        }
        cursor += service.minutes + pick([0, 15, 15, 30])
      }
    }

    // Seis semanas de histórico fechado, para os relatórios terem carne.
    for (let d = 42; d >= 1; d--) {
      for (const pro of equipa) await encherDia(pro, -d, 0.55, false)
    }

    // Hoje: as primeiras já saíram, uma está na cadeira, o resto vem a
    // caminho. É a tela que ele vai abrir primeiro.
    const vendasDeHoje = []
    for (const pro of equipa) {
      const turno = pro.escala.find(([d]) => d === weekdayOf(0))
      if (!turno) continue
      const fim = min(turno[2])
      let cursor = min(turno[1])
      let i = 0
      while (cursor < fim && i < 6) {
        const service = pick(pro.skills)
        if (cursor + service.minutes > fim) break
        const status =
          i < 2 ? 'completed'
          : i === 2 ? 'in_service'
          : i === 3 ? 'checked_in'
          : rand() < 0.5 ? 'confirmed' : 'booked'
        const made = await marcar({
          unitId: pro.unitId,
          clientId: pick(clientIds),
          staffId: pro.id,
          service,
          startsAt: atMinute(0, cursor),
          status,
          source: pick(['site', 'site', 'counter', 'whatsapp']),
        })
        if (status === 'completed') {
          const payId = await fechar(made, {
            unitId: pro.unitId,
            staffId: pro.id,
            service,
            whenIso: atMinute(0, cursor + service.minutes + 5),
          })
          vendasDeHoje.push({ unitId: pro.unitId, staffId: pro.id, service, payId, apptId: made.apptId })
        }
        cursor += service.minutes + pick([0, 15, 30])
        i++
      }
    }

    // Três semanas de marcações futuras — é o que a agenda vai mostrar.
    for (let d = 1; d <= 21; d++) {
      for (const pro of equipa) await encherDia(pro, d, 0.35, true)
    }

    // Caixa de hoje aberto em cada loja, com as vendas da manhã lançadas.
    for (const unitId of lojas.values()) {
      const [cash] = await sql`
        insert into cash_session (unit_id, business_date, status, opening_cents, opened_by_staff_id)
        values (${unitId}, ${dateOf(0)}, 'open', 5000, ${dona.id})
        returning id
      `
      for (const v of vendasDeHoje.filter((x) => x.unitId === unitId)) {
        await sql`
          insert into cash_movement (cash_session_id, kind, amount_cents, payment_id,
                                     appointment_id, by_staff_id)
          values (${cash.id}, 'sale', ${v.service.priceCents}, ${v.payId}, ${v.apptId}, ${v.staffId})
        `
      }
    }

    const [{ count }] = await sql`select count(*)::int as count from appointment`
    const [{ sum }] = await sql`select coalesce(sum(amount_cents),0)::int as sum from payment`
    resumo(count, sum)
  }
} catch (error) {
  console.error('Falhou:', error?.message ?? error)
  if (error?.detail) console.error('detalhe:', error.detail)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
