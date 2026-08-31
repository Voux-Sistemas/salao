'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import {
  ownStaffId,
  requireActor,
  canSeeUnit,
  type Actor,
} from '@/lib/auth/actor'
import {
  canTransition,
  deleteAppointment,
  getAppointment,
  transitionAppointment,
  type Source,
  type Status,
} from '@/lib/booking'
import { ROUTINES, type Routine } from '@/lib/whatsapp'
import { agendaIsPrivateOn } from '@/lib/sunday'
import { isoDay } from '@/lib/time'

export type DeskState = { error: string | null; done?: string | null }

export type NovaMarcacao = {
  id: string
  unit_slug: string
  day: string
  client_name: string
  /** «30/08 · 10:00», já na hora da loja: o navegador não sabe o fuso. */
  quando: string
  services: string | null
  staff: string | null
  source: Source
}

/**
 * O QUE ENTROU DESDE QUE A PÁGINA ABRIU.
 *
 * Uma marcação feita pelo site cai na agenda sem ninguém dar por ela: a
 * página do balcão foi desenhada há uma hora e não volta a olhar para a
 * base. Quem está ao balcão descobre a marcação quando a cliente chega.
 *
 * Isto é a pergunta que falta — «entrou alguma coisa desde as tantas?» —
 * e é só uma pergunta: não muda nada, não revalida nada, e responde com
 * o que se precisa para a escrever numa linha.
 *
 * A HORA VEM DO NAVEGADOR, e isso é de propósito: o relógio que conta é
 * o do momento em que aquela página abriu, não o do servidor. Se vier
 * uma data impossível, o pedido não devolve nada em vez de devolver o
 * catálogo inteiro.
 *
 * QUEM VÊ O QUÊ é a mesma regra do resto da casa: a rede toda para quem
 * a vê, as lojas de quem tem lojas, e a profissional só o que é dela.
 * O tecto de vinte é rede: quem tiver mais do que vinte marcações novas
 * numa sessão tem outra coisa para fazer que não ler avisos.
 */
export async function novasMarcacoes(
  desdeIso: string,
): Promise<NovaMarcacao[]> {
  const actor = await requireActor()
  const desde = new Date(desdeIso)
  if (Number.isNaN(desde.getTime())) return []

  const ownStaff = ownStaffId(actor)
  const units = actor.orgScope ? null : actor.unitIds
  if (units !== null && units.length === 0) return []

  return sql<NovaMarcacao[]>`
    select a.id, u.slug as unit_slug, a.source,
           c.name as client_name,
           to_char(a.starts_at at time zone u.timezone,
                   'DD/MM') || ' · ' ||
           to_char(a.starts_at at time zone u.timezone,
                   'HH24:MI') as quando,
           (select string_agg(i.service_name, ' + ' order by i.sort_order)
              from appointment_item i where i.appointment_id = a.id) as services,
           (select string_agg(distinct s.name, ', ')
              from appointment_item i
              join staff s on s.id = i.staff_id
             where i.appointment_id = a.id) as staff,
           to_char(a.starts_at at time zone u.timezone, 'YYYY-MM-DD') as day
      from appointment a
      join unit u on u.id = a.unit_id
      join client c on c.id = a.client_id
     where a.org_id = ${actor.orgId}
       and a.created_at > ${desde}
       and a.status not in ('cancelled_by_client', 'cancelled_by_salon')
       and (${units}::uuid[] is null or a.unit_id = any(${units}::uuid[]))
       and (${ownStaff}::uuid is null or exists (
             select 1 from appointment_item i
              where i.appointment_id = a.id and i.staff_id = ${ownStaff}::uuid
           ))
     order by a.created_at desc
     limit 20
  `
}

/**
 * Esta pessoa pode mexer nesta marcação?
 *
 * Acima da profissional ninguém é peneirado. A profissional mexe no que
 * é dela — excepto ao domingo, em que o trabalho é da casa: entra em
 * nome de quem o motor escolheu, mas quem o pega decide-se lá, entre
 * elas. De nada servia mostrar-lhes o domingo inteiro na grelha e
 * depois responder «essa marcação não existe» a quem lhe tocasse.
 *
 * O dia é o da marcação, lido no fuso da loja — e não o de hoje.
 */
