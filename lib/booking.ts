import 'server-only'
import { randomBytes } from 'node:crypto'
import type postgres from 'postgres'
import { isOverlapError, sql } from '@/lib/db'
import { planAt, type CartLine, type Channel, type Plan } from '@/lib/availability'
import type { Unit } from '@/lib/org'
import type { IsoDay } from '@/lib/time'
import type { Language } from '@/lib/i18n/config'

/**
 * O caminho de escrita da marcação.
 *
 * Duas regras mandam aqui:
 *
 *   · O plano NUNCA vem do navegador. O cliente manda o instante; o
 *     servidor replaneia quem faz o quê e em que recurso.
 *   · Entre "consultei e estava livre" e "gravei" há uma janela, e com
 *     concorrência ela é apanhada. A trava era da base de dados: uma
 *     restrição de exclusão em `staff_block` levantava 23P01 e nós
 *     respondíamos "esse horário acabou de ser preenchido".
 *
 *     ESSA RESTRIÇÃO JÁ NÃO EXISTE, e não pode voltar: é ela que teria
 *     de recusar o encaixe que a casa faz de propósito — a raiz de uma
 *     coloração repousa e nesse intervalo cabe um corte. A base não
 *     sabe distinguir a sobreposição escolhida da acidental.
 *
 *     Quem sabe é o motor. Por isso a trava mudou de sítio sem mudar de
 *     natureza: `pg_advisory_xact_lock` põe em fila quem escreve para a
 *     mesma profissional no mesmo dia, e o plano é REFEITO já dentro da
 *     transação, com a fila garantida. Quem chega depois vê o que o
 *     primeiro gravou. Continua a ser uma trava de verdade — só que
 *     agora entende a diferença entre encaixar e atropelar.
 *
 * E o invariante que atravessa tudo: horário ocupado é bloco existente.
 * Cancelar apaga os blocos — não há bloco cancelado para filtrar.
 */

export type Source = 'site' | 'counter' | 'phone' | 'whatsapp' | 'walk_in'

export type Status =
  | 'booked'
  | 'confirmed'
  | 'checked_in'
  | 'in_service'
  | 'completed'
  | 'cancelled_by_client'
  | 'cancelled_by_salon'
  | 'no_show'

export const CANCELLED_STATUSES: Status[] = [
  'cancelled_by_client',
  'cancelled_by_salon',
]

export const TERMINAL_STATUSES: Status[] = [
  'completed',
  'cancelled_by_client',
  'cancelled_by_salon',
  'no_show',
]

export function isCancelled(status: Status): boolean {
  return CANCELLED_STATUSES.includes(status)
}

export function isTerminal(status: Status): boolean {
  return TERMINAL_STATUSES.includes(status)
}

// ---------------------------------------------------------------------
// Cliente: o telefone é a identidade
// ---------------------------------------------------------------------

/**
 * O telefone é único na rede: a mesma cliente nas duas lojas é o mesmo
 * registo, e o histórico atravessa as lojas.
 *
 * SEM TELEFONE NÃO HÁ RECONHECIMENTO, e por isso nasce sempre uma ficha
 * nova. Não é um descuido: é a consequência inevitável de deixar marcar
 * sem número — não há nada por onde agarrar a pessoa que veio o mês
 * passado. Quem escrever o número mais tarde, ao balcão, passa a ter
 * uma ficha reconhecível daí para a frente; as antigas ficam onde
 * estão, e juntam-se à mão se alguém quiser.
 */
export async function findOrCreateClient(
  orgId: string,
  input: {
    phone: string | null
    name: string
    language?: Language
    email?: string | null
    preferredUnitId?: string | null
  },
): Promise<string> {
  if (!input.phone) {
    const novas = await sql<{ id: string }[]>`
      insert into client (org_id, phone, name, email, language, preferred_unit_id)
      values (
        ${orgId}, null, ${input.name}, ${input.email ?? null},
        ${input.language ?? 'pt'}, ${input.preferredUnitId ?? null}
      )
      returning id
    `
    const nova = novas[0]
    if (!nova) throw new Error('Não foi possível criar a ficha da cliente.')
    return nova.id
  }

  const rows = await sql<{ id: string }[]>`
    insert into client (org_id, phone, name, email, language, preferred_unit_id)
    values (
      ${orgId}, ${input.phone}, ${input.name}, ${input.email ?? null},
      ${input.language ?? 'pt'}, ${input.preferredUnitId ?? null}
    )
    on conflict (org_id, phone) do update
       set name = coalesce(nullif(excluded.name, ''), client.name),
           email = coalesce(excluded.email, client.email),
           -- a língua em que marcou é a língua em que se lhe fala depois
           language = excluded.language,
           preferred_unit_id = coalesce(client.preferred_unit_id, excluded.preferred_unit_id)
     returning id
  `
  const row = rows[0]
  if (!row) throw new Error('Não foi possível criar a ficha da cliente.')
  return row.id
}

