/**
 * SEMEAR A CASA DE DEMONSTRAÇÃO.
 *
 * Enche uma base vazia com quatro meses de vida de um salão: as lojas e
 * os horários, o preçário, a equipa com a escala, as folgas e os
 * domingos, umas mil e quinhentas clientes e as marcações delas — as que
 * já foram, as de hoje e as das três semanas seguintes —, com os estados
 * por que passaram, os avisos que se mandaram e as notas que a equipa
 * foi escrevendo. É a casa que se grava para os anúncios e que se mostra
 * a quem ainda não é cliente.
 *
 * TUDO É CONTADO A PARTIR DE AGORA. O passado acaba agora, a agenda de
 * hoje vai a meio e a de amanhã tem os lembretes por mandar. Por isso
 * semeia-se no próprio dia da gravação, e de preferência com a casa
 * aberta: é isso que põe gente na cadeira no ecrã de hoje.
 *
 * APAGA O QUE LÁ ESTIVER. Só corre numa base vazia ou numa que já seja a
 * da demonstração — reconhecida pelo `slug` da rede, em dados.mjs. Uma
 * base com outra casa lá dentro é recusada, e o servidor é dito em voz
 * alta antes de se tocar em nada.
 *
 *   npm run semear                  apaga e semeia
 *   npm run semear -- --ensaio      faz as contas todas e mostra-as, sem
 *                                   ligar a base nenhuma
 *   npm run semear -- --apagar-tudo só numa base LOCAL: passa por cima
 *                                   de outra casa que lá esteja
 *   npm run semear -- --ensaio --agora=2026-10-02T11:30
 *                                   o ensaio, a fingir outra hora
 *
 * Os dados são os de instalacoes/<NEXT_PUBLIC_INSTALACAO>/dados.mjs. A
 * Nohora não tem esse ficheiro, e é de propósito: sem ele, isto não corre.
 *
 * A palavra-passe da equipa é a da DEMO_SENHA, se estiver definida; senão
 * é sorteada e mostrada no fim — no ecrã, uma vez, e em mais sítio nenhum.
 */
import { randomBytes, randomUUID, scrypt } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { hostOf, isLocal, ligar, loadEnv } from './_ligar.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ENSAIO = process.argv.includes('--ensaio')
const APAGAR_TUDO = process.argv.includes('--apagar-tudo')

function falha(...linhas) {
  for (const linha of linhas) console.error(linha)
  process.exit(1)
}

loadEnv()

const INSTALACAO = process.env.NEXT_PUBLIC_INSTALACAO || 'nohora'
const PASTA = join(root, 'instalacoes', INSTALACAO)
const FICHEIRO = join(PASTA, 'dados.mjs')

if (!/^[a-z0-9-]+$/.test(INSTALACAO) || !existsSync(FICHEIRO)) {
  falha(
    `A instalação «${INSTALACAO}» não tem dados.mjs — não há casa para semear.`,
    'Para a demonstração: defina NEXT_PUBLIC_INSTALACAO=demo no .env.',
  )
}

const dados = await import(pathToFileURL(FICHEIRO).href)

const { REDE, LOJAS, CATALOGO, EQUIPA, CLIENTELA, NOMES } = dados
for (const [nome, valor] of Object.entries({ REDE, LOJAS, CATALOGO, EQUIPA, CLIENTELA, NOMES })) {
  if (!valor) falha(`instalacoes/${INSTALACAO}/dados.mjs não exporta ${nome}.`)
}
if (!REDE.slug) {
  falha('dados.mjs: a REDE precisa de um slug fixo — é por ele que se reconhece a base.')
}

// O resto tem valor por omissão: uma casa sem feriados, sem domingo ou
// sem notas também se semeia.
const COMBINACOES = dados.COMBINACOES ?? []
const DOMINGO = dados.DOMINGO ?? null
const AUSENCIAS = dados.AUSENCIAS ?? []
const feriados = dados.feriados ?? (() => [])
const MEIOS_DIAS = dados.MEIOS_DIAS ?? []
const RITMO = dados.RITMO ?? {}
const NOMES_PROIBIDOS = dados.NOMES_PROIBIDOS ?? []
const BEBIDAS = dados.BEBIDAS ?? []
const ALERGIAS = dados.ALERGIAS ?? []
const NOTAS_DE_SERVICO = dados.NOTAS_DE_SERVICO ?? {}
const NOTAS_INTERNAS = dados.NOTAS_INTERNAS ?? {}
const NOTAS_DA_CLIENTE = dados.NOTAS_DA_CLIENTE ?? {}
const NOTAS_DA_MARCACAO = dados.NOTAS_DA_MARCACAO ?? {}
const MOTIVOS = dados.MOTIVOS ?? {}

/**
 * As categorias que se marcam ao domingo vêm do sítio onde a aplicação
 * as decide, e não de uma cópia: um domingo semeado com manicures que a
 * montra depois diz «sob consulta» era uma agenda que a casa não pode ter.
 */
function categoriasDeDomingo() {
  const texto = readFileSync(join(root, 'lib', 'sunday.ts'), 'utf8')
  const lista = /SUNDAY_CATEGORIES[^=]*=\s*\[([^\]]*)\]/.exec(texto)
  if (!lista) falha('lib/sunday.ts: não encontrei a SUNDAY_CATEGORIES.')
  return new Set([...lista[1].matchAll(/'([^']+)'/g)].map((m) => m[1]))
}

const DE_DOMINGO = categoriasDeDomingo()

/** As famílias que são só deles — e que eles fazem sozinhas. */
const DELES = new Set(['barbearia'])

// ---------------------------------------------------------------------
// A base: confere-se antes de fazer contas
// ---------------------------------------------------------------------

let sql = null

if (!ENSAIO) {
  const url = process.env.DATABASE_URL
  if (!url) falha('Falta a DATABASE_URL (no .env ou no ambiente).')
  console.log(`> semear «${REDE.nome}» (instalação ${INSTALACAO}) em ${hostOf(url)}\n`)
  sql = ligar({ idle_timeout: 5 })
  await confereBase(url)
}

/*
 * A GUARDA. O semear começa por apagar a rede inteira, e um `truncate`
 * não tem volta. Por isso só avança se a base estiver vazia ou se a casa
 * que lá está for esta mesma demonstração — e o slug que o diz é fixo em
 * dados.mjs, não se tira do nome. Uma base com outra casa é recusada
 * sempre; a única excepção é uma base local, com --apagar-tudo escrito à
 * mão, que é o caso de quem está a testar na própria máquina.
 */
async function confereBase(url) {
  let casas
  try {
    casas = (await sql`select slug from org`).map((r) => r.slug)
  } catch (error) {
    await sql.end({ timeout: 5 })
    if (error?.code === '42P01') {
      falha('A base ainda não tem as tabelas. Corra primeiro: npm run db:migrate')
    }
    falha('Não consegui ler a base:', error?.message ?? error)
  }

  const alheias = casas.filter((slug) => slug !== REDE.slug)
  if (alheias.length > 0 && !(isLocal(url) && APAGAR_TUDO)) {
    await sql.end({ timeout: 5 })
    falha(
      `Recusado: a base em ${hostOf(url)} tem outra casa lá dentro (${alheias.join(', ')}).`,
      'O semear apaga tudo, por isso só corre numa base vazia ou numa base de demonstração.',
      ...(isLocal(url) ? ['Numa base local, --apagar-tudo passa por cima disto.'] : []),
    )
  }

  // Uma migração por aplicar partia o semear a meio, com um erro de
  // coluna que não diz o que falta fazer.
  const [{ existe }] = await sql`
    select to_regclass('public.schema_migrations') is not null as existe
  `
  if (existe) {
    const feitas = new Set(
      (await sql`select name from public.schema_migrations`).map((r) => r.name),
    )
    const faltam = readdirSync(join(root, 'supabase', 'migrations')).filter(
      (nome) => nome.endsWith('.sql') && !feitas.has(nome),
    )
    if (faltam.length > 0) {
      await sql.end({ timeout: 5 })
      falha(`Há ${faltam.length} migração(ões) por aplicar. Corra primeiro: npm run db:migrate`)
    }
  }
}

// ---------------------------------------------------------------------
// O sorteio
// ---------------------------------------------------------------------

/*
 * SEMPRE O MESMO SORTEIO. Com a mesma semente e no mesmo dia sai a mesma
 * casa, o que deixa afinar um número em dados.mjs e ver o efeito dele —
 * e não o de um sorteio novo. Os identificadores e os links das clientes
 * é que mudam de cada vez: esses não se podem adivinhar.
 */
function mulberry32(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20261001)
const chance = (p) => rand() < p
/** Inteiro entre `a` e `b`, os dois incluídos. */
const entre = (a, b) => a + Math.floor(rand() * (b - a + 1))
const escolhe = (lista) => lista[Math.floor(rand() * lista.length)]

/** Sorteio com pesos, sobre pares [valor, peso]. Nulo se ninguém pesar nada. */
function sorteia(pares) {
  let total = 0
  for (const [, peso] of pares) total += peso
  if (!(total > 0)) return null
  let r = rand() * total
  let ultimo = null
  for (const [valor, peso] of pares) {
    if (peso <= 0) continue
    ultimo = valor
    r -= peso
    if (r < 0) return valor
  }
  return ultimo
}

// ---------------------------------------------------------------------
// O relógio
// ---------------------------------------------------------------------

const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA

const TZ = REDE.fuso ?? 'Europe/Lisbon'

const fmtDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const fmtDesvio = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })

/** O dia de calendário, no fuso da casa, de um instante. */
const diaDe = (ms) => fmtDia.format(new Date(ms))

/*
 * A HORA DE PAREDE. As escalas e os horários são «às 9h30 em Lisboa», e
 * a base guarda instantes. O desvio muda duas vezes por ano, e muda
 * sempre a uma hora certa de UTC — por isso guarda-se por hora.
 */
const desvios = new Map()
function desvio(ms) {
  const hora = Math.floor(ms / HORA)
  let d = desvios.get(hora)
  if (d === undefined) {
    const nome =
      fmtDesvio.formatToParts(new Date(hora * HORA)).find((p) => p.type === 'timeZoneName')
        ?.value ?? ''
    const m = /([+-])(\d{1,2})(?::(\d{2}))?/.exec(nome)
    d = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) * MIN : 0
    desvios.set(hora, d)
  }
  return d
}

/** O instante de «dia, a tantos minutos da meia-noite», no fuso da casa. */
function instante(dia, minutos) {
  const parede = Date.parse(`${dia}T00:00:00Z`) + minutos * MIN
  const primeira = parede - desvio(parede)
  return parede - desvio(primeira)
}

