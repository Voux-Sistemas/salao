import { sql } from '@/lib/db'
import { env } from '@/lib/env'
import { getOrg } from '@/lib/org'

/**
 * ATALHOS DE TESTE — APAGAR ANTES DE ENTREGAR.
 *
 * A porta da equipa é o telemóvel, e é isso que fica. Mas enquanto se
 * anda a olhar para os três acessos vinte vezes ao dia, escrever
 * «+351934730344» de cada vez é trabalho a mais. Então três nomes
 * curtos — admin, gerente, prof — passam a valer pelo telemóvel de
 * quem tem esse papel.
 *
 * O QUE ISTO **NÃO** FAZ: não salta a palavra-passe, não salta o
 * travão de tentativas, não cria conta nenhuma. Só troca o nome pelo
 * telemóvel e devolve a chamada ao caminho normal — a senha é
 * verificada exactamente como sempre foi.
 *
 * E não trabalha em produção: `env.isProduction` corta à cabeça. Numa
 * instalação a sério estes nomes não existem, mesmo que este ficheiro
 * fique cá esquecido.
 *
 * PARA APAGAR: este ficheiro, o import e as duas linhas do
 * `signInAction` em app/(auth)/entrar/actions.ts. Mais nada lhe toca.
 */

/** Nome curto → papel de quem se quer apanhar na base. */
const PAPEL = {
  admin: 'owner',
  gerente: 'manager',
  prof: 'professional',
} as const

/**
 * Devolve o telemóvel de quem tem o papel pedido, ou `null` — e `null`
 * é o caso normal, porque quase tudo o que se escreve aqui é um número
 * a sério. Escolhe-se pelo papel e não por um número escrito à mão para
 * isto funcionar em qualquer base: a local semeada, a de um colega, a
 * que for.
 */
export async function telefoneDeTeste(escrito: string): Promise<string | null> {
  if (env.isProduction) return null

  const papel = PAPEL[escrito.trim().toLowerCase() as keyof typeof PAPEL]
  if (!papel) return null

  const org = await getOrg()
  if (!org) return null

  /*
   * `order by` para que o mesmo nome dê sempre a mesma pessoa — sem
   * ordem, a base pode devolver hoje a Ariadna e amanhã a Filipa, e
   * um atalho que muda de dono não serve para testar nada.
   */
  const rows = await sql<{ phone: string }[]>`
    select s.phone
      from staff s
      join staff_role r on r.staff_id = s.id
     where s.org_id = ${org.id}
       and s.is_active
       and r.role = ${papel}
     order by s.sort_order, s.created_at
     limit 1
  `
  return rows[0]?.phone ?? null
}