// ---------------------------------------------------------------------
// Marcar
// ---------------------------------------------------------------------

export type BookingInput = {
  unit: Unit
  day: IsoDay
  cart: CartLine[]
  startsAt: Date
  channel: Channel
  source: Source
  clientId: string
  language: Language
  clientNote?: string | null
  internalNote?: string | null
  createdByStaffId?: string | null
  byClient?: boolean
  now?: Date
}

export type BookingResult =
  | { ok: true; appointmentId: string; plan: Plan }
  | { ok: false; reason: 'slot_taken' | 'unavailable' }

/**
 * Marca. E a marcação nasce CONFIRMADA.
 *
 * Havia aqui um degrau a mais: a marcação entrava «pedida» e alguém, do
 * lado da gestão, tinha de a confirmar à mão. Numa casa em que ninguém
 * recusa uma cliente que marcou, esse degrau não decidia nada — só
 * atrasava, e criava um estado em que a cliente já tinha recebido a
 * mensagem mas a agenda ainda não tratava a hora como vendida.
 *
 * O estado `booked` continua a existir para as marcações antigas que o
 * têm, e a transição para `confirmed` continua permitida. O que muda é
 * o ponto de partida.
 */
export async function createAppointment(
  input: BookingInput,
): Promise<BookingResult> {
  const now = input.now ?? new Date()

  // Duas tentativas: se a corrida for perdida e o carrinho tiver alguma
  // linha "sem preferência", o replaneamento seguinte já vê o bloco
  // recém-gravado e pode escolher outra profissional. Se não puder,
  // respondemos a verdade.
  for (let attempt = 0; attempt < 2; attempt++) {
    const plan = await planAt(
      input.unit,
      input.day,
      input.cart,
      input.startsAt,
      input.channel,
      now,
    )
    if (!plan) {
      return { ok: false, reason: attempt === 0 ? 'unavailable' : 'slot_taken' }
    }

    try {
      const written = await sql.begin(async (tx) => {
        // Primeiro a fila, depois a verdade. Enquanto este cadeado for
        // nosso, mais ninguém escreve para estas profissionais neste
        // dia — e o que se ler a seguir é o estado final, não uma
        // fotografia a envelhecer.
        await lockStaffDay(
          tx,
          plan.items.map((item) => item.staffId),
          input.day,
          input.clientId,
        )

        /*
         * O DUPLO CLIQUE MORRE AQUI, e não podia morrer noutro sítio.
         *
         * O botão desliga-se enquanto grava, mas isso não chega: o
         * clique antes de a página acordar, e a resposta que se perde
         * na rede e faz repetir o envio, chegam ambos ao servidor como
         * duas gravações legítimas. E a base não as recusa — a
         * restrição de exclusão da `staff_block` já não existe, e num
         * carrinho «sem preferência» o segundo replaneamento escolhe
         * OUTRA profissional, pelo que nem haveria sobreposição para
         * recusar. Era assim que os encaixes andavam a sair em dobro.
         *
         * A pergunta faz-se atrás do cadeado, onde as duas gravações
         * passam uma de cada vez: a mesma cliente, na mesma loja, à
         * mesma hora, com os mesmos serviços, gravada há segundos?
         * Então ESTA é a mesma marcação — devolve-se a que já existe
         * e quem repetiu o clique cai no mesmo ecrã de confirmação.
         *
         * A janela é curta de propósito: noventa segundos apanham o
         * clique repetido sem impedir a casa de marcar de propósito
         * duas visitas iguais (mãe e filha na mesma ficha) — basta
         * que não seja no mesmo minuto e meio.
         */
        const gemea = await tx<{ id: string }[]>`
          select a.id
            from appointment a
           where a.unit_id = ${input.unit.id}
             and a.client_id = ${input.clientId}
             and a.starts_at = ${input.startsAt}
             and a.status in ('booked', 'confirmed')
             and a.created_at > now() - interval '90 seconds'
             and (select string_agg(i.service_id::text, ',' order by i.service_id::text)
                    from appointment_item i
                   where i.appointment_id = a.id)
                 = ${[...input.cart.map((line) => line.serviceId)].sort().join(',')}
           limit 1
        `
        if (gemea[0]) return { id: gemea[0].id, plan }

        // O plano de fora foi feito antes da fila e pode ter ficado
        // velho: entre lê-lo e chegar aqui, a hora pode ter sido
        // vendida. Refaz-se com a fila garantida, e é ESTE que se grava.
        const fresh = await planAt(
          input.unit,
          input.day,
          input.cart,
          input.startsAt,
          input.channel,
          now,
          { db: tx },
        )
        if (!fresh) return null

        /*
         * O cadeado foi tomado para as profissionais do plano de FORA.
         * Se o replaneamento escolheu alguém fora dessa fila — a carga
         * mudou entre o plano e o cadeado — gravá-lo era escrever sem
         * cadeado, e é precisamente a escrita sem fila que deixa duas
         * marcações caírem na mesma cadeira. Sai-se sem gravar; a
         * volta seguinte replaneia cá fora e tranca as certas.
         */
        const trancadas = new Set(plan.items.map((item) => item.staffId))
        if (!fresh.items.every((item) => trancadas.has(item.staffId))) {
          return null
        }

        const rows = await tx<{ id: string }[]>`
          insert into appointment (
            org_id, unit_id, client_id, status, source,
            starts_at, ends_at, client_note, internal_note, language,
            created_by_staff_id, manage_token
          ) values (
            ${input.unit.org_id}, ${input.unit.id}, ${input.clientId},
            'confirmed', ${input.source},
            ${fresh.startsAt}, ${fresh.endsAt},
            ${input.clientNote ?? null}, ${input.internalNote ?? null},
            ${input.language}, ${input.createdByStaffId ?? null},
            ${novaChave()}
          )
          returning id, manage_token
        `
        const appointment = rows[0]
        if (!appointment) throw new Error('insert falhou')

        await writePlan(tx, appointment.id, input.unit.id, fresh)

        await tx`
          insert into appointment_status_event
                 (appointment_id, from_status, to_status, by_staff_id, by_client)
          values (${appointment.id}, null, 'confirmed',
                  ${input.createdByStaffId ?? null}, ${input.byClient ?? false})
        `

        return { id: appointment.id, plan: fresh }
      })

      // Perdeu a corrida. Na primeira volta ainda vale a pena tentar
      // outra vez — um carrinho "sem preferência" pode cair noutra
      // profissional. Na segunda, é mesmo não.
      if (!written) continue

      return { ok: true, appointmentId: written.id, plan: written.plan }
    } catch (error) {
      /* A restrição de exclusão da `staff_block` já não existe, mas a da
         `resource_block` sim: o lavatório não se parte ao meio. Este
         `catch` continua a ser o que apanha a disputa por um recurso. */
      if (isOverlapError(error)) continue
      throw error
    }
  }

  return { ok: false, reason: 'slot_taken' }
}