function canTouch(
  actor: Actor,
  appointment: {
    starts_at: Date
    unit_timezone: string
    items: { staff_id: string }[]
  },
): boolean {
  if (actor.role !== 'professional') return true
  if (!agendaIsPrivateOn(isoDay(appointment.starts_at, appointment.unit_timezone))) {
    return true
  }
  return appointment.items.some((i) => i.staff_id === actor.id)
}

const STATUSES: Status[] = [
  'booked',
  'confirmed',
  'checked_in',
  'in_service',
  'completed',
  'cancelled_by_client',
  'cancelled_by_salon',
  'no_show',
]

/**
 * PASSAR A MARCAÇÃO A OUTRA PESSOA.
 *
 * Não é a cliente que muda de mãos — a ficha dela não se toca, e a
 * preferência dela também não. O que muda de mãos é O TRABALHO: os
 * serviços daquela marcação, naquele dia, passam a ser de outra pessoa.
 *
 * A HORA NÃO SE MEXE, o preço não se mexe, e a cliente não é avisada:
 * para ela não mudou nada — ao domingo nunca soube o nome, e nos outros
 * dias vai saber quando chegar.
 *
 * AS CONDIÇÕES SÃO REVALIDADAS AQUI, e não só no ecrã. O ecrã já só
 * oferece quem pode, mas um ecrã é uma sugestão: entre o desenho e o
 * toque pode ter entrado uma marcação em cima. A trava definitiva é a
 * restrição de exclusão do `staff_block` — duas pessoas não ocupam o
 * mesmo par (pessoa, hora), e a base recusa-o mesmo que tudo o resto
 * falhe.
 */
export async function passarAction(
  _previous: DeskState,
  form: FormData,
): Promise<DeskState> {
  const actor = await requireActor()
  const appointmentId = String(form.get('appointment') ?? '')
  const paraId = String(form.get('para') ?? '')
  if (!appointmentId || !paraId) return { error: 'Escolha para quem.' }

  const appointment = await getAppointment(appointmentId)
  if (!appointment || appointment.org_id !== actor.orgId) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canSeeUnit(actor, appointment.unit_id)) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canTouch(actor, appointment)) {
    return { error: 'Essa marcação não existe.' }
  }

  /*
    UMA MARCAÇÃO FECHADA NÃO SE PASSA. A conta já está feita e o
    trabalho já tem dono: mudar a mão agora reescrevia o que já ficou
    registado. Se foi engano, desfaz-se o fecho primeiro.
  */
  if (appointment.closed_at) {
    return { error: 'Esta comanda já foi fechada. Não se passa depois disso.' }
  }

  /* Quem recebe tem de ser da casa, da loja, e saber fazer tudo o que
     ali está. A hora livre é a base que a garante. */
  const podeRows = await sql<{ ok: boolean }[]>`
    select true as ok
      from staff s
      join staff_unit su on su.staff_id = s.id and su.unit_id = ${appointment.unit_id}
     where s.id = ${paraId}
       and s.org_id = ${actor.orgId}
       and s.is_active
       and not exists (
         select 1
           from appointment_item ai
          where ai.appointment_id = ${appointmentId}
            and not exists (
              select 1 from staff_skill k
               where k.staff_id = s.id and k.service_id = ai.service_id
            )
       )
  `
  if (podeRows.length === 0) {
    return { error: 'Essa pessoa não pode ficar com esta marcação.' }
  }

  try {
    await sql.begin(async (tx) => {
      await tx`
        update appointment_item set staff_id = ${paraId}
         where appointment_id = ${appointmentId}
      `
      await tx`
        update staff_block sb set staff_id = ${paraId}
          from appointment_item ai
         where ai.id = sb.appointment_item_id
           and ai.appointment_id = ${appointmentId}
      `
    })
  } catch (erro) {
    const codigo = (erro as { code?: string } | null)?.code
    // 23P01: a restrição de exclusão do staff_block. Alguém marcou em
    // cima entretanto, e a base não deixa duas no mesmo sítio.
    if (codigo === '23P01') {
      return { error: 'Essa pessoa ficou ocupada nessa hora entretanto.' }
    }
    console.error('[passar] a passagem falhou:', erro)
    return {
      error: 'Não consegui passar. O erro ficou escrito nos registos do servidor.',
    }
  }

  revalidatePath(`/agenda/${appointment.unit_slug}`)
  revalidatePath(`/avisos/${appointment.unit_slug}`)
  revalidatePath('/')
  return { error: null, done: 'Passada.' }
}