/** Minutos desde a meia-noite, no fuso da casa. */
function minutoDoDia(ms) {
  const parede = ms + desvio(ms)
  return Math.floor((((parede % DIA) + DIA) % DIA) / MIN)
}

function somaDias(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const diaDaSemana = (dia) => new Date(`${dia}T12:00:00Z`).getUTCDay()
const diasEntre = (a, b) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA)
const hhmm = (texto) => {
  const [h, m] = texto.split(':').map(Number)
  return h * 60 + m
}
const iso = (ms) => new Date(Math.floor(ms)).toISOString()
const teto15 = (minutos) => Math.ceil(minutos / 15) * 15
const dois = (n) => String(n).padStart(2, '0')

/*
 * Um só «agora» para o guião inteiro: o que já passou não muda a meio.
 * No ensaio pode fingir-se outra hora, em hora da casa, para ver a agenda
 * de hoje a meio do dia. A semear, nunca: uma base semeada para uma hora
 * que não é a de agora nascia a mentir.
 */
const FINGIDO = process.argv.find((a) => a.startsWith('--agora='))?.slice('--agora='.length)
if (FINGIDO && !ENSAIO) falha('O --agora só serve para o ensaio.')
if (FINGIDO && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(FINGIDO)) {
  falha('O --agora quer o dia e a hora da casa: --agora=2026-10-02T11:30')
}
const AGORA = FINGIDO ? instante(FINGIDO.slice(0, 10), hhmm(FINGIDO.slice(11))) : Date.now()

const HOJE = diaDe(AGORA)
const AGORA_MIN = minutoDoDia(AGORA)

/** Quantos dias de passado e de futuro. */
const HIST = 120
const FUT = 21
const INICIO = somaDias(HOJE, -HIST)

/** A casa abriu antes do passado que se semeia; as clientes antigas vieram do sistema anterior. */
const FUNDACAO = instante(somaDias(INICIO, -60), 10 * 60)
const IMPORTACAO = instante(somaDias(INICIO, -45), 11 * 60)

// ---------------------------------------------------------------------
// As linhas, tabela a tabela — pela ordem em que entram na base
// ---------------------------------------------------------------------

const T = {
  org: [],
  unit: [],
  unit_photo: [],
  business_hours: [],
  special_hours: [],
  service_category: [],
  service: [],
  staff: [],
  staff_role: [],
  staff_unit: [],
  staff_skill: [],
  staff_schedule: [],
  staff_shift: [],
  staff_absence: [],
  client: [],
  client_note: [],
  appointment: [],
  appointment_item: [],
  staff_block: [],
  appointment_status_event: [],
  notification_log: [],
}

// ---------------------------------------------------------------------
// A rede e as lojas
// ---------------------------------------------------------------------

const org = {
  id: randomUUID(),
  name: REDE.nome,
  slug: REDE.slug,
  timezone: TZ,
  currency: REDE.moeda ?? 'EUR',
  default_language: REDE.lingua ?? 'pt',
  whatsapp_phone: REDE.whatsapp ?? null,
  created_at: iso(FUNDACAO),
}
T.org.push(org)

const lojas = LOJAS.map((loja, i) => ({
  ...loja,
  id: randomUUID(),
  ordem: i,
  semana: new Map(loja.horario.map(([dia, abre, fecha]) => [dia, [hhmm(abre), hhmm(fecha)]])),
}))
const LOJA = new Map(lojas.map((l) => [l.slug, l]))
if (LOJA.size !== lojas.length) falha('dados.mjs: há duas lojas com o mesmo slug.')

for (const loja of lojas) {
  T.unit.push({
    id: loja.id,
    org_id: org.id,
    slug: loja.slug,
    name: loja.nome,
    timezone: TZ,
    address_line: loja.morada ?? null,
    postal_code: loja.codigoPostal ?? null,
    city: loja.cidade ?? null,
    country: REDE.pais ?? 'PT',
    latitude: loja.latitude ?? null,
    longitude: loja.longitude ?? null,
    phone: loja.telefone ?? null,
    email: loja.email ?? null,
    whatsapp_phone: loja.whatsapp ?? null,
    min_lead_minutes: REDE.antecedencia ?? 0,
    sort_order: loja.ordem,
    created_at: iso(FUNDACAO),
  })

  for (const [weekday, [abre, fecha]] of loja.semana) {
    T.business_hours.push({ unit_id: loja.id, weekday, opens_min: abre, closes_min: fecha })
  }

  // As fotografias são as que estiverem na pasta. Não se inventa nenhuma.
  const pastaFotos = join(PASTA, 'public', 'fotos', loja.slug)
  if (existsSync(pastaFotos)) {
    readdirSync(pastaFotos)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .forEach((f, i) => {
        T.unit_photo.push({
          unit_id: loja.id,
          url: `/fotos/${loja.slug}/${encodeURIComponent(f)}`,
          alt: loja.fotos?.[f] ?? `${REDE.nome} ${loja.nome}`,
          sort_order: i,
          created_at: iso(FUNDACAO),
        })
      })
  }
}

// ---------------------------------------------------------------------
// Feriados e meios-dias
// ---------------------------------------------------------------------

/*
 * Um feriado só se escreve na loja que nesse dia abriria: um «fechado»
 * num dia em que já se está fechado é uma linha que não diz nada. E vão
 * até um ano à frente, porque é até lá que a montra deixa marcar.
 */
const especiais = new Map()
const ULTIMO_ESPECIAL = somaDias(HOJE, 366)
const anoDe = (dia) => Number(dia.slice(0, 4))

for (let ano = anoDe(INICIO); ano <= anoDe(ULTIMO_ESPECIAL); ano++) {
  for (const { dia, nome } of feriados(ano)) {
    if (dia < INICIO || dia > ULTIMO_ESPECIAL) continue
    for (const loja of lojas) {
      const chave = `${loja.slug}|${dia}`
      if (!loja.semana.has(diaDaSemana(dia)) || especiais.has(chave)) continue
      especiais.set(chave, null)
      T.special_hours.push({
        unit_id: loja.id,
        on_date: dia,
        is_closed: true,
        opens_min: null,
        closes_min: null,
        note: nome,
        created_at: iso(FUNDACAO),
      })
    }
  }

  for (const { mesDia, fecha, nota } of MEIOS_DIAS) {
    const dia = `${ano}-${mesDia}`
    if (dia < INICIO || dia > ULTIMO_ESPECIAL) continue
    for (const loja of lojas) {
      const chave = `${loja.slug}|${dia}`
      const horas = loja.semana.get(diaDaSemana(dia))
      if (!horas || especiais.has(chave)) continue
      const fim = Math.min(horas[1], hhmm(fecha))
      const fechada = fim <= horas[0]
      especiais.set(chave, fechada ? null : [horas[0], fim])
      T.special_hours.push({
        unit_id: loja.id,
        on_date: dia,
        is_closed: fechada,
        opens_min: fechada ? null : horas[0],
        closes_min: fechada ? null : fim,
        note: nota ?? null,
        created_at: iso(FUNDACAO),
      })
    }
  }
}

/** [abre, fecha] da loja nesse dia, ou nulo se estiver fechada. */
function horarioDoDia(loja, dia) {
  const chave = `${loja.slug}|${dia}`
  if (especiais.has(chave)) return especiais.get(chave)
  return loja.semana.get(diaDaSemana(dia)) ?? null
}

// ---------------------------------------------------------------------
// O preçário
// ---------------------------------------------------------------------

const slugify = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

/** O ficheiro em public/<pasta>/<nome>.<ext>, se existir. */
function imagem(pasta, nome) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    if (existsSync(join(PASTA, 'public', pasta, `${nome}.${ext}`))) return `/${pasta}/${nome}.${ext}`
  }
  return null
}

const servicos = []
const SERVICO_POR_NOME = new Map()

CATALOGO.forEach((categoria, i) => {
  const id = randomUUID()
  T.service_category.push({
    id,
    org_id: org.id,
    slug: categoria.slug,
    name: categoria.nome[0],
    name_en: categoria.nome[1] ?? null,
    name_es: categoria.nome[2] ?? null,
    sort_order: i,
    created_at: iso(FUNDACAO),
  })

  categoria.servicos.forEach((s, j) => {
    const slug = slugify(s.nome[0])
    if (servicos.some((outro) => outro.slug === slug)) {
      falha(`dados.mjs: dois serviços dão o mesmo endereço («${slug}»).`)
    }
    const servico = {
      id: randomUUID(),
      slug,
      nome: s.nome[0],
      categoria: categoria.slug,
      preco: Math.round(s.euros * 100),
      minutos: s.minutos,
      peso: s.peso ?? 1,
    }
    servicos.push(servico)
    SERVICO_POR_NOME.set(servico.nome, servico)

    const foto = imagem('servicos', slug)
    T.service.push({
      id: servico.id,
      org_id: org.id,
      category_id: id,
      slug,
      name: s.nome[0],
      name_en: s.nome[1] ?? null,
      name_es: s.nome[2] ?? null,
      description: s.descricao?.[0] ?? null,
      description_en: s.descricao?.[1] ?? null,
      description_es: s.descricao?.[2] ?? null,
      base_price_cents: servico.preco,
      duration_minutes: s.minutos,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      bookable_online: true,
      image_url: foto,
      image_alt: foto ? s.nome[0] : null,
      sort_order: j,
      created_at: iso(FUNDACAO),
      updated_at: iso(FUNDACAO),
    })
  })
})

/** O que costuma vir a seguir a cada serviço, na mesma marcação. */
const COMBOS = new Map()
for (const [a, b] of COMBINACOES) {
  const primeiro = SERVICO_POR_NOME.get(a)
  const segundo = SERVICO_POR_NOME.get(b)
  if (!primeiro || !segundo) falha(`dados.mjs: a combinação «${a} + ${b}» não bate com o preçário.`)
  if (!COMBOS.has(primeiro.id)) COMBOS.set(primeiro.id, [])
  COMBOS.get(primeiro.id).push(segundo)
}

// ---------------------------------------------------------------------
// A equipa
// ---------------------------------------------------------------------

const PAPEIS = new Set(['owner', 'manager', 'professional'])

const pessoas = EQUIPA.map((p, i) => ({ ...p, id: randomUUID(), ordem: i }))
const PESSOA = new Map(pessoas.map((p) => [p.login, p]))
if (PESSOA.size !== pessoas.length) falha('dados.mjs: há dois nomes de entrada iguais na equipa.')

const DONA = pessoas.find((p) => p.papel === 'owner')
if (!DONA) falha('dados.mjs: a equipa precisa de uma dona (papel owner).')
const GERENTE = pessoas.find((p) => p.papel === 'manager') ?? DONA

const categoriasExistentes = new Set(CATALOGO.map((c) => c.slug))