type Tx = postgres.TransactionSql<Record<string, never>>

/**
 * A hora foi vendida enquanto esperávamos pelo cadeado.
 *
 * Numa remarcação isto tem de ser um erro e não um `return`: a esta
 * altura a marcação antiga já foi cancelada e desbloqueada dentro da
 * transação, e sair em silêncio deixava a cliente sem a antiga e sem a
 * nova. Lançar desfaz tudo — ela volta a ter a hora que tinha.
 */
class SlotTaken extends Error {
  constructor() {
    super('slot_taken')
    this.name = 'SlotTaken'
  }
}

/**
 * A FILA À PORTA DA ESCRITA.
 *
 * `pg_advisory_xact_lock` é um cadeado com um número à escolha, que se
 * larga sozinho quando a transação acaba — sirva ela ou rebente. O
 * número é o par (profissional, dia), reduzido a inteiro: duas escritas
 * para a mesma profissional no mesmo dia esperam uma pela outra; para
 * profissionais diferentes, ou dias diferentes, não se cruzam.
 *
 * Ordenado, e sempre pela mesma ordem. Uma visita com duas
 * profissionais pede dois cadeados, e se cada transação os pedisse pela
 * ordem que lhe desse jeito, duas visitas cruzadas ficavam à espera uma
 * da outra para sempre. Por ordem crescente, isso não acontece.
 */
async function lockStaffDay(
  tx: Tx,
  staffIds: string[],
  day: IsoDay,
  /*
   * A CLIENTE TAMBÉM ENTRA NA FILA. A trava de gémeas só vê a gravação
   * rival se as duas passarem pelo mesmo cadeado — e dois envios
   * repetidos podem planear profissionais DIFERENTES (a carga mudou
   * entre um plano e o outro), com cadeados que não se cruzam. O par
   * (cliente, dia) é o que os dois têm sempre em comum: com ele na
   * fila, a segunda gravação da mesma cliente espera pela primeira e a
   * trava de gémeas apanha-a. Entra ordenado com os outros, pela mesma
   * ordem total — o que continua a impedir o abraço mortal.
   */
  clientId?: string,
): Promise<void> {
  const keys = [...new Set(staffIds)].map((staffId) =>
    hashKey(`${staffId}:${day}`),
  )
  if (clientId) keys.push(hashKey(`cliente:${clientId}:${day}`))
  keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  for (const key of keys) {
    // Vai como texto e a base converte: um inteiro de 64 bits não cabe
    // no `number` do JavaScript sem perder os últimos dígitos, e é
    // precisamente neles que duas chaves parecidas se distinguem.
    await tx`select pg_advisory_xact_lock(${key.toString()}::bigint)`
  }
}

/**
 * Texto para um inteiro de 64 bits, que é o que o cadeado aceita.
 * Colisões são inofensivas: duas chaves diferentes com o mesmo número
 * só fazem esperar quem podia ter passado — nunca deixam passar quem
 * devia esperar.
 */