/**
 * PASSAR TODAS AS DE UM DIA — o gesto do domingo.
 *
 * Ao domingo a casa vende horas antes de saber quem as vai fazer: as
 * marcações entram numa CADEIRA — um perfil que existe só para as
 * segurar — e ficam por repartir. O caso mais comum é também o mais
 * aborrecido de fazer à mão: foi uma pessoa só, e as quatro marcações
 * são dela.
 *
 * É O CONTRÁRIO DO «TUDO OU NADA» do turno extra, e de propósito. Ali
 * marcavam-se doze sábados de uma vez e ficar com nove sem saber quais
 * era pior do que ficar com zero. Aqui cada marcação é uma coisa em si:
 * se uma chocar, as outras devem passar à mesma — e diz-se quantas
 * foram e quantas ficaram.
 */
export async function passarTodasAction(
  _previous: DeskState,
  form: FormData,
): Promise<DeskState> {
  const actor = await requireActor()
  const paraId = String(form.get('para') ?? '')
  const ids = String(form.get('marcacoes') ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  if (!paraId || ids.length === 0) return { error: 'Escolha para quem.' }

  let passadas = 0
  let ficaram = 0
  let ultimoErro: string | null = null

  for (const id of ids) {
    const um = new FormData()
    um.set('appointment', id)
    um.set('para', paraId)
    const r = await passarAction(EMPTY_DESK, um)
    if (r.error) {
      ficaram += 1
      ultimoErro = r.error
    } else {
      passadas += 1
    }
  }

  void actor
  if (passadas === 0) {
    return { error: ultimoErro ?? 'Não consegui passar nenhuma.' }
  }
  if (ficaram > 0) {
    return {
      error: null,
      done: `${passadas} passadas, ${ficaram} ficaram — essas trata-se uma a uma.`,
    }
  }
  return {
    error: null,
    done: passadas === 1 ? 'Passada.' : `${passadas} passadas.`,
  }
}

const EMPTY_DESK: DeskState = { error: null, done: null }

/**
 * Os botões do estado seguinte. Cada mudança fica registada com quem a
 * fez, quando e porquê — e cancelar apaga os blocos.
 */
export async function transitionAction(
  _previous: DeskState,
  form: FormData,
): Promise<DeskState> {
  const actor = await requireActor()
  const appointmentId = String(form.get('appointment') ?? '')
  const to = String(form.get('to') ?? '') as Status
  const reason = String(form.get('reason') ?? '').trim() || null

  if (!STATUSES.includes(to)) return { error: 'Estado desconhecido.' }

  const appointment = await getAppointment(appointmentId)
  // Marcação que esta pessoa não pode ver não existe.
  if (!appointment || appointment.org_id !== actor.orgId) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canSeeUnit(actor, appointment.unit_id)) {
    return { error: 'Essa marcação não existe.' }
  }
  // A profissional só mexe no que é dela — ao domingo, no que é da casa.
  if (!canTouch(actor, appointment)) {
    return { error: 'Essa marcação não existe.' }
  }

  if (!canTransition(appointment.status, to)) {
    return { error: 'Já não é possível mudar para esse estado.' }
  }

  const result = await transitionAppointment({
    appointmentId,
    to,
    byStaffId: actor.id,
    reason,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'closed'
          ? 'A comanda já está fechada.'
          : result.reason === 'not_allowed'
            ? 'Já não é possível mudar para esse estado.'
            : 'Essa marcação não existe.',
    }
  }

  revalidatePath(`/agenda/${appointment.unit_slug}`)
  revalidatePath(`/avisos/${appointment.unit_slug}`)
  revalidatePath('/')

  /*
    CONCLUIR CONCLUI, E MAIS NADA.

    Chegou a levar a comanda atrás, para poupar um toque a quem cobra
    logo a seguir. Mas o botão dizia «Concluir» e mudava de página — um
    botão não deve levar a um sítio que o nome dele não anuncia, e ao
    balcão nem sempre se cobra na hora. A comanda tem porta própria.
  */
  return { error: null, done: 'Feito.' }
}