for (const p of pessoas) {
  if (!PAPEIS.has(p.papel)) falha(`dados.mjs: ${p.login} tem um papel que não existe («${p.papel}»).`)
  if (!p.login || p.login.trim().length < 3) falha(`dados.mjs: o nome de entrada «${p.login}» é curto demais.`)
  for (const slug of p.lojas) {
    if (!LOJA.has(slug)) falha(`dados.mjs: ${p.login} trabalha numa loja que não existe («${slug}»).`)
  }
  for (const slug of Object.keys(p.escala ?? {})) {
    if (!p.lojas.includes(slug)) falha(`dados.mjs: ${p.login} tem escala em ${slug} sem lá trabalhar.`)
  }
  for (const cat of p.categorias) {
    if (!categoriasExistentes.has(cat)) falha(`dados.mjs: ${p.login} faz uma família que não existe («${cat}»).`)
  }

  /*
   * O QUE CADA UMA FAZ, E QUANTO. A primeira família da lista é a que
   * lhe enche a agenda; a segunda sai metade das vezes, a terceira um
   * terço. Dentro da família manda o peso de cada serviço.
   */
  p.faz = new Set()
  p.pesos = []
  p.categorias.forEach((cat, k) => {
    const fator = [1, 0.5, 0.3][k] ?? 0.3
    const daFamilia = servicos.filter((s) => s.categoria === cat)
    const soma = daFamilia.reduce((t, s) => t + s.peso, 0)
    for (const s of daFamilia) {
      p.faz.add(s.id)
      p.pesos.push([s, (fator * s.peso) / soma])
    }
  })

  // A mesma pessoa não pode estar escalada em dois sítios à mesma hora:
  // a base recusa, mas aqui diz-se quem e quando.
  const turnos = Object.entries(p.escala ?? {}).flatMap(([slug, linhas]) =>
    linhas.map(([w, a, b]) => ({ slug, w, a: hhmm(a), b: hhmm(b) })),
  )
  for (const x of turnos) {
    if (x.b <= x.a) falha(`dados.mjs: a escala de ${p.login} acaba antes de começar (${x.slug}, dia ${x.w}).`)
    for (const y of turnos) {
      if (x !== y && x.w === y.w && x.a < y.b && y.a < x.b) {
        falha(`dados.mjs: ${p.login} está escalada duas vezes ao mesmo tempo no dia ${x.w}.`)
      }
    }
  }

  const avatar = imagem('equipa', p.login)
  T.staff.push({
    id: p.id,
    org_id: org.id,
    name: p.nome,
    // Gama 97: não está atribuída a operadora nenhuma. Ver dados.mjs.
    phone: `+351${970100000 + p.ordem + 1}`,
    email: null,
    password_hash: null,
    avatar_url: avatar,
    bio: p.bio ?? null,
    display_color: p.cor ?? '#D9C08A',
    accepts_online_booking: p.online !== false,
    is_active: true,
    sort_order: p.ordem,
    login: p.login,
    public_alias: null,
    is_placeholder: false,
    created_at: iso(FUNDACAO),
    updated_at: iso(FUNDACAO),
  })

  // Um papel por pessoa, de rede — como o ecrã da Equipa os cria. As
  // lojas de cada uma estão no staff_unit.
  T.staff_role.push({ staff_id: p.id, role: p.papel, unit_id: null, created_at: iso(FUNDACAO) })

  for (const slug of p.lojas) T.staff_unit.push({ staff_id: p.id, unit_id: LOJA.get(slug).id })
  for (const servicoId of p.faz) T.staff_skill.push({ staff_id: p.id, service_id: servicoId })

  for (const [slug, linhas] of Object.entries(p.escala ?? {})) {
    for (const [weekday, entra, sai] of linhas) {
      T.staff_schedule.push({
        staff_id: p.id,
        unit_id: LOJA.get(slug).id,
        weekday,
        starts_min: hhmm(entra),
        ends_min: hhmm(sai),
        valid_from: somaDias(HOJE, -400),
        valid_to: null,
        created_at: iso(FUNDACAO),
      })
    }
  }
}

// ---------------------------------------------------------------------
// Ausências e domingos
// ---------------------------------------------------------------------

const TIPOS_DE_AUSENCIA = new Set(['day_off', 'vacation', 'training', 'block'])

/** login → dia → faixas [das, até] em minutos. Dia inteiro é [0, 1440]. */
const ausente = new Map()
function marcaAusente(login, dia, das, ate) {
  if (!ausente.has(login)) ausente.set(login, new Map())
  const dias = ausente.get(login)
  if (!dias.has(dia)) dias.set(dia, [])
  dias.get(dia).push([das, ate])
}
const ausenteODia = (login, dia) =>
  (ausente.get(login)?.get(dia) ?? []).some(([a, b]) => a <= 0 && b >= 1440)

function linhaDeAusencia(p, a, ini, fim) {
  // Escreve-se com dias de antecedência, e nunca no futuro.
  const escrita = Math.min(ini - entre(10, 30) * DIA + entre(-3, 3) * HORA, AGORA - HORA)
  T.staff_absence.push({
    staff_id: p.id,
    unit_id: null,
    kind: a.tipo,
    starts_at: iso(ini),
    ends_at: iso(fim),
    reason: a.motivo ?? null,
    created_by: GERENTE.id,
    created_at: iso(escrita),
  })
}

/** O horário da escala (sem turnos extra nem ausências), já dentro do horário da loja. */
function faixasDaEscala(p, loja, dia) {
  const horas = horarioDoDia(loja, dia)
  if (!horas) return []
  const wd = diaDaSemana(dia)
  return (p.escala?.[loja.slug] ?? [])
    .filter(([w]) => w === wd)
    .map(([, a, b]) => [Math.max(hhmm(a), horas[0]), Math.min(hhmm(b), horas[1])])
    .filter(([a, b]) => b > a)
}

const avisosDoEnsaio = []

/*
 * PRIMEIRO AS FÉRIAS, DEPOIS O RESTO, DEPOIS OS DOMINGOS. As férias são
 * dias de calendário e não dependem de nada. Uma folga ou uma formação
 * de um dia só vai para o primeiro dia em que a pessoa está escalada — e
 * procura-se na escala, não nos turnos de domingo, para não se dar folga
 * a quem foi chamada de propósito. Os domingos vêm no fim porque trocam
 * quem estiver de férias.
 */
for (const a of AUSENCIAS) {
  const p = PESSOA.get(a.quem)
  if (!p) falha(`dados.mjs: ausência de alguém que não está na equipa («${a.quem}»).`)
  if (!TIPOS_DE_AUSENCIA.has(a.tipo)) falha(`dados.mjs: tipo de ausência desconhecido («${a.tipo}»).`)
  if (!a.dias) continue
  const primeiro = somaDias(HOJE, a.dia)
  for (let k = 0; k < a.dias; k++) marcaAusente(p.login, somaDias(primeiro, k), 0, 1440)
  linhaDeAusencia(p, a, instante(primeiro, 0), instante(somaDias(primeiro, a.dias), 0))
}

for (const a of AUSENCIAS) {
  if (a.dias) continue
  const p = PESSOA.get(a.quem)
  const das = a.das ? hhmm(a.das) : 0
  const ate = a.ate ? hhmm(a.ate) : 1440
  let dia = null
  for (let k = 0; k < 14 && !dia; k++) {
    const d = somaDias(HOJE, a.dia + k)
    const faixas = p.lojas.flatMap((slug) => faixasDaEscala(p, LOJA.get(slug), d))
    if (faixas.some(([x, y]) => x < ate && y > das)) dia = d
  }
  if (!dia) {
    avisosDoEnsaio.push(`ausência de ${p.login} (dia ${a.dia}) não encontrou dia de trabalho`)
    continue
  }
  marcaAusente(p.login, dia, das, ate)
  const fim = a.ate ? instante(dia, ate) : instante(somaDias(dia, 1), 0)
  linhaDeAusencia(p, a, instante(dia, das), fim)
}

/** login|loja|dia → [entra, sai] do turno extra. */
const turnos = new Map()

if (DOMINGO) {
  const loja = LOJA.get(DOMINGO.loja)
  if (!loja) falha(`dados.mjs: o domingo é numa loja que não existe («${DOMINGO.loja}»).`)
  const todas = [...new Set(DOMINGO.pares.flat())]
  for (const login of todas) {
    if (!PESSOA.get(login)?.lojas.includes(loja.slug)) {
      falha(`dados.mjs: ${login} faz domingos em ${loja.slug} sem lá trabalhar.`)
    }
  }

  let dia = INICIO
  while (diaDaSemana(dia) !== 0) dia = somaDias(dia, 1)
  // Os turnos já estão combinados para as próximas doze semanas.
  for (; dia <= somaDias(HOJE, 84); dia = somaDias(dia, 7)) {
    if (!horarioDoDia(loja, dia)) continue
    const semana = Math.floor(diasEntre('1970-01-04', dia) / 7)
    const par = DOMINGO.pares[semana % DOMINGO.pares.length]
    const vao = []
    for (const login of par) {
      if (!ausenteODia(login, dia)) {
        vao.push(login)
        continue
      }
      const troca = todas.find((l) => !par.includes(l) && !vao.includes(l) && !ausenteODia(l, dia))
      if (troca) vao.push(troca)
    }
    for (const login of vao) {
      const p = PESSOA.get(login)
      const entra = hhmm(DOMINGO.entra)
      const sai = hhmm(DOMINGO.sai)
      turnos.set(`${login}|${loja.slug}|${dia}`, [entra, sai])
      T.staff_shift.push({
        staff_id: p.id,
        unit_id: loja.id,
        day: dia,
        starts_min: entra,
        ends_min: sai,
        created_by: DONA.id,
        created_at: iso(Math.min(instante(somaDias(dia, -14), 10 * 60), AGORA - HORA)),
      })
    }
  }
}

// ---------------------------------------------------------------------
// As horas de cada uma
// ---------------------------------------------------------------------

function junta(faixas) {
  const ordenadas = faixas.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const out = []
  for (const [a, b] of ordenadas) {
    const ultima = out[out.length - 1]
    if (ultima && a <= ultima[1]) ultima[1] = Math.max(ultima[1], b)
    else out.push([a, b])
  }
  return out
}

function tira(faixas, a, b) {
  const out = []
  for (const [x, y] of faixas) {
    if (b <= x || a >= y) {
      out.push([x, y])
      continue
    }
    if (a > x) out.push([x, a])
    if (b < y) out.push([b, y])
  }
  return out
}

/** Escala + turnos extra, dentro do horário da loja, menos as ausências. */
function faixasDoDia(p, loja, dia) {
  const faixas = faixasDaEscala(p, loja, dia)
  const turno = turnos.get(`${p.login}|${loja.slug}|${dia}`)
  const horas = horarioDoDia(loja, dia)
  if (turno && horas) faixas.push([Math.max(turno[0], horas[0]), Math.min(turno[1], horas[1])])
  let livres = junta(faixas)
  for (const [a, b] of ausente.get(p.login)?.get(dia) ?? []) livres = tira(livres, a, b)
  return livres
}