function hashKey(text: string): bigint {
  let hash = 0xcbf29ce484222325n
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return BigInt.asIntN(64, hash)
}

/**
 * Escreve os itens e os blocos de ocupação. O bloco inclui as folgas: a
 * cliente vê o horário do serviço, a agenda ocupa o bloco. Pessoa e
 * equipamento reservam-se juntos.
 */
async function writePlan(
  tx: Tx,
  appointmentId: string,
  unitId: string,
  plan: Plan,
): Promise<void> {
  for (const [index, item] of plan.items.entries()) {
    const rows = await tx<{ id: string }[]>`
      insert into appointment_item (
        appointment_id, service_id, staff_id, starts_at, ends_at,
        price_cents, duration_minutes, service_name,
        buffer_before_minutes, buffer_after_minutes, sort_order
      ) values (
        ${appointmentId}, ${item.serviceId}, ${item.staffId},
        ${item.startsAt}, ${item.endsAt},
        ${item.priceCents}, ${item.durationMinutes}, ${item.serviceName},
        ${item.bufferBeforeMinutes}, ${item.bufferAfterMinutes}, ${index}
      )
      returning id
    `
    const created = rows[0]
    if (!created) throw new Error('insert de item falhou')

    const from = new Date(
      item.startsAt.getTime() - item.bufferBeforeMinutes * 60_000,
    )
    const to = new Date(item.endsAt.getTime() + item.bufferAfterMinutes * 60_000)

    await tx`
      insert into staff_block (staff_id, unit_id, appointment_item_id, during)
      values (${item.staffId}, ${unitId}, ${created.id},
              tstzrange(${from}, ${to}, '[)'))
    `

    for (const resourceId of item.resourceIds) {
      await tx`
        insert into resource_block (resource_id, appointment_item_id, during)
        values (${resourceId}, ${created.id}, tstzrange(${from}, ${to}, '[)'))
      `
    }
  }
}

/**
 * A CHAVE DA MARCAÇÃO — o que vai no link que a cliente guarda.
 *
 * Abre AQUELA marcação, de qualquer aparelho, sem entrar em conta
 * nenhuma. É a saída para quem marcou no telemóvel e quer desmarcar do
 * computador do trabalho, ou para quem limpou o navegador.
 *
 * VINTE E QUATRO CARACTERES de aleatoriedade a sério — o mesmo gerador
 * das chaves de sessão. Não é um número curto que se adivinhe: é uma
 * chave, e o que ela abre é uma marcação de uma pessoa.
 *
 * Nasce com cada marcação. As que já existiam ficam sem ela e continuam
 * a funcionar como sempre — só não têm link.
 */
function novaChave(): string {
  return randomBytes(18).toString('base64url')
}

// ---------------------------------------------------------------------
// Mudar de estado
// ---------------------------------------------------------------------

const NEXT: Record<Status, Status[]> = {
  booked: [
    'confirmed',
    'checked_in',
    'in_service',
    'completed',
    'cancelled_by_client',
    'cancelled_by_salon',
    'no_show',
  ],
  confirmed: [
    'checked_in',
    'in_service',
    'completed',
    'cancelled_by_client',
    'cancelled_by_salon',
    'no_show',
  ],
  checked_in: ['in_service', 'completed', 'cancelled_by_salon', 'no_show'],
  in_service: ['completed', 'cancelled_by_salon'],
  completed: [],
  cancelled_by_client: [],
  cancelled_by_salon: [],
  no_show: [],
}

export function canTransition(from: Status, to: Status): boolean {
  return NEXT[from].includes(to)
}

// ---------------------------------------------------------------------
// O que conta como FEITA
// ---------------------------------------------------------------------

/**
 * A HORA MANDA — E PORQUE DEIXOU DE HAVER UM BOTÃO.
 *
 * Isto contava-se pelo estado `completed`, que alguém tinha de pôr lá
 * carregando em «Concluir» no fim de cada marcação. Era o terceiro
 * botão da mesma família: a caixa pedia um gesto que ninguém dava, a
 * comanda pedia um gesto que ninguém dava, e o «Concluir» sobreviveu
 * só por ser o mais barato dos três. Continuava a ser trabalho — trinta
 * toques por semana — e enquanto ninguém o dava, o dinheiro não existia
 * em lado nenhum: onze marcações e vinte euros no painel de agosto.
 *
 * PASSA A MARCAR-SE A EXCEPÇÃO, E NÃO A REGRA. Uma marcação conta como
 * feita quando a hora dela passou, a não ser que tenha sido cancelada
 * ou dada como falta. O que a casa tem de fazer à mão passa a ser duas
 * ou três coisas por mês, em vez de trinta por semana — e são coisas
 * que já hoje se fazem.
 *
 * CONTA NO FIM, E NÃO NO PRINCÍPIO. Uma marcação a decorrer ainda não é
 * dinheiro: a cliente pode levantar-se e ir embora. Às 10:29 a Susana
 * não conta; às 10:30 conta.
 *
 * O `completed` FICA. Não se apaga nada do que lá está, e uma marcação
 * dada por concluída antes da hora — ou concluída no tempo em que o
 * botão existia — continua a contar. O estado deixou de ser a ÚNICA
 * maneira de uma marcação valer dinheiro; não deixou de ser uma.
 *
 * O QUE ISTO CUSTA, dito à séria: o erro passa a ser para cima. Uma
 * falta que ninguém marque vira dinheiro que o salão não recebeu, e
 * dizer a uma dona que o mês foi melhor do que foi é pior do que o
 * contrário. Mas o erro de hoje é de quase cem por cento, e este é da
 * ordem dos cinco.
 *
 * Quem usar isto tem de ter a marcação com o alias `a`.
 */
