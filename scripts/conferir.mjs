/** Confere, sem escrever nada, se tudo o que se pediu ficou aplicado. */
import { ligar } from './_ligar.mjs'
const sql = ligar()
const ok = (b) => (b ? 'SIM' : '>>> NAO <<<')

const estados = await sql`select status, count(*)::int n from appointment group by status order by status`
const presas = await sql`select count(*)::int n from appointment where status='booked' and starts_at >= now()`
const excl = await sql`select conname from pg_constraint where contype='x' order by conname`
const idx = await sql`select 1 from pg_class where relname='staff_block_staff_during_idx'`
const lojas = await sql`select name, min_lead_minutes, slot_granularity_minutes from unit order by name`
const folgas = await sql`select count(*)::int n from service where buffer_before_minutes<>0 or buffer_after_minutes<>0`
const folgasFut = await sql`select count(*)::int n from appointment_item where starts_at>=now() and (buffer_before_minutes<>0 or buffer_after_minutes<>0)`
const modelos = await sql`select routine, language from message_template order by routine, language`

console.log('1. Marcacoes futuras presas em «Marcada»:', presas[0].n, '->', ok(presas[0].n === 0))
console.log('   Estados no livro:', estados.map(r=>`${r.status}: ${r.n}`).join(', '))
console.log('2. Sobreposicao da equipa libertada:', ok(!excl.some(r=>r.conname.startsWith('staff_block'))))
console.log('   Restricoes que restam:', excl.map(r=>r.conname).join(', ') || '(nenhuma)')
console.log('   Lavatorio ainda travado:', ok(excl.some(r=>r.conname.startsWith('resource_block'))))
console.log('3. Indice de procura criado:', ok(idx.length === 1))
console.log('4. Antecedencia minima a zero:', ok(lojas.every(l=>l.min_lead_minutes===0)))
console.log('   Grelha do site em 15:', ok(lojas.every(l=>l.slot_granularity_minutes===15)))
lojas.forEach(l=>console.log(`   ${l.name}: antecedencia ${l.min_lead_minutes}min, grelha ${l.slot_granularity_minutes}min`))
console.log('5. Servicos ainda com folga:', folgas[0].n, '->', ok(folgas[0].n===0))
console.log('   Marcacoes futuras com folga:', folgasFut[0].n, '->', ok(folgasFut[0].n===0))
console.log('6. Modelos guardados na base (sobrepoem-se ao codigo):',
  modelos.length ? modelos.map(r=>`${r.routine}/${r.language}`).join(', ') : 'nenhum -> usa o do codigo')
await sql.end()