/*
 * O ALMOÇO não se guarda em lado nenhum — nem a casa a sério o guarda.
 * Vê-se na agenda como um buraco à hora do costume, nos dias compridos.
 */
function comAlmoco(p, faixas) {
  if (!p.almoco) return faixas
  const total = faixas.reduce((t, [a, b]) => t + b - a, 0)
  if (total < 7 * 60 || !chance(0.85)) return faixas
  const ini = hhmm(p.almoco) + escolhe([-15, 0, 0, 15])
  return tira(faixas, ini, ini + 60)
}

// ---------------------------------------------------------------------
// As clientes
// ---------------------------------------------------------------------

const proibidos = new Set(
  [
    ...NOMES_PROIBIDOS,
    ...EQUIPA.map((p) => {
      const partes = p.nome.split(' ')
      return `${partes[0]} ${partes[partes.length - 1]}`
    }),
  ].map((n) => n.toLowerCase()),
)
const nomesUsados = new Set()
const telefonesUsados = new Set()

function nomeDe(origem, homem) {
  const lista = NOMES[origem]
  for (let tentativa = 0; tentativa < 500; tentativa++) {
    const proprio = escolhe(homem ? lista.homens : lista.mulheres)
    const quantos =
      origem === 'pt' ? (chance(0.6) ? 2 : 1) : origem === 'br' ? (chance(0.5) ? 2 : 1) : 1
    const apelidos = []
    while (apelidos.length < quantos) {
      const apelido = escolhe(lista.apelidos)
      if (!apelidos.includes(apelido)) apelidos.push(apelido)
    }
    const nome = `${proprio} ${apelidos.join(' ')}`
    const ultimo = apelidos[apelidos.length - 1]
    // «Ana Rita Pereira» também é «Rita Pereira» para quem a reconhece?
    // Não — mas «Ana Pereira» é a mesma chave que «Ana Rita Pereira».
    const chaves = [`${proprio} ${ultimo}`, `${proprio.split(' ')[0]} ${ultimo}`]
    if (chaves.some((k) => proibidos.has(k.toLowerCase()))) continue
    if (nomesUsados.has(nome)) continue
    nomesUsados.add(nome)
    return nome
  }
  falha(`dados.mjs: faltam nomes para as clientes de origem «${origem}».`)
}

/*
 * TELEFONES QUE NÃO ATENDEM. Os portugueses são da gama 97 (sem
 * operadora); metade dos ingleses é da 07700 900xxx, que o regulador
 * britânico guarda para ficção. O terceiro algarismo nunca é 0, para não
 * cruzar com os da equipa.
 */
function telefoneDe(origem) {
  for (;;) {
    const numero =
      origem === 'en' && chance(0.5)
        ? `+447700900${String(entre(0, 999)).padStart(3, '0')}`
        : `+35197${entre(1, 9)}${String(entre(0, 999999)).padStart(6, '0')}`
    if (!telefonesUsados.has(numero)) {
      telefonesUsados.add(numero)
      return numero
    }
  }
}

function lojaDe(origem) {
  const dadas = CLIENTELA.lojaPreferida?.[origem] ?? {}
  const resto = Math.max(0, 1 - Object.values(dadas).reduce((t, v) => t + v, 0))
  const outras = lojas.filter((l) => !(l.slug in dadas))
  return sorteia(
    lojas.map((l) => [l.slug, l.slug in dadas ? dadas[l.slug] : resto / Math.max(1, outras.length)]),
  )
}

/** O que ela vem cá fazer: uma família, às vezes duas. */
function interessesDela() {
  const pesos = Object.entries(CLIENTELA.interesses)
  const gosta = [sorteia(pesos)]
  if (chance(0.5)) {
    const segundo = sorteia(pesos.filter(([c]) => c !== gosta[0]))
    if (segundo) gosta.push(segundo)
  }
  // Quem pinta ou corta aqui também trata o cabelo aqui.
  if (gosta.includes('cabelo') || gosta.includes('coloracao')) gosta.push('tratamentos-capilares')
  return gosta
}

const clientes = []

for (const [genero, total] of [
  ['mulheres', CLIENTELA.mulheres],
  ['homens', CLIENTELA.homens],
]) {
  const homem = genero === 'homens'
  for (let i = 0; i < total; i++) {
    const origem = sorteia(Object.entries(CLIENTELA.origem))
    const perfil = sorteia(Object.entries(CLIENTELA.mistura[genero]))
    const def = CLIENTELA.perfis[perfil]
    let desde = -Infinity
    let ate = Infinity
    if (def.desde) {
      // Mais novas recentes do que antigas: a casa está a crescer.
      const [a, b] = def.desde
      desde = Math.round(b - (b - a) * rand() ** 1.3)
    }
    if (def.ate !== undefined) ate = def.ate
    clientes.push({
      id: randomUUID(),
      homem,
      origem,
      perfil,
      peso: def.peso,
      desde,
      ate,
      loja: lojaDe(origem),
      gosta: new Set(homem ? [...DELES] : interessesDela()),
      nome: nomeDe(origem, homem),
      telefone: telefoneDe(origem),
      lingua: origem === 'en' ? 'en' : origem === 'es' ? 'es' : 'pt',
      dias: new Set(),
      ultima: null,
      favorita: null,
      marcacoes: [],
    })
  }
}

const MULHERES = clientes.filter((c) => !c.homem)
const HOMENS = clientes.filter((c) => c.homem)

// ---------------------------------------------------------------------
// As marcações
// ---------------------------------------------------------------------

/*
 * QUANTO ENCHE CADA DIA. O passado vai subindo — a casa cresceu desde
 * que tem montra —, hoje está quase cheio, e o futuro enche-se como se
 * enche uma agenda a sério: a próxima semana quase toda, a seguinte a
 * meio, a terceira só com as marcações de quem marca com antecedência.
 * Por cima, o ritmo da semana e do mês, e um pouco de acaso.
 *
 * O ÚLTIMO MÊS SOBE UM POUCO MAIS. O painel compara o período corrente,
 * com o dia de hoje ainda a meio, contra dias anteriores inteiros — e a
 * meio da manhã isso vale cinco ou dez por cento a menos na faturação.
 * Sem este empurrão, a casa que se grava parecia estar a encolher.
 */
function alvoDoDia(o, dia) {
  let f
  if (o < 0) f = 0.5 + 0.2 * (1 + o / HIST) + 0.05 * Math.max(0, 1 + o / 30)
  else if (o === 0) f = 0.8
  else f = 0.12 + 0.6 * Math.exp(-(o - 1) / 7)
  const mes = Number(dia.slice(5, 7))
  f *= (RITMO.semana?.[diaDaSemana(dia)] ?? 1) * (RITMO.mes?.[mes] ?? 1)
  f *= 0.9 + 0.2 * rand()
  return Math.min(0.92, Math.max(0.05, f))
}

function podeNoDia(s, domingo) {
  return !domingo || DE_DOMINGO.has(s.categoria)
}

function escolheServico(p, livre, domingo) {
  return sorteia(p.pesos.filter(([s]) => s.minutos <= livre && podeNoDia(s, domingo)))
}

function escolheCombo(p, s, livre, domingo) {
  const segundos = (COMBOS.get(s.id) ?? []).filter(
    (b) => p.faz.has(b.id) && s.minutos + b.minutos <= livre && podeNoDia(b, domingo),
  )
  if (segundos.length === 0 || !chance(0.35)) return null
  return escolhe(segundos)
}

/** Quanto dura, em média, uma marcação desta pessoa — para acertar a ocupação. */
const duracoes = new Map()
function duracaoMedia(p, domingo) {
  const chave = `${p.login}|${domingo}`
  if (!duracoes.has(chave)) {
    let soma = 0
    let peso = 0
    for (const [s, w] of p.pesos) {
      if (!podeNoDia(s, domingo)) continue
      const segundos = (COMBOS.get(s.id) ?? []).filter((b) => p.faz.has(b.id) && podeNoDia(b, domingo))
      const extra = segundos.length
        ? (0.35 * segundos.reduce((t, b) => t + b.minutos, 0)) / segundos.length
        : 0
      soma += w * (s.minutos + extra)
      peso += w
    }
    duracoes.set(chave, peso > 0 ? soma / peso : 60)
  }
  return duracoes.get(chave)
}

/*
 * QUEM VEM. Cada marcação sorteia uma cliente, e a vontade de cada uma
 * pesa o perfil dela (uma fiel volta sempre), a loja (na outra aparece
 * pouco), o que costuma fazer (fora disso, raramente), há quanto tempo
 * cá esteve (quem veio esta semana não volta já) e se é esta a pessoa
 * com quem costuma marcar. As antigas aparecem cedo no passado — são da
 * casa, não são novas —, e as novas aparecem pouco depois de chegarem.
 */
function escolheCliente(p, loja, o, dia, itens) {
  const deles = DELES.has(itens[0].categoria)
  const familias = new Set(itens.map((s) => s.categoria))
  const outraLoja = CLIENTELA.outraLoja ?? 0.1
  const fora = CLIENTELA.foraDoInteresse ?? 0.12
  const pares = []
  for (const c of deles ? HOMENS : MULHERES) {
    if (o < c.desde || o > c.ate || c.dias.has(dia)) continue
    let w = c.peso
    if (c.loja !== loja.slug) w *= outraLoja
    for (const f of familias) {
      if (!c.gosta.has(f)) {
        w *= fora
        break
      }
    }
    if (c.ultima !== null) {
      const passou = o - c.ultima
      if (passou < 7) w *= 0.05
      else if (passou < 14) w *= 0.4
    } else if (c.perfil === 'nova') {
      w *= 8
    } else {
      w *= o < -HIST + 60 ? 4 : 0.1
    }
    if (c.favorita === p.login) w *= 3
    pares.push([c, w])
  }
  return sorteia(pares)
}

const ORIGENS = {
  site: [0.3, 0.64],
  whatsapp: [0.22, 0.12],
  phone: [0.2, 0.07],
  counter: [0.22, 0.12],
  walk_in: [0.06, 0.05],
}

/*
 * DE ONDE VEM A MARCAÇÃO. No princípio do passado a casa ainda vivia do
 * telefone e do balcão; com a montra no ar, o site foi ganhando. Quem é
 * nova chega sobretudo pelo site. E ninguém «entra pela porta» numa hora
 * que ainda não chegou.
 */