export function marcacaoFeita() {
  return sql`(
    a.status = 'completed'
    or (
      a.ends_at <= now()
      and a.status not in ('cancelled_by_client', 'cancelled_by_salon', 'no_show')
    )
  )`
}

/**
 * O mesmo em JavaScript, para o ecrã — o gémeo do `marcacaoFeita`.
 *
 * Duas leituras da mesma regra acabam sempre por divergir, por isso
 * vivem coladas uma à outra: quem mudar uma vê a outra por baixo.
 */
export function foiFeita(
  status: Status,
  endsAt: Date,
  agora: Date = new Date(),
): boolean {
  if (status === 'completed') return true
  if (isCancelled(status) || status === 'no_show') return false
  return endsAt.getTime() <= agora.getTime()
}

export function nextStatuses(from: Status): Status[] {
  return NEXT[from]
}

/**
 * APAGAR UMA MARCAÇÃO — DE VEZ.
 *
 * Não é o mesmo que desmarcar. Desmarcar é um facto do salão e fica na
 * história da cliente; apagar é dizer que aquilo nunca devia ter
 * existido — uma linha de teste, um engano de dedo — e não deixa rasto
 * nenhum. Se deixasse, não estava apagada.
 *
 * O QUE VAI ATRÁS, POR CASCATA DA BASE: os serviços da marcação, os
 * blocos que prendiam as horas das colaboradoras, os blocos de recurso
 * e o registo das mensagens enviadas.
 *
 * E É POR ISSO QUE UMA MARCAÇÃO CONCLUÍDA TRAVA.
 *
 * A trava era o dinheiro: uma marcação com pagamento lançado na comanda
 * não se apagava, porque a tabela «payment» vinha atrás por cascata e o
 * que a cliente pagou desaparecia das contas sem deixar rasto.
 *
 * A comanda saiu, e a faturação passou a ser a própria marcação
 * concluída. A trava não deixou de fazer sentido — mudou de nome. Uma
 * concluída é receita registada; apagá-la é apagar um dia do mês, e é
 * exactamente o que a regra sempre quis impedir. Desmarcar continua a
 * ser a saída para o que não aconteceu.
 *
 * A verificação corre DENTRO da transação, com a linha travada, para
 * que ninguém consiga concluir entre a pergunta e a resposta.
 */
export type DeleteResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'has_money' }

export async function deleteAppointment(input: {
  appointmentId: string
  orgId: string
}): Promise<DeleteResult> {
  return sql.begin(async (tx) => {
    const rows = await tx<{ status: Status; ends_at: Date }[]>`
      select a.status, a.ends_at
        from appointment a
       where a.id = ${input.appointmentId} and a.org_id = ${input.orgId}
         for update
    `
    const found = rows[0]
    if (!found) return { ok: false, reason: 'not_found' } as const
    /*
      O QUE JÁ ACONTECEU NÃO SE APAGA — e a razão é a mesma de sempre,
      só que a palavra mudou. O que o painel fatura passou a ser a
      marcação que já passou; apagá-la é apagar a receita do dia.
    */
    if (foiFeita(found.status, found.ends_at)) {
      return { ok: false, reason: 'has_money' } as const
    }

    await tx`delete from appointment where id = ${input.appointmentId}`
    return { ok: true } as const
  })
}

export type TransitionResult =
  | { ok: true; from: Status }
  | { ok: false; reason: 'not_found' | 'not_allowed' }

/**
 * Cada mudança de estado fica registada com quem a fez, quando e porquê.
 * Cancelar apaga os blocos — aqui, dentro da mesma transação, e outra
 * vez no gatilho da base de dados, por segurança.
 */
