import 'server-only'
import { sql } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

/**
 * O CÓDIGO DO BALCÃO.
 *
 * É para o dia em que o tablet se desligar com a dona noutro salão: as
 * funcionárias escrevem-no na porta de entrada e o aparelho volta ao
 * balcão. E MAIS NADA — nunca a Gestão, nunca os números, faça-se o que
 * se fizer com ele.
 *
 * APONTA AO CONTRÁRIO DE UMA SENHA. Uma senha guarda o que está
 * fechado; este abre só o que já podia estar aberto. É por isso que
 * pode andar escrito num papel ao lado do tablet: não dá acesso a nada
 * que quem está ali não tenha à frente o dia todo.
 *
 * SEIS DÍGITOS NÃO TÊM ENTROPIA NENHUMA, e não é por descuido. O que o
 * protege não é ser difícil de adivinhar — é não abrir nada que valha a
 * pena adivinhar, e a casa poder trocá-lo num gesto. Guarda-se com o
 * mesmo `hashPassword` da equipa porque um segredo em claro na base de
 * dados é um hábito que não se deve começar, valha ele o que valer.
 *
 * UM CÓDIGO PARA TODOS OS SALÕES, por escolha da casa. Espalhando-se,
 * abre o balcão de qualquer um em vez de um só; em troca há um número
 * para toda a gente decorar.
 */

const DIGITOS = 6

export function codigoValido(codigo: string): boolean {
  return new RegExp(`^\\d{${DIGITOS}}$`).test(codigo.trim())
}

/** Um código novo, para a dona escrever no papel. */
export function gerarCodigo(): string {
  let saida = ''
  for (let i = 0; i < DIGITOS; i++) {
    saida += Math.floor(Math.random() * 10)
  }
  return saida
}

export type CodigoDoBalcao = {
  /** O código em claro, se a casa o guardou para o poder mostrar. */
  codigo: string | null
  definidoEm: Date | null
}

/**
 * GUARDA-SE TAMBÉM EM CLARO, e a decisão merece ser dita.
 *
 * Um código que ela não pode voltar a ver não serve para nada: quando o
 * tablet se desligar, ela está noutro salão e precisa de o ditar ao
 * telefone. Se só houvesse o resumo, a única saída era gerar outro — e
 * mandar reescrevê-lo em todos os tablets por causa de um.
 *
 * O que o torna aceitável é o que ele abre: o balcão, e nada mais. Não
 * é uma palavra-passe reutilizada nem um segredo que valha um assalto —
 * é o número da porta de serviço. O resumo fica na mesma, porque é por
 * ele que se verifica.
 */
export async function guardarCodigo(
  orgId: string,
  codigo: string,
): Promise<void> {
  const hash = await hashPassword(codigo)
  await sql`
    update org
       set balcao_code_hash = ${hash},
           balcao_code_plain = ${codigo},
           balcao_code_set_at = now()
     where id = ${orgId}
  `
}

export async function lerCodigo(orgId: string): Promise<CodigoDoBalcao> {
  const rows = await sql<
    { balcao_code_plain: string | null; balcao_code_set_at: Date | null }[]
  >`
    select balcao_code_plain, balcao_code_set_at from org where id = ${orgId}
  `
  const row = rows[0]
  return {
    codigo: row?.balcao_code_plain ?? null,
    definidoEm: row?.balcao_code_set_at ?? null,
  }
}

/**
 * Quem é que este código abre — ou nulo se não abre ninguém.
 *
 * Devolve a DONA da casa, porque é a sessão dela que o tablet vai
 * segurar. Sem código definido não abre nada: uma casa que nunca o
 * escolheu não tem porta de serviço.
 *
 * A ORG VEM DO ENDEREÇO, e neste sistema há uma só. Se um dia houver
 * duas, isto tem de passar a receber qual — e o código de uma nunca
 * pode abrir a outra.
 */
export async function quemAbreComCodigo(
  orgId: string,
  codigo: string,
): Promise<string | null> {
  if (!codigoValido(codigo)) return null

  const rows = await sql<{ hash: string | null }[]>`
    select balcao_code_hash as hash from org where id = ${orgId}
  `
  const hash = rows[0]?.hash
  if (!hash) return null

  const bate = await verifyPassword(codigo.trim(), hash)
  if (!bate) return null

  /*
    A DONA, e não uma pessoa qualquer com papel alto. Se houver mais do
    que uma, a mais antiga — para que o mesmo código abra sempre a mesma
    sessão e a lista dos aparelhos dela faça sentido.
  */
  const donas = await sql<{ id: string }[]>`
    select s.id
      from staff s
      join staff_role r on r.staff_id = s.id
     where s.org_id = ${orgId}
       and s.is_active
       and r.role in ('master', 'owner')
       and r.unit_id is null
     order by case r.role when 'owner' then 0 else 1 end, s.created_at
     limit 1
  `
  return donas[0]?.id ?? null
}