function origemDe(m, primeiraDaNova) {
  if (primeiraDaNova && chance(0.7)) return 'site'
  const t = (m.o + HIST) / (HIST + FUT)
  let origem = sorteia(Object.entries(ORIGENS).map(([k, [a, b]]) => [k, a + (b - a) * t]))
  if (origem === 'walk_in' && m.ini > AGORA) origem = 'counter'
  return origem
}

/*
 * O ESTADO depende de onde a marcação cai em relação a agora. O passado
 * está quase todo fechado, com as faltas e os cancelamentos de uma casa
 * normal. Hoje: o que acabou está fechado — tirando duas ou três, que
 * são o âmbar da agenda e o que se mostra a fechar —, o que está a
 * decorrer está na cadeira, quem tem hora daqui a nada já chegou, e o
 * resto está confirmado. Quem entrou pela porta nunca falta.
 *
 * AS FALTAS VÃO CAINDO: cinco em cada cem há quatro meses, duas e meia
 * agora. É o que os lembretes fazem numa casa a sério, e é a seta que o
 * painel põe na taxa de faltas — a descer, que é o lado bom.
 */
function estadoDe(m) {
  if (m.ini > AGORA) {
    if (m.o === 0 && m.ini <= AGORA + 20 * MIN) return chance(0.7) ? 'checked_in' : 'confirmed'
    return chance(0.03) ? 'cancelled_by_client' : 'confirmed'
  }
  if (m.fim > AGORA) return 'in_service'
  const fechada = () => (chance(m.o < 0 ? 0.03 : 0.1) ? 'confirmed' : 'completed')
  if (m.origem === 'walk_in') return fechada()
  const falta = 0.025 + 0.025 * Math.min(1, -m.o / HIST)
  const r = rand()
  if (r < falta) return 'no_show'
  if (r < falta + 0.045) return 'cancelled_by_client'
  if (m.o < 0 && r < falta + 0.055) return 'cancelled_by_salon'
  return fechada()
}

/*
 * QUANDO SE MARCOU. Pelo site marca-se à noite e com pouca antecedência;
 * ao balcão marca-se a próxima à saída da última; ao telefone e pelo
 * WhatsApp, de véspera ou com uns dias. Nada foi marcado depois de agora,
 * e nada vem antes de a ficha da cliente existir.
 */
function criadaEm(m, cliente) {
  const { ini, dia } = m
  let c
  switch (m.origem) {
    case 'walk_in':
      c = ini - entre(2, 10) * MIN
      break
    case 'site': {
      const antes = Math.floor(21 * rand() ** 2)
      c = instante(somaDias(dia, -antes), entre(8 * 60, 23 * 60 - 1))
      if (c > ini - HORA) c = instante(somaDias(dia, -antes - 1), entre(8 * 60, 23 * 60 - 1))
      break
    }
    case 'counter': {
      const antes = chance(0.7) ? entre(14, 42) : entre(1, 6)
      c = instante(somaDias(dia, -antes), entre(10 * 60, 19 * 60))
      break
    }
    default:
      c = instante(somaDias(dia, -entre(1, 10)), entre(9 * 60, 20 * 60))
  }
  if (c > AGORA) c = AGORA - (30 * MIN + rand() ** 0.7 * 12 * DIA)
  if (cliente.nasceu !== undefined && c <= cliente.nasceu) {
    const teto = Math.min(AGORA, ini) - 30 * MIN
    c = Math.max(cliente.nasceu + MIN, Math.min(cliente.nasceu + entre(10, 3 * 24 * 60) * MIN, teto))
  }
  return Math.floor(c)
}

/** Uma nota ao acaso de entre as famílias dadas, numa das listas de notas. */
function notaDe(lista, chaves) {
  const opcoes = chaves.flatMap((k) => lista[k] ?? [])
  return opcoes.length > 0 ? escolhe(opcoes) : null
}

const marcacoes = []
const velhas = []

function marca(p, loja, dia, o, minuto, servs, cliente) {
  const ini = instante(dia, minuto)
  const itens = []
  let fim = ini
  for (const s of servs) {
    itens.push({ id: randomUUID(), servico: s, ini: fim, fim: fim + s.minutos * MIN })
    fim += s.minutos * MIN
  }
  const primeira = cliente.marcacoes.length === 0
  const m = { id: randomUUID(), loja, pessoa: p, cliente, dia, o, ini, fim, itens }
  m.origem = origemDe(m, primeira && cliente.perfil === 'nova')
  m.estado = estadoDe(m)
  m.criadaPor =
    m.origem === 'site' ? null : m.origem === 'walk_in' ? p : chance(0.6) ? GERENTE : p
  m.criada = criadaEm(m, cliente)
  if (primeira && cliente.perfil === 'nova') cliente.nasceu = m.criada - entre(1, 5) * MIN

  const familias = [...new Set(servs.map((s) => s.categoria))]
  if (m.origem === 'site' && chance(0.04)) {
    const chaves = [...familias, 'geral']
    if (primeira && cliente.perfil === 'nova') chaves.push('primeira')
    else chaves.push('volta')
    m.notaCliente = notaDe(NOTAS_DA_CLIENTE, chaves)
  }
  if (m.origem !== 'walk_in' && chance(0.03)) {
    m.notaInterna = notaDe(NOTAS_DA_MARCACAO, [...familias, 'geral'])
  }

  cliente.marcacoes.push(m)
  cliente.dias.add(dia)
  cliente.ultima = o
  if (primeira && (cliente.perfil === 'fiel' || cliente.perfil === 'regular') && chance(0.7)) {
    cliente.favorita = p.login
  }
  marcacoes.push(m)
  return m
}

/*
 * O ENCHIMENTO. Anda-se pela faixa de trabalho de quarto em quarto de
 * hora; em cada paragem, ou entra uma marcação, ou fica um buraco. A
 * probabilidade de entrar é a que dá, em média, a ocupação pedida para
 * aquele dia — contando com quanto dura uma marcação daquela pessoa.
 *
 * O ACERTO é o que se perde pelo caminho: o almoço, a ponta do dia onde
 * já não cabe nada, os minutos entre uma cliente e a seguinte, as que
 * desmarcam. Sem ele, o painel media um quarto abaixo do pedido. Foi
 * medido no ensaio — quem mexer no enchimento mede outra vez.
 */
const ACERTO = 1.3

function preenche(p, loja, dia, o, domingo, faixas, alvo) {
  const d = duracaoMedia(p, domingo)
  const f = Math.min(0.95, alvo * ACERTO)
  const pMarca = (f * 30) / (d * (1 - f) + f * 30)
  faixas.forEach(([ini, fim], i) => {
    let t = teto15(ini) + (i === 0 ? escolhe([0, 0, 15, 30]) : 0)
    while (t < fim) {
      if (!chance(pMarca)) {
        t += escolhe([15, 30, 30, 45])
        continue
      }
      const s = escolheServico(p, fim - t, domingo)
      if (!s) break
      const servs = [s]
      const segundo = escolheCombo(p, s, fim - t, domingo)
      if (segundo) servs.push(segundo)
      const cliente = escolheCliente(p, loja, o, dia, servs)
      if (!cliente) {
        t += 15
        continue
      }
      const m = marca(p, loja, dia, o, t, servs, cliente)
      t = teto15(t + (m.fim - m.ini) / MIN) + escolhe([0, 0, 0, 15])
    }
  })
}

for (let o = -HIST; o <= FUT; o++) {
  const dia = somaDias(HOJE, o)
  const domingo = diaDaSemana(dia) === 0
  for (const loja of lojas) {
    if (!horarioDoDia(loja, dia)) continue
    const alvo = alvoDoDia(o, dia)
    for (const p of pessoas) {
      if (!p.lojas.includes(loja.slug) || p.pesos.length === 0) continue
      const faixas = faixasDoDia(p, loja, dia)
      if (faixas.length === 0) continue
      const deCada = Math.min(0.92, Math.max(0.05, alvo * (0.92 + 0.16 * rand())))
      preenche(p, loja, dia, o, domingo, comAlmoco(p, faixas), deCada)
    }
  }
}

/*
 * REMARCAÇÕES. Umas quantas das marcações que estão para vir já foram
 * outra coisa: a cliente pediu outro dia. Faz-se como a aplicação faz —
 * a antiga fica cancelada pela casa, com «Remarcada», e sem link; a nova
 * aponta para ela, nasce no momento da troca, e fica com o link que a
 * cliente já tinha no telemóvel.
 */
for (const novo of [...marcacoes]) {
  if (novo.ini <= AGORA || novo.estado !== 'confirmed') continue
  if (!['site', 'whatsapp', 'phone'].includes(novo.origem) || !chance(0.04)) continue
  const k = escolhe([-3, -2, -1, 1, 2, 3, 4, 5])
  const diaVelho = somaDias(novo.dia, k)
  const minuto = minutoDoDia(novo.ini)
  const duracao = (novo.fim - novo.ini) / MIN
  const cabe = faixasDoDia(novo.pessoa, novo.loja, diaVelho).some(
    ([a, b]) => a <= minuto && minuto + duracao <= b,
  )
  if (!cabe) continue
  const iniVelho = instante(diaVelho, minuto)
  const desde = novo.criada + HORA
  const ate = Math.min(AGORA - 10 * MIN, iniVelho - HORA)
  if (novo.criada >= iniVelho - 2 * HORA || ate <= desde) continue
  const quando = Math.floor(desde + rand() * (ate - desde))

  const velho = {
    id: randomUUID(),
    loja: novo.loja,
    pessoa: novo.pessoa,
    cliente: novo.cliente,
    dia: diaVelho,
    o: novo.o + k,
    ini: iniVelho,
    fim: iniVelho + (novo.fim - novo.ini),
    itens: novo.itens.map((i) => ({
      id: randomUUID(),
      servico: i.servico,
      ini: i.ini - novo.ini + iniVelho,
      fim: i.fim - novo.ini + iniVelho,
    })),
    origem: novo.origem,
    criadaPor: novo.criadaPor,
    criada: novo.criada,
    estado: 'cancelled_by_salon',
    remarcada: quando,
    notaCliente: novo.notaCliente,
    notaInterna: novo.notaInterna,
  }
  novo.criada = quando
  novo.remarcadaDe = velho
  if (novo.origem !== 'site') novo.criadaPor = GERENTE
  velhas.push(velho)
  novo.cliente.marcacoes.push(velho)
}

const todas = [...velhas, ...marcacoes]

const FORA = new Set(['cancelled_by_client', 'cancelled_by_salon', 'no_show'])
const cancelada = (m) => m.estado === 'cancelled_by_client' || m.estado === 'cancelled_by_salon'
/** A mesma conta do painel: fechada, ou já acabou e não caiu. */
const feita = (m) => m.estado === 'completed' || (m.fim <= AGORA && !FORA.has(m.estado))
const valor = (m) => Math.max(0, m.itens.reduce((t, i) => t + i.servico.preco, 0) - (m.desconto ?? 0))

