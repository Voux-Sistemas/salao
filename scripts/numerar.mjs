/**
 * A EQUIPA PASSA A SER NUMERADA — PROFISSIONAL 1, 2, 3.
 *
 * A casa não quer os nomes das pessoas dentro do sistema. Não é uma
 * preferência de ecrã: é a decisão da dona, e vale tanto na agenda como
 * na montra, no recibo e na lista da gestão. Quem lá está passa a ser
 * um número, pela ordem em que já estava.
 *
 * O QUE ISTO NÃO FAZ é apagar seja quem for. As escalas, as
 * habilidades, as lojas e as senhas ficam todas onde estavam. Muda o
 * nome, cai o `public_alias` — senão o site continuava a dizer o nome
 * antigo por outra porta — e o `login` passa a `prof1`, `prof2`, que
 * era o último sítio onde o nome próprio ainda estava escrito.
 *
 * A dona e o master ficam com o nome que têm: a dona é a casa (o nome
 * dela está na porta) e o master não aparece a cliente nenhuma. Só se
 * numera quem tem o papel de `professional`.
 *
 * Corre-se as vezes que forem precisas. À segunda não muda nada, porque
 * quem já se chama «Profissional 2» e está em segundo lugar fica na
 * mesma — e é por isso que a ordem vem do `sort_order` e não do nome.
 *
 *   node scripts/numerar.mjs                     (base local)
 *   node scripts/_prod.mjs numerar --a-serio     (Supabase)
 */
import { ligar, loadEnv, hostOf, isLocal } from './_ligar.mjs'

loadEnv()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta a DATABASE_URL (no .env ou no ambiente).')
  process.exit(1)
}

const host = hostOf(url)
const emCasa = isLocal(url)

// Renomear gente a sério não se faz por engano, mesmo sendo reversível
// à mão: exige-se a intenção escrita, como nos outros guiões.
if (!emCasa && !process.argv.includes('--a-serio')) {
  console.error(`Isto renomeia a equipa toda em ${host}.`)
  console.error('Se é mesmo o que quer, repita com --a-serio.')
  process.exit(1)
}

const sql = ligar()

try {
  console.log(`> numerar em ${host}\n`)

  const [org] = await sql`select id, name from org order by created_at limit 1`
  if (!org) {
    console.error('Não há salão nenhum nesta base.')
    process.exit(1)
  }

  /*
   * A ORDEM É A QUE A CASA JÁ TINHA.
   *
   * `sort_order` primeiro, nome a desempatar. É a mesma ordem por que a
   * agenda desenha as colunas e por que a gestão lista a equipa, e é
   * isso que faz o número significar alguma coisa: a Profissional 1 é a
   * da primeira coluna, não uma pessoa à sorte.
   */
  const profissionais = await sql`
    select s.id, s.name, s.public_alias, s.sort_order, s.login
      from staff s
     where s.org_id = ${org.id}
       and exists (
         select 1 from staff_role r
          where r.staff_id = s.id and r.role = 'professional'
       )
     order by s.sort_order, s.name
  `

  if (profissionais.length === 0) {
    console.log('  Não há profissionais nesta base. Nada a fazer.')
  } else {
    await sql.begin(async (tx) => {
      /*
       * PRIMEIRO APAGAM-SE AS ENTRADAS, DEPOIS DÃO-SE AS NOVAS.
       *
       * O `login` é único dentro da casa. Se a ordem tiver mudado entre
       * duas passagens, escrever `prof2` numa linha enquanto outra ainda
       * o tivesse esbarrava no índice a meio da volta. Apagam-se todos
       * de uma vez e só depois se numera — dentro da mesma transacção,
       * portanto ninguém fica sem entrada nem por um instante.
       */
      await tx`
        update staff set login = null
         where id in ${tx(profissionais.map((x) => x.id))}
      `
      for (const [i, p] of profissionais.entries()) {
        const nome = `Profissional ${i + 1}`
        await tx`
          update staff
             set name = ${nome},
                 public_alias = null,
                 login = ${`prof${i + 1}`},
                 sort_order = ${i + 1},
                 updated_at = now()
           where id = ${p.id}
        `
      }
    })

    for (const [i, p] of profissionais.entries()) {
      const nome = `Profissional ${i + 1}`
      const antes = p.public_alias ? `${p.name} («${p.public_alias}»)` : p.name
      console.log(
        antes === nome
          ? `  ${nome.padEnd(20)} já estava`
          : `  ${nome.padEnd(20)} era ${antes}`,
      )
    }
  }

  /*
   * O NOME ESTÁ EM MAIS DO QUE UM SÍTIO.
   *
   * Cada linha da comanda guarda o nome do serviço no momento em que
   * foi feita, de propósito — o preçário muda e o recibo antigo tem de
   * continuar a dizer o que se vendeu. O nome de quem fez NÃO é
   * copiado assim: lê-se sempre do `staff`. Confirma-se aqui, para
   * ninguém ficar com a ideia de que sobrou o nome antigo algures.
   */
  const [sobra] = await sql`
    select count(*)::int as n
      from information_schema.columns
     where table_schema = 'public'
       and column_name in ('staff_name', 'professional_name')
  `
  if (sobra.n > 0) {
    console.log(
      `\n  ATENÇÃO: há ${sobra.n} coluna(s) com o nome de quem fez copiado.`,
    )
    console.log('  Essas não mudam sozinhas — veja-as antes de dar isto por feito.')
  }

  // --- o retrato final ------------------------------------------------
  const equipa = await sql`
    select s.name, s.login, s.phone, s.sort_order, s.is_active,
           (select string_agg(r.role, '+' order by r.role)
              from staff_role r where r.staff_id = s.id) as papeis
      from staff s
     where s.org_id = ${org.id}
     order by s.sort_order, s.name
  `
  console.log('')
  for (const s of equipa) {
    console.log(
      `  ${String(s.name).padEnd(20)} ${String(s.login ?? '—').padEnd(10)}` +
        ` ${String(s.phone).padEnd(15)} ${s.papeis ?? '—'}` +
        (s.is_active ? '' : '   (inactiva)'),
    )
  }
  console.log('')
} finally {
  await sql.end()
}
