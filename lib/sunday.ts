import { weekdayOf, type IsoDay } from '@/lib/time'

/**
 * O DOMINGO É OUTRO DIA.
 *
 * A casa abre ao domingo com a equipa reduzida e sem a divisão de
 * trabalho dos outros dias: fisicamente, quem estiver lá atende quem
 * chegar, e quem atende quem decide-se no salão, entre elas, no
 * próprio dia. O sistema não tem nada a dizer sobre isso.
 *
 * Duas consequências, e ambas são de negócio — não de catálogo nem de
 * escala. Por isso vivem aqui, num sítio só, e não numa coluna da base
 * de dados: mudar a regra é mudar este ficheiro, e não uma migração
 * com dados a reboque.
 *
 * PRIMEIRA — não se escolhe profissional. O passo dela salta-se por
 * inteiro. Não é um passo escondido com um valor por omissão lá
 * dentro: é um passo que ao domingo não existe, porque a pergunta que
 * ele faz («com quem?») não tem resposta que a casa queira dar antes
 * do dia. Quem segura o bloco na agenda continua a ser alguém — todo o
 * `staff_block` precisa de um `staff_id`, e a grelha de segunda-feira
 * precisa de o mostrar em alguma linha — mas isso é arrumação interna,
 * escolhida pelo motor como já escolhe ao balcão, e a cliente nunca vê
 * o nome.
 *
 * SEGUNDA — a ementa encolhe. Ao domingo só se faz cabelo. O resto não
 * desaparece: fica à vista, dito «sob consulta», com uma conversa de
 * WhatsApp já escrita por baixo. É a mesma regra que rege o resto
 * desta casa — só se oferece o que se pode cumprir, e quem não pode
 * ser servido vê porquê e vê a saída.
 *
 * TERCEIRA — a agenda de domingo é de todas. Nos outros dias cada
 * profissional vê a coluna dela e mais nenhuma, porque nos outros dias
 * o trabalho dela é dela. Ao domingo não é: a marcação entra em nome de
 * quem o motor escolheu, mas quem a pega decide-se no salão, entre
 * elas — e ninguém pode escolher pegar aquilo que não vê. Por isso ao
 * domingo a peneira cai: todas veem o dia inteiro, todas as colunas, e
 * mexem no que lá está.
 */

/** 0 = domingo, na convenção do `weekdayOf` e do `business_hours`. */
const SUNDAY = 0

export function isSunday(day: IsoDay): boolean {
  return weekdayOf(day) === SUNDAY
}

/**
 * As categorias que se marcam ao domingo, pelo `slug` — que é o nome
 * que não muda de língua nem de mão. Uma categoria que não esteja
 * nesta lista é «sob consulta»: aparece, mas não se marca.
 *
 * Pelo `slug` e não pelo `id`: os identificadores nascem em cada
 * instalação e não se podem escrever num ficheiro; os slugs são
 * escolhidos por quem monta o catálogo e são estáveis.
 */
export const SUNDAY_CATEGORIES: readonly string[] = [
  'cabelo',
  'coloracao',
  'tratamentos-capilares',
  'barbearia',
]

/**
 * Esta categoria marca-se neste dia?
 *
 * Nos outros seis dias marca-se tudo — a pergunta só tem peso ao
 * domingo, e é de propósito que ela recebe o dia em vez de ser feita
 * só quando já se sabe que é domingo: assim quem chama não tem de se
 * lembrar de perguntar duas coisas.
 */
export function categoryOpenOn(day: IsoDay, categorySlug: string): boolean {
  if (!isSunday(day)) return true
  return SUNDAY_CATEGORIES.includes(categorySlug)
}

/**
 * A cliente escolhe a profissional neste dia?
 *
 * O funil inteiro pergunta isto: o passo dela, os que o revalidam
 * atrás, e o rasto de migalhas lá em cima que ainda apontava para um
 * passo que ao domingo não existe.
 */
export function picksStaffOn(day: IsoDay): boolean {
  return !isSunday(day)
}

/**
 * A agenda deste dia é só de quem a trabalha?
 *
 * Devolve `true` nos seis dias em que cada profissional vê a coluna
 * dela e mais nenhuma. Ao domingo devolve `false`: a grelha abre
 * inteira para toda a gente, e o que lá está pode ser mexido por
 * qualquer uma delas.
 *
 * A pergunta é sobre O DIA QUE SE ESTÁ A VER, e não sobre hoje. Uma
 * profissional que abra o domingo a meio de uma segunda-feira continua
 * a ver o domingo inteiro: é o dia da grelha que manda, porque é sobre
 * esse dia que ela precisa de saber quem ficou com o quê.
 *
 * Isto peneira o que se VÊ, não o que se pode fazer: acima da
 * profissional — gerência, recepção — já ninguém era peneirado, e
 * continua a não ser.
 */
export function agendaIsPrivateOn(day: IsoDay): boolean {
  return !isSunday(day)
}