export async function transitionAppointment(input: {
  appointmentId: string
  to: Status
  byStaffId?: string | null
  byClient?: boolean
  reason?: string | null
}): Promise<TransitionResult> {
  return sql.begin(async (tx) => {
    const rows = await tx<
      { status: Status; client_id: string; ends_at: Date }[]
    >`
      select status, client_id, ends_at
        from appointment
       where id = ${input.appointmentId}
         for update
    `
    const appointment = rows[0]
    if (!appointment) return { ok: false, reason: 'not_found' } as const

    if (appointment.status === input.to) {
      return { ok: true, from: appointment.status } as const
    }
    /*
      Havia aqui uma segunda trava, para a comanda fechada. Era
      redundante mesmo antes de a comanda sair: uma marcação só se
      fechava depois de concluída, e de «concluída» a tabela de estados
      não deixa sair para lado nenhum. Quem trava é o `canTransition`.
    */
    if (!canTransition(appointment.status, input.to)) {
      return { ok: false, reason: 'not_allowed' } as const
    }

    await tx`
      update appointment set status = ${input.to}
       where id = ${input.appointmentId}
    `

    if (isCancelled(input.to)) {
      await freeBlocks(tx, input.appointmentId)
    }

    if (input.to === 'no_show') {
      await tx`
        update client set no_show_count = no_show_count + 1
         where id = ${appointment.client_id}
      `
    }

    if (input.to === 'completed') {
      await tx`
        update client
           set first_visit_at = least(coalesce(first_visit_at, now()), now()),
               last_visit_at = greatest(coalesce(last_visit_at, now()), now())
         where id = ${appointment.client_id}
      `
    }

    await tx`
      insert into appointment_status_event
             (appointment_id, from_status, to_status, by_staff_id, by_client, reason)
      values (${input.appointmentId}, ${appointment.status}, ${input.to},
              ${input.byStaffId ?? null}, ${input.byClient ?? false},
              ${input.reason ?? null})
    `

    return { ok: true, from: appointment.status } as const
  })
}

async function freeBlocks(tx: Tx, appointmentId: string): Promise<void> {
  await tx`
    delete from staff_block
     where appointment_item_id in (
       select id from appointment_item where appointment_id = ${appointmentId}
     )
  `
  await tx`
    delete from resource_block
     where appointment_item_id in (
       select id from appointment_item where appointment_id = ${appointmentId}
     )
  `
}

// ---------------------------------------------------------------------
// Remarcar
// ---------------------------------------------------------------------

export type RescheduleResult =
  | { ok: true; appointmentId: string; plan: Plan }
  | { ok: false; reason: 'slot_taken' | 'unavailable' | 'not_found' | 'not_allowed' }

/**
 * Remarcar cria uma marcação NOVA a apontar para a antiga. Não se edita
 * a antiga — o passado da agenda fica como esteve.
 *
 * O planeamento ignora os blocos da marcação antiga (senão ela impedia-se
 * a si mesma de mudar de hora) e, dentro da transação, esses blocos são
 * apagados antes de os novos entrarem.
 */
