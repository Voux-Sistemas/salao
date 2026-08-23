/**
 * ESCREVER O PREÇÁRIO EM INGLÊS E EM ESPANHOL.
 *
 * A migração `20260823140000` abre as colunas `name_en` / `name_es` e
 * deixa-as vazias — o esquema não sabe nada de nenhum salão em
 * particular. Este guião pega nas traduções do preçário da casa
 * (`catalogo-linguas.mjs`) e escreve-as por cima, procurando cada
 * serviço pelo `slug`.
 *
 * É seguro repetir: só toca nestas quatro colunas, e um serviço que
 * não esteja na lista fica como está — em português, que é como se
 * mostrava antes.
 *
 * E NÃO ESCREVE POR CIMA DO QUE JÁ LÁ ESTÁ. A dona traduz serviços na
 * ficha de cada um («Nas outras línguas»), e o que ela escreveu vale
 * mais do que esta lista: aqui só se preenchem os vazios. Para repor a
 * lista à força — depois de a corrigir, por exemplo — usa-se --forcar.
 *
 *   node scripts/traduzir.mjs              (base local, lê o .env)
 *   node scripts/traduzir.mjs --forcar     (repõe a lista por cima)
 *   node scripts/_prod.mjs traduzir        (Supabase)
 */
import { ligar, loadEnv, hostOf } from './_ligar.mjs'
import { CATEGORIAS, SERVICOS } from './catalogo-linguas.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const sql = ligar()
const forcar = process.argv.includes('--forcar')

console.log(
  `Preçário nas três línguas — ${hostOf(url)}` +
    (forcar ? ' — a repor a lista por cima do que lá está' : '') +
    '\n',
)

let categorias = 0
const semCategoria = []
for (const [slug, { en, es }] of Object.entries(CATEGORIAS)) {
  const linhas = forcar
    ? await sql`
        update service_category set name_en = ${en}, name_es = ${es}
         where slug = ${slug}
        returning id
      `
    : await sql`
        update service_category set
          name_en = coalesce(nullif(btrim(name_en), ''), ${en}),
          name_es = coalesce(nullif(btrim(name_es), ''), ${es})
         where slug = ${slug}
        returning id
      `
  if (linhas.length === 0) semCategoria.push(slug)
  categorias += linhas.length
}

let servicos = 0
const semServico = []
for (const [slug, { en, es }] of Object.entries(SERVICOS)) {
  const linhas = forcar
    ? await sql`
        update service set name_en = ${en}, name_es = ${es}
         where slug = ${slug}
        returning id
      `
    : await sql`
        update service set
          name_en = coalesce(nullif(btrim(name_en), ''), ${en}),
          name_es = coalesce(nullif(btrim(name_es), ''), ${es})
         where slug = ${slug}
        returning id
      `
  if (linhas.length === 0) semServico.push(slug)
  servicos += linhas.length
}

// O contrário também interessa: um serviço criado ao balcão depois
// desta lista ter sido escrita fica sem tradução, e ninguém dá por
// isso até uma cliente inglesa abrir o preçário.
const porTraduzir = await sql`
  select slug, name from service
   where is_active
     and (nullif(btrim(name_en), '') is null or nullif(btrim(name_es), '') is null)
   order by slug
`

const categoriasPorTraduzir = await sql`
  select slug, name from service_category
   where is_active
     and (nullif(btrim(name_en), '') is null or nullif(btrim(name_es), '') is null)
   order by slug
`

console.log(`  Categorias .... ${categorias} de ${Object.keys(CATEGORIAS).length}`)
console.log(`  Serviços ...... ${servicos} de ${Object.keys(SERVICOS).length}`)

if (semCategoria.length > 0) {
  console.log(`\n  Categorias que a base não tem: ${semCategoria.join(', ')}`)
}
if (semServico.length > 0) {
  console.log(`\n  Serviços que a base não tem: ${semServico.join(', ')}`)
}
if (categoriasPorTraduzir.length > 0) {
  console.log(
    `\n  Categorias ainda sem tradução (${categoriasPorTraduzir.length}):`,
  )
  for (const c of categoriasPorTraduzir) console.log(`    · ${c.name}`)
}
if (porTraduzir.length > 0) {
  console.log(`\n  Ainda sem tradução (${porTraduzir.length}) — mostram-se em português:`)
  for (const s of porTraduzir) console.log(`    · ${s.name}`)
}
if (porTraduzir.length === 0 && categoriasPorTraduzir.length === 0) {
  console.log('\n  Está tudo traduzido.')
}

await sql.end()
