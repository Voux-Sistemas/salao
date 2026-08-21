import 'server-only'
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
 *   · A trava definitiva é da base de dados. Entre "consultei e estava
 *     livre" e "gravei" há uma janela, e com concorrência ela é
 *     apanhada: as restrições de exclusão levantam 23P01 e nós
 *     respondemos "esse horário acabou de ser preenchido".
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

/** Estados que ainda ocupam a agenda. */
export const LIVE_STATUSES: Status[] = [
  'booked',
  'confirmed',
  'checked_in',
  'in_service',
  'completed',
]

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
 */
export async function findOrCreateClient(
  orgId: string,
  input: {
    phone: string
    name: string
    language?: Language
    email?: string | null
    preferredUnitId?: string | null
  },
): Promise<string> {
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
      const appointmentId = await sql.begin(async (tx) => {
        const rows = await tx<{ id: string }[]>`
          insert into appointment (
            org_id, unit_id, client_id, status, source,
            starts_at, ends_at, client_note, internal_note, language,
            created_by_staff_id
          ) values (
            ${input.unit.org_id}, ${input.unit.id}, ${input.clientId},
            'booked', ${input.source},
            ${plan.startsAt}, ${plan.endsAt},
            ${input.clientNote ?? null}, ${input.internalNote ?? null},
            ${input.language}, ${input.createdByStaffId ?? null}
          )
          returning id
        `
        const appointment = rows[0]
        if (!appointment) throw new Error('insert falhou')

        await writePlan(tx, appointment.id, input.unit.id, plan)

        await tx`
          insert into appointment_status_event
                 (appointment_id, from_status, to_status, by_staff_id, by_client)
          values (${appointment.id}, null, 'booked',
                  ${input.createdByStaffId ?? null}, ${input.byClient ?? false})
        `

        return appointment.id
      })

      return { ok: true, appointmentId, plan }
    } catch (error) {
      // 23P01: outra pessoa gravou primeiro. Volta a planear.
      if (isOverlapError(error)) continue
      throw error
    }
  }

  return { ok: false, reason: 'slot_taken' }
}

type Tx = postgres.TransactionSql<Record<string, never>>

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

export function nextStatuses(from: Status): Status[] {
  return NEXT[from]
}

export type TransitionResult =
  | { ok: true; from: Status }
  | { ok: false; reason: 'not_found' | 'not_allowed' | 'closed' }

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
      { status: Status; client_id: string; closed_at: Date | null; ends_at: Date }[]
    >`
      select status, client_id, closed_at, ends_at
        from appointment
       where id = ${input.appointmentId}
         for update
    `
    const appointment = rows[0]
    if (!appointment) return { ok: false, reason: 'not_found' } as const

    if (appointment.status === input.to) {
      return { ok: true, from: appointment.status } as const
    }
    if (!canTransition(appointment.status, input.to)) {
      return { ok: false, reason: 'not_allowed' } as const
    }
    // Comanda fechada não muda mais de estado.
    if (appointment.closed_at) {
      return { ok: false, reason: 'closed' } as const
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
      closed_at: Date | null
    }[]
  >`
    select id, status, client_id, language, client_note, internal_note, closed_at
      from appointment
     where id = ${input.appointmentId}
  `
  const previous = previousRows[0]
  if (!previous) return { ok: false, reason: 'not_found' }
  if (previous.closed_at || isTerminal(previous.status)) {
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
        // A antiga sai da agenda primeiro: os seus blocos libertam o
        // horário que a nova vai ocupar.
        const locked = await tx<{ status: Status }[]>`
          select status from appointment where id = ${previous.id} for update
        `
        const current = locked[0]
        if (!current || isTerminal(current.status)) return null

        await freeBlocks(tx, previous.id)
        await tx`
          update appointment set status = 'cancelled_by_salon'
           where id = ${previous.id}
        `
        await tx`
          insert into appointment_status_event
                 (appointment_id, from_status, to_status, by_staff_id, by_client, reason)
          values (${previous.id}, ${current.status}, 'cancelled_by_salon',
                  ${input.byStaffId ?? null}, ${input.byClient ?? false},
                  ${input.reason ?? 'Remarcada'})
        `

        const rows = await tx<{ id: string }[]>`
          insert into appointment (
            org_id, unit_id, client_id, status, source,
            starts_at, ends_at, client_note, internal_note, language,
            rescheduled_from_id, created_by_staff_id
          ) values (
            ${input.unit.org_id}, ${input.unit.id}, ${previous.client_id},
            'booked', ${input.source},
            ${plan.startsAt}, ${plan.endsAt},
            ${previous.client_note}, ${previous.internal_note},
            ${previous.language}, ${previous.id}, ${input.byStaffId ?? null}
          )
          returning id
        `
        const appointment = rows[0]
        if (!appointment) throw new Error('insert falhou')

        await writePlan(tx, appointment.id, input.unit.id, plan)

        await tx`
          insert into appointment_status_event
                 (appointment_id, from_status, to_status, by_staff_id, by_client, reason)
          values (${appointment.id}, null, 'booked',
                  ${input.byStaffId ?? null}, ${input.byClient ?? false},
                  ${'Remarcação de ' + previous.id})
        `

        return appointment.id
      })

      if (!created) return { ok: false, reason: 'not_allowed' }
      return { ok: true, appointmentId: created, plan }
    } catch (error) {
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
  staff_name: string
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
  client_phone: string
  status: Status
  source: Source
  starts_at: Date
  ends_at: Date
  client_note: string | null
  internal_note: string | null
  language: Language
  discount_cents: number
  discount_reason: string | null
  closed_at: Date | null
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
           a.discount_cents, a.discount_reason, a.closed_at,
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