export async function rescheduleAppointment(input: {
  appointmentId: string
  unit: Unit
  day: IsoDay
  cart: CartLine[]
  startsAt: Date
  channel: Channel
  source: Source
  byStaffId?: string | null
  byClient?: boolean
  reason?: string | null
  now?: Date
}): Promise<RescheduleResult> {
  const now = input.now ?? new Date()

  const previousRows = await sql<
    {
      id: string
      status: Status
      client_id: string
      language: Language
      client_note: string | null
      internal_note: string | null
      /* Quem atendia antes. Entra na fila junto com quem vai atender:
         remarcar mexe nas duas agendas, não só na de destino. */
      staff_ids: string[]
    }[]
  >`
    select a.id, a.status, a.client_id, a.language,
           a.client_note, a.internal_note,
           coalesce(
             (select array_agg(distinct i.staff_id)
                from appointment_item i where i.appointment_id = a.id),
             '{}'
           ) as staff_ids
      from appointment a
     where a.id = ${input.appointmentId}
  `
  const previous = previousRows[0]
  if (!previous) return { ok: false, reason: 'not_found' }
  if (isTerminal(previous.status)) {
    return { ok: false, reason: 'not_allowed' }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const plan = await planAt(
      input.unit,
      input.day,
      input.cart,
      input.startsAt,
      input.channel,
      now,
      { excludeAppointmentId: previous.id },
    )
    if (!plan) {
      return { ok: false, reason: attempt === 0 ? 'unavailable' : 'slot_taken' }
    }

    try {
      const created = await sql.begin(async (tx) => {
        // A fila, como na criação: primeiro as profissionais do plano
        // que se quer gravar, depois as da marcação antiga — que também
        // se mexe, ao libertar-lhe os blocos.
        await lockStaffDay(
          tx,
          [...plan.items.map((item) => item.staffId), ...previous.staff_ids],
          input.day,
          previous.client_id,
        )

        // A antiga sai da agenda primeiro: os seus blocos libertam o
        // horário que a nova vai ocupar. O estado volta a ser lido
        // AQUI, com a linha presa: a leitura lá de cima é de antes da
        // fila, e entre uma e outra a marcação pode ter sido dada por
        // concluída — cancelar uma concluída apagava a receita do dia.
        const locked = await tx<{ status: Status }[]>`
          select status from appointment
           where id = ${previous.id} for update
        `
        const current = locked[0]
        if (!current || isTerminal(current.status)) {
          return 'gone' as const
        }

        await freeBlocks(tx, previous.id)
        /* A chave sai com a marcação antiga e volta a entrar mais
           abaixo, já na nova. Para a cliente é o mesmo link e a mesma
           marcação; a troca de linha é assunto nosso. */
        const solta = await tx<{ manage_token: string | null }[]>`
          update appointment
             set status = 'cancelled_by_salon', manage_token = null
           where id = ${previous.id}
           returning manage_token
        `
        await tx`
          insert into appointment_status_event
                 (appointment_id, from_status, to_status, by_staff_id, by_client, reason)
          values (${previous.id}, ${current.status}, 'cancelled_by_salon',
                  ${input.byStaffId ?? null}, ${input.byClient ?? false},
                  ${input.reason ?? 'Remarcada'})
        `

        // Refeito com o cadeado na mão E com os blocos da antiga já
        // libertados — é por isso que este replaneamento vem depois do
        // `freeBlocks` e não antes: a hora que a marcação nova quer
        // pode ser a que a antiga estava a ocupar.
        const fresh = await planAt(
          input.unit,
          input.day,
          input.cart,
          input.startsAt,
          input.channel,
          now,
          { excludeAppointmentId: previous.id, db: tx },
        )
        if (!fresh) throw new SlotTaken()

        /*
         * A mesma guarda da criação: o cadeado foi tomado para as
         * profissionais do plano de fora (mais as da antiga). Se o
         * replaneamento escolheu alguém fora dessa fila, gravar era
         * escrever sem cadeado. Aqui tem de ser um lançamento e não um
         * `return` — a antiga já foi cancelada dentro da transação, e
         * o `SlotTaken` desfaz tudo antes de tentar outra volta.
         */
        const trancadas = new Set([
          ...plan.items.map((item) => item.staffId),
          ...previous.staff_ids,
        ])
        if (!fresh.items.every((item) => trancadas.has(item.staffId))) {
          throw new SlotTaken()
        }

        const rows = await tx<{ id: string }[]>`
          insert into appointment (
            org_id, unit_id, client_id, status, source,
            starts_at, ends_at, client_note, internal_note, language,
            rescheduled_from_id, created_by_staff_id
          ) values (
            ${input.unit.org_id}, ${input.unit.id}, ${previous.client_id},
            'confirmed', ${input.source},
            ${fresh.startsAt}, ${fresh.endsAt},
            ${previous.client_note}, ${previous.internal_note},
            ${previous.language}, ${previous.id}, ${input.byStaffId ?? null}
          )
          returning id
        `
        const appointment = rows[0]
        if (!appointment) throw new Error('insert falhou')

        await writePlan(tx, appointment.id, input.unit.id, fresh)

        // E a chave passa. As marcações nascidas antes de haver chave
        // não têm nenhuma para passar, e continuam como sempre.
        const chave = solta[0]?.manage_token ?? null
        if (chave) {
          await tx`
            update appointment set manage_token = ${chave}
             where id = ${appointment.id}
          `
        }

        /*
         * Havia aqui um passo a mais: arrastar os pagamentos da antiga
         * para a nova, para que um sinal pago ao balcão não ficasse
         * preso a uma marcação cancelada. A comanda saiu e com ela a
         * única porta por onde se lançava um pagamento; a receita vem
         * agora da marcação concluída, e essa segue para a nova por si.
         * As linhas antigas ficam onde estão — ninguém as lê.
         */

        await tx`
          insert into appointment_status_event
                 (appointment_id, from_status, to_status, by_staff_id, by_client, reason)
          values (${appointment.id}, null, 'confirmed',
                  ${input.byStaffId ?? null}, ${input.byClient ?? false},
                  ${'Remarcação de ' + previous.id})
        `

        return { id: appointment.id, plan: fresh }
      })

      if (created === 'gone') return { ok: false, reason: 'not_allowed' }
      return { ok: true, appointmentId: created.id, plan: created.plan }
    } catch (error) {
      /* Perdeu a hora com o cadeado na mão. A transação inteira desfez-se
         — a marcação antiga voltou intacta à agenda, com os seus blocos
         — e vale a pena uma segunda volta. */
      if (error instanceof SlotTaken) continue
      if (isOverlapError(error)) continue
      throw error
    }
  }

  return { ok: false, reason: 'slot_taken' }
}

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------

export type AppointmentItemRow = {
  id: string
  service_id: string
  staff_id: string
  /** Nome verdadeiro. Só para dentro. */
  staff_name: string
  /** O que a cliente pode ver. Igual ao de cima quando não há alcunha. */
  staff_public_name: string
  service_name: string
  starts_at: Date
  ends_at: Date
  price_cents: number
  duration_minutes: number
  sort_order: number
}