/**
 * APAGAR UMA MARCAÇÃO — DE VEZ, E COM TRÊS COLEIRAS.
 *
 * 1. SÓ A DONA. Desmarcar é trabalho de balcão; apagar é mexer no que
 *    aconteceu, e isso é de quem responde pela casa. O portão está aqui
 *    e não só no desenho: quem souber o endereço do formulário continua
 *    a bater contra ele.
 *
 * 2. SÓ SEM DINHEIRO. A verificação vive no «deleteAppointment», dentro
 *    da transação e com a linha travada — aqui não se adivinha nada.
 *
 * 3. E A MARCAÇÃO TEM DE SER DESTA CASA E DESTA PESSOA, como em
 *    qualquer outra acção deste ficheiro.
 *
 * No fim NÃO SE VOLTA À MESMA PÁGINA: o painel abre-se por «?m=id», e
 * um id que já não existe abriria um painel vazio. Manda-se para o dia
 * da marcação, sem painel nenhum.
 */
export async function deleteAppointmentAction(
  _previous: DeskState,
  form: FormData,
): Promise<DeskState> {
  const actor = await requireActor()
  const appointmentId = String(form.get('appointment') ?? '')

  const appointment = await getAppointment(appointmentId)
  if (!appointment || appointment.org_id !== actor.orgId) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canSeeUnit(actor, appointment.unit_id)) {
    return { error: 'Essa marcação não existe.' }
  }
  if (actor.role !== 'master') {
    return { error: 'Só a dona pode apagar uma marcação.' }
  }

  const result = await deleteAppointment({
    appointmentId,
    orgId: actor.orgId,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'has_money'
          ? 'Esta marcação já tem dinheiro registado. Não se apaga — desmarca-se.'
          : 'Essa marcação não existe.',
    }
  }

  revalidatePath(`/agenda/${appointment.unit_slug}`)
  revalidatePath(`/avisos/${appointment.unit_slug}`)
  revalidatePath('/')
  redirect(
    `/agenda/${appointment.unit_slug}?d=${isoDay(appointment.starts_at, appointment.unit_timezone)}`,
  )
}

/**
 * ENVIAR É GRAVAR; GRAVAR É SAIR DA FILA. É este registo, e só ele, que
 * impede o aviso duplicado.
 *
 * E não confundir: mandar a confirmação NÃO é a cliente confirmar. São
 * dois factos distintos — este é a mensagem que saiu.
 */
export async function logNotificationAction(
  _previous: DeskState,
  form: FormData,
): Promise<DeskState> {
  const actor = await requireActor()
  const appointmentId = String(form.get('appointment') ?? '')
  const routine = String(form.get('routine') ?? '') as Routine
  const message = String(form.get('message') ?? '') || null

  if (!ROUTINES.includes(routine)) return { error: 'Rotina desconhecida.' }

  const appointment = await getAppointment(appointmentId)
  if (!appointment || appointment.org_id !== actor.orgId) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canSeeUnit(actor, appointment.unit_id)) {
    return { error: 'Essa marcação não existe.' }
  }
  if (!canTouch(actor, appointment)) {
    return { error: 'Essa marcação não existe.' }
  }

  await sql`
    insert into notification_log
      (org_id, unit_id, appointment_id, client_id, routine,
       message_snapshot, sent_by_staff_id)
    values
      (${appointment.org_id}, ${appointment.unit_id}, ${appointment.id},
       ${appointment.client_id}, ${routine}, ${message}, ${actor.id})
    on conflict (appointment_id, routine) do nothing
  `

  revalidatePath(`/agenda/${appointment.unit_slug}`)
  revalidatePath(`/avisos/${appointment.unit_slug}`)
  return { error: null, done: 'Registado.' }
}