// ---------------------------------------------------------------------
// O que aconteceu a cada marcação
// ---------------------------------------------------------------------

/*
 * O REGISTO DE ESTADOS conta a história toda, pela ordem: marcou-se,
 * chegou, sentou-se, acabou — ou faltou, ou desmarcou. Cada passo depois
 * do anterior, e nenhum depois de agora.
 */
function montaEventos(m) {
  const ev = []
  let antes = m.criada - 1000
  const regista = (de, para, at, quem, { cliente = false, motivo = null } = {}) => {
    const quando = Math.max(Math.floor(at), antes + 1000)
    ev.push({ de, para, at: quando, quem, cliente, motivo })
    antes = quando
    return quando
  }
  const ate = (at) => Math.min(at, AGORA - 5000)
  const doSite = m.origem === 'site'
  const p = m.pessoa

  // Uma cancelada que não teve tempo de o ser não foi cancelada: veio.
  if (m.estado === 'cancelled_by_client' && Math.min(AGORA, m.ini - HORA) - m.criada < 5 * MIN) {
    m.estado = m.fim <= AGORA ? 'completed' : 'confirmed'
  }

  regista(null, 'confirmed', m.criada, doSite ? null : m.criadaPor, {
    cliente: doSite,
    motivo: m.remarcadaDe ? `Remarcação de ${m.remarcadaDe.id}` : null,
  })

  switch (m.estado) {
    case 'completed':
      regista('confirmed', 'checked_in', ate(m.ini - entre(0, 10) * MIN), p)
      regista('checked_in', 'in_service', ate(m.ini + entre(0, 6) * MIN), p)
      m.concluida = regista('in_service', 'completed', ate(m.fim + entre(0, 8) * MIN), p)
      break
    case 'in_service':
      regista('confirmed', 'checked_in', ate(m.ini - entre(0, 10) * MIN), p)
      regista('checked_in', 'in_service', ate(m.ini + entre(0, 6) * MIN), p)
      break
    case 'checked_in':
      regista(
        'confirmed',
        'checked_in',
        ate(Math.min(m.ini - entre(0, 10) * MIN, AGORA - entre(1, 4) * MIN)),
        p,
      )
      break
    case 'no_show':
      regista('confirmed', 'no_show', ate(m.ini + entre(15, 30) * MIN), chance(0.5) ? GERENTE : p)
      break
    case 'cancelled_by_client': {
      const teto = Math.min(AGORA, m.ini - HORA)
      const pelaCliente = chance(0.6)
      m.cancelada = regista(
        'confirmed',
        'cancelled_by_client',
        m.criada + rand() * (teto - m.criada),
        pelaCliente ? null : GERENTE,
        {
          cliente: pelaCliente,
          motivo: pelaCliente ? null : escolhe(MOTIVOS.cancelaCliente ?? [null]),
        },
      )
      break
    }
    case 'cancelled_by_salon':
      if (m.remarcada) {
        m.cancelada = regista('confirmed', 'cancelled_by_salon', m.remarcada, doSite ? null : GERENTE, {
          cliente: doSite,
          motivo: 'Remarcada',
        })
      } else {
        const teto = Math.min(AGORA, m.ini - HORA)
        m.cancelada = regista(
          'confirmed',
          'cancelled_by_salon',
          m.criada + rand() * Math.max(MIN, teto - m.criada),
          chance(0.5) ? DONA : GERENTE,
          { motivo: escolhe(MOTIVOS.cancelaCasa ?? [null]) },
        )
      }
      break
  }
  m.eventos = ev
  m.atualizada = antes
}

for (const m of todas) montaEventos(m)

/*
 * DESCONTOS: poucos, em trabalhos grandes, com motivo e autor. O pacote
 * de noiva só aparece em marcações de noiva.
 */
const motivosDeDesconto = MOTIVOS.desconto ?? ['Desconto da casa']
const deNoiva = motivosDeDesconto.filter((mo) => /noiva/i.test(mo))
const semNoiva = motivosDeDesconto.filter((mo) => !/noiva/i.test(mo))
for (const m of marcacoes) {
  if (m.estado !== 'completed') continue
  const total = m.itens.reduce((t, i) => t + i.servico.preco, 0)
  if (total < 4000 || !chance(0.03)) continue
  const desconto = Math.round((total * escolhe([10, 15, 20])) / 100 / 50) * 50
  const noiva = m.itens.some((i) => i.servico.slug.includes('noiva'))
  const motivo = noiva && deNoiva.length ? deNoiva[0] : semNoiva.length ? escolhe(semNoiva) : null
  if (desconto <= 0 || !motivo) continue
  m.desconto = desconto
  m.motivoDesconto = motivo
  m.descontoPor = chance(0.6) ? GERENTE : DONA
  m.descontoEm = Math.min(AGORA - 1000, m.fim + entre(0, 10) * MIN)
  m.atualizada = Math.max(m.atualizada, m.descontoEm)
}

// O link de gerir a marcação: todas o têm, menos as que a casa desfez.
for (const m of todas) {
  m.token = m.estado === 'cancelled_by_salon' ? null : randomBytes(18).toString('base64url')
}

// ---------------------------------------------------------------------
// Os avisos que já saíram
// ---------------------------------------------------------------------

/*
 * O QUE JÁ SE MANDOU tira a marcação da fila — é assim que a aplicação
 * funciona. Por isso o que se semeia aqui decide o que a página dos
 * avisos mostra: as confirmações saíram quase todas, os lembretes de
 * amanhã ainda não (mandam-se ao fim do dia), os de hoje saíram a meio,
 * e metade dos pedidos de opinião de ontem estão por mandar.
 */
const avisos = []

function avisa(m, routine, at) {
  const r = rand()
  const quem = r < 0.7 ? GERENTE : r < 0.9 ? DONA : m.pessoa
  avisos.push({ m, routine, at: Math.floor(at), quem })
}

for (const m of todas) {
  const limite = m.cancelada ?? Infinity
  const pode = (at) => at <= AGORA && at < limite && at > m.criada

  if (m.origem !== 'walk_in') {
    const confirma = m.criada + entre(5, 240) * MIN
    if (m.ini <= AGORA) {
      if (m.ini - m.criada >= DIA && chance(0.9) && confirma < m.ini && pode(confirma)) {
        avisa(m, 'confirm', confirma)
      }
    } else {
      const idade = AGORA - m.criada
      const p = idade >= 18 * HORA ? 0.99 : idade >= 3 * HORA ? 0.8 : 0
      const at = Math.min(confirma, AGORA - MIN)
      if (chance(p) && pode(at)) avisa(m, 'confirm', at)
    }

    const vespera = instante(somaDias(m.dia, -1), entre(18 * 60, 20 * 60))
    const pVespera = m.o < 0 ? 0.8 : m.o === 0 ? 0.95 : m.o === 1 && AGORA_MIN >= 19 * 60 ? 0.6 : 0
    if (chance(pVespera) && pode(vespera)) avisa(m, 'reminder_eve', vespera)

    if (m.o === 0) {
      const manha = instante(HOJE, entre(9 * 60, 10 * 60 + 30))
      if (manha < m.ini && chance(0.45) && pode(manha)) avisa(m, 'reminder_today', manha)
    }
  }

  if (feita(m) && m.o < 0) {
    const depois = instante(somaDias(m.dia, 1), entre(10 * 60, 13 * 60))
    if (chance(m.o === -1 ? 0.7 : 0.6) && depois <= AGORA) avisa(m, 'review', depois)
  }

  if ((m.estado === 'no_show' || m.estado === 'cancelled_by_client') && m.ini < AGORA) {
    const depois = instante(somaDias(m.dia, entre(1, 3)), entre(10 * 60, 18 * 60))
    if (chance(0.5) && depois <= AGORA) avisa(m, 'winback', depois)
  }
}

// ---------------------------------------------------------------------
// As fichas das clientes
// ---------------------------------------------------------------------

const maisFrequente = (valores) => {
  const conta = new Map()
  for (const v of valores) conta.set(v, (conta.get(v) ?? 0) + 1)
  let melhor = null
  let n = 0
  for (const [v, c] of conta) {
    if (c > n) {
      melhor = v
      n = c
    }
  }
  return melhor
}

// Uma nova que não chegou a marcar nada não é cliente de ninguém.
const ativas = clientes.filter((c) => c.perfil !== 'nova' || c.marcacoes.length > 0)

for (const c of ativas) {
  const feitas = c.marcacoes.filter(feita)
  const concluidas = c.marcacoes.filter((m) => m.concluida)
  c.feitas = feitas
  // Como a aplicação: a primeira e a última visita carimbam-se ao fechar.
  c.primeiraVisita = concluidas.length ? Math.min(...concluidas.map((m) => m.concluida)) : null
  c.ultimaVisita = concluidas.length ? Math.max(...concluidas.map((m) => m.concluida)) : null
  c.faltas = c.marcacoes.filter((m) => m.estado === 'no_show').length
  c.preferida = feitas.length >= 2 ? maisFrequente(feitas.map((m) => m.pessoa.login)) : null
  c.lojaPreferida =
    maisFrequente(c.marcacoes.filter((m) => !cancelada(m)).map((m) => m.loja.slug)) ?? c.loja
  c.gasto = feitas.reduce((t, m) => t + valor(m), 0)
  c.familia =
    maisFrequente(feitas.flatMap((m) => m.itens.map((i) => i.servico.categoria))) ?? [...c.gosta][0]
  c.criada = c.nasceu ?? IMPORTACAO + entre(0, 3600) * 1000
}

const porGasto = ativas.filter((c) => c.gasto > 0).sort((a, b) => b.gasto - a.gasto)
const vips = new Set(porGasto.slice(0, Math.round(porGasto.length * 0.03)))

for (const c of ativas) {
  const tags = []
  if (vips.has(c)) tags.push('VIP')
  if (c.marcacoes.some((m) => !cancelada(m) && m.itens.some((i) => i.servico.slug.includes('noiva')))) {
    tags.push('Noiva')
  }
  if (c.gosta.has('rosto') && chance(0.1)) tags.push('Pele sensível')
  if (c.perfil === 'nova' && chance(0.15)) tags.push('Indicação')

  const notas = NOTAS_DE_SERVICO[c.familia] ?? []
  const geral = NOTAS_DE_SERVICO.geral ?? []
  let notaDeServico = null
  if (chance(0.2)) {
    const lista = notas.length && chance(0.75) ? notas : geral
    if (lista.length) notaDeServico = escolhe(lista)
  }

  T.client.push({
    id: c.id,
    org_id: org.id,
    phone: c.telefone,
    name: c.nome,
    email: null,
    birthdate: chance(0.4) ? `${entre(1962, 2004)}-${dois(entre(1, 12))}-${dois(entre(1, 28))}` : null,
    language: c.lingua,
    preferred_unit_id: LOJA.get(c.lojaPreferida).id,
    preferred_staff_id: c.preferida ? PESSOA.get(c.preferida).id : null,
    drink_preference: BEBIDAS.length && chance(0.4) ? escolhe(BEBIDAS) : null,
    allergies: ALERGIAS.length && chance(0.08) ? escolhe(ALERGIAS) : null,
    service_notes: notaDeServico,
    tags,
    no_show_count: c.faltas,
    first_visit_at: c.primeiraVisita ? iso(c.primeiraVisita) : null,
    last_visit_at: c.ultimaVisita ? iso(c.ultimaVisita) : null,
    is_active: true,
    created_at: iso(c.criada),
    updated_at: iso(Math.max(c.criada, c.ultimaVisita ?? 0)),
  })
}

