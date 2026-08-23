/**
 * O ESTADO DA CASA, NUMA PÁGINA.
 *
 * Diz o que está lá dentro e, sobretudo, o que falta antes de alguém
 * usar isto a sério: quem não tem palavra-passe (não entra), quem não
 * tem horário (não aparece na marcação), lojas sem fotografia, e a
 * marcação de teste que ficou para trás.
 *
 * Só lê. Nunca escreve nada.
 *
 *   node scripts/estado.mjs           (base local)
 *   node scripts/_prod.mjs estado     (Supabase)
 */
import { ligar, loadEnv, hostOf } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const host = hostOf(url)

const sql = ligar()

const avisos = []
const linha = (rotulo, valor) => console.log(`  ${rotulo.padEnd(26)}${valor}`)

try {
  console.log(`\n  ESTADO — ${host}\n  ${'─'.repeat(52)}`)

  // ---- a casa --------------------------------------------------------
  const [org] = await sql`select name, slug from org limit 1`
  if (!org) {
    console.log('  Sem organização. A base está vazia — falta o seed.')
    process.exit(0)
  }
  linha('Casa', org.name)

  const lojas = await sql`
    select u.name, u.slug, u.is_active,
           (select count(*)::int from unit_photo p where p.unit_id = u.id) as fotos,
           (select count(*)::int from business_hours h where h.unit_id = u.id) as horario
      from unit u order by u.sort_order
  `
  console.log('')
  for (const l of lojas) {
    const notas = []
    if (!l.is_active) notas.push('DESLIGADA')
    if (l.fotos === 0) notas.push('sem fotografias')
    if (l.horario === 0) notas.push('SEM HORÁRIO — não aceita marcações')
    linha(
      `Loja · ${l.name}`,
      `${l.fotos} foto(s), ${l.horario} dia(s) de horário` +
        (notas.length ? `   ← ${notas.join(', ')}` : ''),
    )
    if (l.horario === 0) avisos.push(`${l.name} não tem horário — ninguém consegue marcar lá.`)
    if (l.fotos === 0) avisos.push(`${l.name} não tem fotografias — o site mostra o monograma.`)
  }

  // ---- preçário ------------------------------------------------------
  const [servicos] = await sql`
    select count(*)::int as total,
           count(*) filter (where is_active)::int as activos,
           count(*) filter (where is_active and bookable_online)::int as online,
           count(image_url)::int as com_foto
      from service
  `
  console.log('')
  linha('Serviços', `${servicos.total} (${servicos.activos} activos, ${servicos.online} online)`)
  linha('  com fotografia', String(servicos.com_foto))
  if (servicos.online === 0) {
    avisos.push('Nenhum serviço está marcável online — o funil não tem nada para mostrar.')
  }

  // ---- equipa --------------------------------------------------------
  const equipa = await sql`
    select s.name, s.phone, s.is_active,
           (s.password_hash is not null) as senha,
           s.public_alias,
           (select string_agg(r.role, '+') from staff_role r where r.staff_id = s.id) as papeis,
           (select count(*)::int from staff_schedule h where h.staff_id = s.id) as horario
      from staff s order by s.sort_order
  `
  console.log('')
  for (const p of equipa) {
    const notas = []
    if (!p.senha) notas.push('SEM PALAVRA-PASSE')
    if (p.horario === 0) notas.push('sem horário')
    if (!p.is_active) notas.push('desligada')
    if (p.public_alias) notas.push(`aparece como «${p.public_alias}»`)
    linha(
      `Equipa · ${p.name}`,
      `${p.papeis ?? 'sem papel'}   ${p.phone}` + (notas.length ? `   ← ${notas.join(', ')}` : ''),
    )
  }
  const semSenha = equipa.filter((p) => p.is_active && !p.senha)
  if (semSenha.length) {
    avisos.push(
      `${semSenha.length} pessoa(s) sem palavra-passe: ${semSenha
        .map((p) => p.name)
        .join(', ')}. Não entram no sistema.`,
    )
  }
  const donas = equipa.filter((p) => (p.papeis ?? '').includes('owner') && p.senha)
  if (donas.length === 0) {
    avisos.push('NINGUÉM PODE ENTRAR: a dona não tem palavra-passe.')
  }

  // ---- movimento -----------------------------------------------------
  const [mov] = await sql`
    select (select count(*)::int from client) as clientes,
           (select count(*)::int from appointment) as marcacoes,
           (select count(*)::int from appointment where starts_at >= now()) as futuras,
           (select count(*)::int from appointment where closed_at is not null) as fechadas,
           (select count(*)::int from cash_session where status = 'open') as caixas_abertas,
           (select count(*)::int from commission_entry where status = 'pending') as comissoes
  `
  console.log('')
  linha('Clientes', String(mov.clientes))
  linha('Marcações', `${mov.marcacoes} (${mov.futuras} por vir, ${mov.fechadas} fechadas)`)
  linha('Caixas abertas', String(mov.caixas_abertas))
  linha('Comissões por pagar', String(mov.comissoes))

  // Dados de ensaio que não devem chegar ao dia de abrir.
  const [teste] = await sql`
    select count(*)::int as n from client
     where phone in ('+351999888777') or name ilike '%teste%'
  `
  if (teste.n > 0) {
    avisos.push(`${teste.n} cliente(s) de teste na base. \`limpar --a-serio\` leva-os.`)
  }

  // ---- esquema -------------------------------------------------------
  const [mig] = await sql`select count(*)::int as n from schema_migrations`
  const travas = await sql`
    select count(*)::int as n from pg_constraint where contype = 'x'
  `
  console.log('')
  linha('Migrações aplicadas', String(mig.n))
  linha('Travas anti-sobreposição', String(travas[0].n))
  if (travas[0].n === 0) {
    avisos.push('SEM TRAVAS DE SOBREPOSIÇÃO na base — duas clientes podem marcar a mesma hora.')
  }

  // ---- o que falta ---------------------------------------------------
  console.log(`\n  ${'─'.repeat(52)}`)
  if (avisos.length === 0) {
    console.log('  Nada a apontar. Pode abrir a casa.\n')
  } else {
    console.log(`  FALTA RESOLVER (${avisos.length}):\n`)
    for (const a of avisos) console.log(`   · ${a}`)
    console.log('')
  }
} finally {
  await sql.end()
}