export type AppointmentRow = {
  id: string
  org_id: string
  unit_id: string
  unit_name: string
  unit_slug: string
  unit_timezone: string
  client_id: string
  client_name: string
  client_phone: string | null
  status: Status
  source: Source
  starts_at: Date
  ends_at: Date
  client_note: string | null
  internal_note: string | null
  language: Language
  /* Só se põe desconto pela comanda, e a comanda saiu: nas marcações
     novas é sempre zero. Lê-se à mesma, porque o que ficou escrito de
     trás continua a abater no que a marcação vale. */
  discount_cents: number
  discount_reason: string | null
  total_cents: number
  rescheduled_from_id: string | null
}

export async function getAppointment(
  id: string,
): Promise<(AppointmentRow & { items: AppointmentItemRow[] }) | null> {
  const rows = await sql<AppointmentRow[]>`
    select a.id, a.org_id, a.unit_id,
           u.name as unit_name, u.slug as unit_slug, u.timezone as unit_timezone,
           a.client_id, c.name as client_name, c.phone as client_phone,
           a.status, a.source, a.starts_at, a.ends_at,
           a.client_note, a.internal_note, a.language,
           a.discount_cents, a.discount_reason,
           a.rescheduled_from_id,
           coalesce((
             select sum(i.price_cents) from appointment_item i
              where i.appointment_id = a.id
           ), 0)::int as total_cents
      from appointment a
      join unit u on u.id = a.unit_id
      join client c on c.id = a.client_id
     where a.id = ${id}
  `
  const appointment = rows[0]
  if (!appointment) return null

  const items = await sql<AppointmentItemRow[]>`
    select i.id, i.service_id, i.staff_id, s.name as staff_name,
           coalesce(s.public_alias, s.name) as staff_public_name,
           i.service_name, i.starts_at, i.ends_at,
           i.price_cents, i.duration_minutes, i.sort_order
      from appointment_item i
      join staff s on s.id = i.staff_id
     where i.appointment_id = ${id}
     order by i.sort_order, i.starts_at
  `

  return { ...appointment, items }
}

/**
 * A CHAVE DE UMA MARCAÇÃO, para o link que a cliente guarda.
 *
 * Pergunta à parte, e não uma coluna a mais no `getAppointment`: só a
 * página do «pronto» precisa da chave, e o balcão lê marcações o dia
 * inteiro. Não se faz o balcão pagar por uma coisa que é da cliente.
 *
 * Devolve `null` nas marcações antigas, que nasceram antes de haver
 * chave. Essas continuam a funcionar como sempre — só não têm link, e a
 * página do «pronto» simplesmente não o mostra.
 */
export async function chaveDa(id: string): Promise<string | null> {
  const rows = await sql<{ manage_token: string | null }[]>`
    select manage_token from appointment where id = ${id}
  `
  return rows[0]?.manage_token ?? null
}

/**
 * A MARCAÇÃO QUE UMA CHAVE ABRE.
 *
 * É a porta do `/m/[chave]`: quem tem o link entra nesta marcação sem
 * conta e sem código. Devolve `null` quando a chave não existe — e quem
 * chama trata as duas coisas da mesma maneira, para que uma chave
 * inventada e uma chave apagada sejam indistinguíveis de fora.
 */
export async function marcacaoPelaChave(chave: string) {
  const rows = await sql<{ id: string }[]>`
    select id from appointment where manage_token = ${chave}
  `
  const encontrada = rows[0]
  if (!encontrada) return null
  return getAppointment(encontrada.id)
}

/**
 * A janela de cancelamento é da loja. Passado esse prazo, a cliente fala
 * connosco — não cancela sozinha.
 */
export function clientMayCancel(
  appointment: { status: Status; starts_at: Date },
  unit: { cancel_window_hours: number },
  now: Date = new Date(),
): boolean {
  if (isTerminal(appointment.status)) return false
  if (appointment.status === 'checked_in' || appointment.status === 'in_service') {
    return false
  }
  const limit =
    appointment.starts_at.getTime() - unit.cancel_window_hours * 3_600_000
  return now.getTime() <= limit
}

/**
 * A JANELA DE REMARCAR É MAIS LARGA DO QUE A DE DESMARCAR — parece ao
 * contrário e não é.
 *
 * Uma cliente que às oito da noite da véspera já não pode desmarcar NÃO
 * VEM À MESMA: falta, e a casa perde a hora e o dinheiro. Se puder
 * mudar de dia, a casa perde a hora e mantém o dinheiro. Entre uma
 * falta e uma mudança, a casa quer a mudança — e por isso esta porta
 * fecha muito mais tarde: quinze minutos antes, por omissão.
 *
 * Fecha à mesma quando a cliente já chegou ou já está na cadeira: a
 * partir daí quem manda é quem está lá.
 */
export function clientMayReschedule(
  appointment: { status: Status; starts_at: Date },
  unit: { reschedule_window_minutes: number },
  now: Date = new Date(),
): boolean {
  if (isTerminal(appointment.status)) return false
  if (appointment.status === 'checked_in' || appointment.status === 'in_service') {
    return false
  }
  const limit =
    appointment.starts_at.getTime() - unit.reschedule_window_minutes * 60_000
  return now.getTime() <= limit
}
