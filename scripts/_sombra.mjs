/** So leitura: quem sabe fazer os servicos com 'sombra' no nome, e a estrategia da loja. */
import { ligar } from './_ligar.mjs'
const sql = ligar()
const servicos = await sql`
  select s.id, s.name, c.slug as categoria
    from service s join service_category c on c.id = s.category_id
   where s.is_active and (s.name ilike '%sombra%' or s.name ilike '%sobran%')
   order by s.name`
for (const s of servicos) {
  const quem = await sql`
    select st.name, st.is_active, st.accepts_online_booking
      from staff_skill ss join staff st on st.id = ss.staff_id
     where ss.service_id = ${s.id} order by st.name`
  console.log(`\n${s.name} [${s.categoria}]`)
  for (const q of quem) console.log(`  - ${q.name}${q.is_active ? '' : ' (inactiva)'}`)
  if (quem.length === 0) console.log('  (ninguem tem a habilidade)')
}
const lojas = await sql`select slug, assignment_strategy from unit order by slug`
console.log('\nEstrategia de atribuicao por loja:')
for (const l of lojas) console.log(`  ${l.slug}: ${l.assignment_strategy}`)