/*
 * NOTAS DA EQUIPA NA FICHA. Cada uma sai uma vez só, numa cliente que já
 * cá veio mais de uma vez e que faz o que a nota diz. Quem a escreve é a
 * pessoa com quem ela costuma marcar, ou a gerente.
 */
const comHistoria = ativas.filter((c) => c.feitas.length >= 2)
const jaTemNota = new Set()
for (const [chave, notas] of Object.entries(NOTAS_INTERNAS)) {
  for (const corpo of notas) {
    const candidatas = comHistoria.filter(
      (c) => !jaTemNota.has(c) && (chave === 'geral' || c.familia === chave),
    )
    if (candidatas.length === 0) {
      avisosDoEnsaio.push(`nota interna sem cliente que lhe sirva: «${corpo}»`)
      continue
    }
    const c = escolhe(candidatas)
    jaTemNota.add(c)
    const depoisDe = escolhe(c.feitas.slice(1))
    T.client_note.push({
      client_id: c.id,
      author_id: (c.preferida ? PESSOA.get(c.preferida) : GERENTE).id,
      body: corpo,
      created_at: iso(Math.min(AGORA - HORA, depoisDe.fim + entre(5, 180) * MIN)),
    })
  }
}

// ---------------------------------------------------------------------
// As marcações, em linhas
// ---------------------------------------------------------------------

// As remarcadas primeiro: a nova aponta para a antiga, e a antiga tem de
// já lá estar quando a nova entra.
for (const m of todas) {
  T.appointment.push({
    id: m.id,
    org_id: org.id,
    unit_id: m.loja.id,
    client_id: m.cliente.id,
    status: m.estado,
    source: m.origem,
    starts_at: iso(m.ini),
    ends_at: iso(m.fim),
    client_note: m.notaCliente ?? null,
    internal_note: m.notaInterna ?? null,
    language: m.cliente.lingua,
    rescheduled_from_id: m.remarcadaDe?.id ?? null,
    discount_cents: m.desconto ?? 0,
    discount_reason: m.motivoDesconto ?? null,
    discount_by_staff_id: m.descontoPor?.id ?? null,
    discount_at: m.descontoEm ? iso(m.descontoEm) : null,
    closed_at: null,
    closed_by_staff_id: null,
    created_by_staff_id: m.criadaPor?.id ?? null,
    created_at: iso(m.criada),
    updated_at: iso(m.atualizada),
    manage_token: m.token,
  })

  m.itens.forEach((item, k) => {
    T.appointment_item.push({
      id: item.id,
      appointment_id: m.id,
      service_id: item.servico.id,
      staff_id: m.pessoa.id,
      starts_at: iso(item.ini),
      ends_at: iso(item.fim),
      price_cents: item.servico.preco,
      duration_minutes: item.servico.minutos,
      service_name: item.servico.nome,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      sort_order: k,
      created_at: iso(m.criada),
    })
    // Cancelar apaga o bloco; faltar não — a cadeira esteve guardada.
    if (!cancelada(m)) {
      T.staff_block.push({
        staff_id: m.pessoa.id,
        unit_id: m.loja.id,
        appointment_item_id: item.id,
        during: `[${iso(item.ini)},${iso(item.fim)})`,
        created_at: iso(m.criada),
      })
    }
  })

  for (const e of m.eventos) {
    T.appointment_status_event.push({
      appointment_id: m.id,
      from_status: e.de,
      to_status: e.para,
      by_staff_id: e.quem?.id ?? null,
      by_client: e.cliente,
      reason: e.motivo,
      at: iso(e.at),
    })
  }
}

for (const a of avisos) {
  T.notification_log.push({
    org_id: org.id,
    unit_id: a.m.loja.id,
    appointment_id: a.m.id,
    client_id: a.m.cliente.id,
    routine: a.routine,
    channel: 'whatsapp',
    message_snapshot: null,
    sent_by_staff_id: a.quem.id,
    sent_at: iso(a.at),
  })
}

// ---------------------------------------------------------------------
// Conferir antes de escrever
// ---------------------------------------------------------------------

/*
 * Um `undefined` numa linha rebenta o insert a meio, com uma mensagem
 * do postgres.js que não diz qual tabela nem qual coluna. Aqui diz.
 */
function validar(tabela, linhas) {
  if (linhas.length === 0) return
  const colunas = Object.keys(linhas[0])
  linhas.forEach((linha, i) => {
    const chaves = Object.keys(linha)
    if (chaves.length !== colunas.length || colunas.some((k) => !(k in linha))) {
      throw new Error(`${tabela}[${i}]: colunas diferentes das da primeira linha`)
    }
    for (const k of chaves) {
      const v = linha[k]
      if (v === undefined) throw new Error(`${tabela}[${i}].${k} está indefinido`)
      if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`${tabela}[${i}].${k} = ${v}`)
    }
  })
}

for (const [tabela, linhas] of Object.entries(T)) validar(tabela, linhas)

// ---------------------------------------------------------------------
// As contas — as mesmas que o painel e a página dos avisos fazem
// ---------------------------------------------------------------------

const fmt = (n) => n.toLocaleString('pt-PT')
const pct = (x) => `${Math.round(x * 100)}%`
const euros = (c) => `${fmt(Math.round(c / 100))} €`

/*
 * A OCUPAÇÃO COMO O PAINEL A CONTA (lib/ocupacao.ts): minutos com
 * trabalho marcado sobre minutos escalados — a escala e os turnos, menos
 * as ausências. Não se apara ao horário da loja, e um feriado com gente
 * escalada conta como horas por vender, tal como lá. O almoço também.
 */
function escaladoDoDia(dia) {
  const wd = diaDaSemana(dia)
  let total = 0
  for (const p of pessoas) {
    const janelas = []
    for (const linhas of Object.values(p.escala ?? {})) {
      for (const [w, a, b] of linhas) if (w === wd) janelas.push([hhmm(a), hhmm(b)])
    }
    for (const slug of p.lojas) {
      const turno = turnos.get(`${p.login}|${slug}|${dia}`)
      if (turno) janelas.push(turno)
    }
    const fora = ausente.get(p.login)?.get(dia) ?? []
    for (const [a, b] of janelas) {
      let minutos = b - a
      for (const [x, y] of fora) minutos -= Math.max(0, Math.min(b, y) - Math.max(a, x))
      total += Math.max(0, minutos)
    }
  }
  return total
}

let vendidoPorDia = null
function ocupacao(a, b) {
  if (!vendidoPorDia) {
    vendidoPorDia = new Map()
    for (const m of todas) {
      if (cancelada(m)) continue
      vendidoPorDia.set(m.dia, (vendidoPorDia.get(m.dia) ?? 0) + (m.fim - m.ini) / MIN)
    }
  }
  let vendido = 0
  let escalado = 0
  for (let d = a; d <= b; d = somaDias(d, 1)) {
    vendido += vendidoPorDia.get(d) ?? 0
    escalado += escaladoDoDia(d)
  }
  return escalado > 0 ? Math.min(1, vendido / escalado) : null
}

/** As janelas do painel (lib/periodo.ts): o anterior começa no sítio análogo e nunca pisa o corrente. */
function janelaDoPainel(de, ate, deAnt) {
  const fim = somaDias(deAnt, diasEntre(de, ate))
  const vespera = somaDias(de, -1)
  return { de, ate, deAnt, ateAnt: fim < vespera ? fim : vespera }
}

function painel() {
  const visitas = new Map()
  for (const m of todas) {
    if (!feita(m)) continue
    if (!visitas.has(m.cliente)) visitas.set(m.cliente, [])
    visitas.get(m.cliente).push(m.dia)
  }
  const numeros = (a, b) => {
    let novas = 0
    let voltaram = 0
    for (const lista of visitas.values()) {
      const primeira = lista.reduce((x, y) => (y < x ? y : x))
      const dentro = lista.some((d) => d >= a && d <= b)
      if (primeira >= a && primeira <= b) novas++
      else if (dentro && primeira < a) voltaram++
    }
    const doPeriodo = todas.filter((m) => m.dia >= a && m.dia <= b)
    const feitas = doPeriodo.filter(feita)
    const receita = feitas.reduce((t, m) => t + valor(m), 0)
    // A taxa do painel: as faltas sobre quem apareceu mais quem faltou.
    const nFaltas = doPeriodo.filter((m) => m.estado === 'no_show').length
    const faltas = feitas.length + nFaltas > 0 ? nFaltas / (feitas.length + nFaltas) : null
    return { novas, voltaram, receita, faltas, ocupacao: ocupacao(a, b) }
  }
  const lado = (j) => ({ ...j, agora: numeros(j.de, j.ate), antes: numeros(j.deAnt, j.ateAnt) })

  const primeiro = `${HOJE.slice(0, 7)}-01`
  const mes = janelaDoPainel(primeiro, HOJE, `${somaDias(primeiro, -1).slice(0, 7)}-01`)
  const semana = janelaDoPainel(somaDias(HOJE, -6), HOJE, somaDias(HOJE, -13))
  const dia = janelaDoPainel(HOJE, HOJE, somaDias(HOJE, -1))

  const limite = somaDias(HOJE, -90)
  let sumiram = 0
  for (const lista of visitas.values()) {
    if (lista.reduce((x, y) => (y > x ? y : x)) < limite) sumiram++
  }
  return { dia: lado(dia), semana: lado(semana), mes: lado(mes), sumiram }
}

function filas() {
  const ontem = somaDias(HOJE, -1)
  const amanha = somaDias(HOJE, 1)
  const enviados = new Set(avisos.map((a) => `${a.m.id}|${a.routine}`))
  const falta = (m, r) => !enviados.has(`${m.id}|${r}`)
  const aberta = (m) => m.estado === 'booked' || m.estado === 'confirmed'
  const comFutura = new Set(
    todas
      .filter((m) => m.ini >= AGORA && ['booked', 'confirmed', 'checked_in', 'in_service'].includes(m.estado))
      .map((m) => m.cliente),
  )
  const conta = (f) => todas.filter(f).length
  return {
    confirm: conta((m) => aberta(m) && m.ini >= AGORA && falta(m, 'confirm')),
    reminder_eve: conta((m) => aberta(m) && m.dia === amanha && falta(m, 'reminder_eve')),
    reminder_today: conta(
      (m) => aberta(m) && m.dia === HOJE && m.ini >= AGORA && falta(m, 'reminder_today'),
    ),
    review: conta((m) => feita(m) && m.dia === ontem && falta(m, 'review')),
    winback: conta(
      (m) =>
        (m.estado === 'no_show' || m.estado === 'cancelled_by_client') &&
        m.ini < AGORA &&
        m.dia >= somaDias(HOJE, -30) &&
        falta(m, 'winback') &&
        !comFutura.has(m.cliente),
    ),
  }
}

function resumo() {
  const P = painel()
  const F = filas()
  const futuras = marcacoes.filter((m) => m.ini > AGORA && !cancelada(m)).length
  const deHoje = marcacoes.filter((m) => m.o === 0 && !cancelada(m)).length
  console.log(
    `  ${lojas.length} lojas, ${servicos.length} serviços, ${pessoas.length} pessoas na equipa`,
  )
  console.log(
    `  ${fmt(ativas.length)} clientes, ${fmt(todas.length)} marcações — ${deHoje} hoje, ${fmt(futuras)} por vir`,
  )
  const variacao = (a, b) => (b > 0 ? `${a >= b ? '+' : '−'}${Math.round(Math.abs(a / b - 1) * 100)}%` : '—')
  const taxa = (x) => (x === null ? '—' : `${(x * 100).toFixed(1).replace('.', ',')}%`)
  const linha = (nome, j) => {
    console.log(
      `  ${nome.padEnd(9)} faturação ${euros(j.agora.receita)} (${variacao(j.agora.receita, j.antes.receita)}) · ` +
        `ocupação ${j.agora.ocupacao === null ? '—' : pct(j.agora.ocupacao)} ` +
        `(antes ${j.antes.ocupacao === null ? '—' : pct(j.antes.ocupacao)}) · ` +
        `faltas ${taxa(j.agora.faltas)} (antes ${taxa(j.antes.faltas)})`,
    )
    console.log(
      `  ${''.padEnd(9)} novas ${j.agora.novas} (antes ${j.antes.novas}) · ` +
        `voltaram ${j.agora.voltaram} (antes ${j.antes.voltaram})`,
    )
  }
  console.log('\n  No painel, contra o período anterior:')
  linha('Hoje', P.dia)
  linha('7 dias', P.semana)
  linha('Este mês', P.mes)
  /*
   * O painel compara o que já passou de hoje com dias anteriores
   * inteiros: de manhã, a faturação aparece a descer mesmo numa casa a
   * crescer. Quem vai gravar tem de saber disto antes de carregar no REC.
   */
  const aDescer = [['Hoje', P.dia], ['7 dias', P.semana], ['Este mês', P.mes]]
    .filter(([, j]) => j.agora.receita < j.antes.receita)
    .map(([nome]) => `«${nome}»`)
  if (aDescer.length) {
    console.log(
      `  ↳ A faturação aparece a descer em ${aDescer.join(', ')}: o painel compara o dia de hoje,\n` +
        `    ainda a meio, com dias inteiros. Sobe ao longo do dia (hora de ${TZ}).`,
    )
  }
  console.log(`  Sumidas há mais de 90 dias: ${P.sumiram}.`)
  console.log(
    `  Avisos por mandar: ${F.confirm} confirmações, ${F.reminder_eve} lembretes de véspera, ` +
      `${F.reminder_today} de hoje, ${F.review} opiniões, ${F.winback} para recuperar.`,
  )
}

function ensaio() {
  console.log(`Ensaio de «${REDE.nome}» — hoje é ${HOJE}, ${dois(Math.floor(AGORA_MIN / 60))}:${dois(AGORA_MIN % 60)} em ${TZ}.\n`)

  console.log('Linhas por tabela:')
  for (const [tabela, linhas] of Object.entries(T)) {
    console.log(`  ${tabela.padEnd(26)} ${fmt(linhas.length).padStart(7)}`)
  }

  console.log('\nEstados:')
  const porEstado = new Map()
  for (const m of todas) porEstado.set(m.estado, (porEstado.get(m.estado) ?? 0) + 1)
  for (const [estado, n] of porEstado) console.log(`  ${estado.padEnd(22)} ${fmt(n).padStart(6)}`)

  console.log('\nOrigem, por mês:')
  const porMes = new Map()
  for (const m of marcacoes) {
    const mes = m.dia.slice(0, 7)
    if (!porMes.has(mes)) porMes.set(mes, new Map())
    const conta = porMes.get(mes)
    conta.set(m.origem, (conta.get(m.origem) ?? 0) + 1)
  }
  for (const [mes, conta] of [...porMes].sort()) {
    const total = [...conta.values()].reduce((t, n) => t + n, 0)
    const partes = Object.keys(ORIGENS).map((o) => `${o} ${pct((conta.get(o) ?? 0) / total)}`)
    console.log(`  ${mes}  ${String(total).padStart(5)}  ${partes.join('  ')}`)
  }

  console.log('\nOcupação, como o painel a conta:')
  const faixa = (a, b) => {
    const o = ocupacao(somaDias(HOJE, a), somaDias(HOJE, b))
    return o === null ? '—' : pct(o)
  }
  console.log(
    `  passado ${faixa(-HIST, -1)} (primeiro mês ${faixa(-HIST, -HIST + 29)}, último ${faixa(-30, -1)})` +
      ` · hoje ${faixa(0, 0)} · 7 dias ${faixa(1, 7)} · 8 a ${FUT} ${faixa(8, FUT)}`,
  )

  console.log('\nVisitas por cliente (feitas, nos quatro meses):')
  const baldes = [
    ['0', (n) => n === 0],
    ['1', (n) => n === 1],
    ['2', (n) => n === 2],
    ['3–4', (n) => n >= 3 && n <= 4],
    ['5–8', (n) => n >= 5 && n <= 8],
    ['9+', (n) => n >= 9],
  ]
  for (const [nome, cabe] of baldes) {
    const porPerfil = {}
    for (const c of ativas) {
      if (cabe(c.feitas.length)) porPerfil[c.perfil] = (porPerfil[c.perfil] ?? 0) + 1
    }
    const total = Object.values(porPerfil).reduce((t, n) => t + n, 0)
    const partes = Object.entries(porPerfil).map(([p, n]) => `${p} ${n}`)
    console.log(`  ${nome.padEnd(4)} ${String(total).padStart(5)}   ${partes.join(', ')}`)
  }
  console.log(`  (novas sem marcação, deixadas de fora: ${clientes.length - ativas.length})`)

  console.log('\nFamílias (marcações não canceladas):')
  for (const cat of CATALOGO) {
    const delas = marcacoes.filter((m) => !cancelada(m) && m.itens[0].servico.categoria === cat.slug)
    const quem = new Set(delas.map((m) => m.cliente))
    console.log(
      `  ${cat.slug.padEnd(22)} ${String(delas.length).padStart(5)} marcações, ${String(quem.size).padStart(4)} clientes, ` +
        `${(delas.length / Math.max(1, quem.size)).toFixed(1)} por cliente`,
    )
  }

  console.log('\nHoje, por loja:')
  for (const loja of lojas) {
    const conta = new Map()
    for (const m of marcacoes) {
      if (m.o === 0 && m.loja === loja) conta.set(m.estado, (conta.get(m.estado) ?? 0) + 1)
    }
    const partes = [...conta].map(([e, n]) => `${e} ${n}`)
    console.log(`  ${loja.slug.padEnd(10)} ${partes.join(', ') || 'fechada'}`)
  }

  console.log('\nResumo:')
  resumo()

  if (avisosDoEnsaio.length) {
    console.log('\nA ver:')
    for (const a of avisosDoEnsaio) console.log(`  · ${a}`)
  }
}

// ---------------------------------------------------------------------
// Escrever
// ---------------------------------------------------------------------

/** scrypt$N$r$p$sal$chave — o mesmo formato de lib/auth/password.ts. */
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

async function inserir(tx, tabela, linhas) {
  if (linhas.length === 0) return
  const colunas = Object.keys(linhas[0])
  // O Postgres aceita até 65 535 parâmetros por instrução.
  const porLote = Math.max(1, Math.floor(60000 / colunas.length))
  for (let i = 0; i < linhas.length; i += porLote) {
    await tx`insert into ${tx(tabela)} ${tx(linhas.slice(i, i + porLote), colunas)}`
  }
}

async function grava() {
  let senha = process.env.DEMO_SENHA ?? ''
  const sorteada = !senha
  if (sorteada) senha = randomBytes(9).toString('base64url')
  if (senha.length < 8) {
    await sql.end({ timeout: 5 })
    falha('A DEMO_SENHA precisa de pelo menos 8 caracteres — é a regra da entrada.')
  }
  for (const linha of T.staff) linha.password_hash = await hashPassword(senha)

  const inicio = Date.now()
  try {
    await sql.begin(async (tx) => {
      await tx`truncate table org cascade`
      await tx`truncate table session, otp_code, rate_limit`
      for (const [tabela, linhas] of Object.entries(T)) await inserir(tx, tabela, linhas)
    })
  } catch (error) {
    console.error('\nFalhou — a base ficou como estava:', error?.message ?? error)
    if (error?.table_name) console.error('tabela:', error.table_name)
    if (error?.detail) console.error('detalhe:', error.detail)
    process.exitCode = 1
    return
  } finally {
    await sql.end({ timeout: 5 })
  }

  console.log(`Semeado em ${Math.round((Date.now() - inicio) / 1000)} s:`)
  resumo()

  const papel = { owner: 'dona', manager: 'gerente', professional: 'profissional' }
  console.log('\nPara entrar, em /entrar:')
  for (const p of pessoas) {
    console.log(`  ${p.login.padEnd(10)} ${p.nome.padEnd(20)} ${papel[p.papel]}`)
  }
  if (sorteada) {
    console.log(`\n  Palavra-passe, a mesma para todas: ${senha}`)
    console.log('  (sorteada agora e não ficou escrita em lado nenhum — guarde-a já,')
    console.log('   ou defina a DEMO_SENHA antes de voltar a semear)')
  } else {
    console.log('\n  Palavra-passe: a da DEMO_SENHA, a mesma para todas.')
  }
  if (avisosDoEnsaio.length) {
    console.log('\nA ver:')
    for (const a of avisosDoEnsaio) console.log(`  · ${a}`)
  }
}

if (ENSAIO) ensaio()
else await grava()
