'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireMaster, requireOrgScope } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { slugify } from '@/lib/text'
import { parseMinutes } from '@/lib/time'
import {
  addHours,
  addSpecial,
  copyWeekday,
  createResource,
  createResourceType,
  createUnit,
  getUnitForAdmin,
  removeHours,
  removeResource,
  removeResourceType,
  removeSpecial,
  updateBookingRules,
  updateUnit,
} from '@/lib/units'

export type UnitState = { error: string | null; done?: string | null }

const GONE: UnitState = { error: 'Essa loja não existe.' }

/** Uma loja só se toca através da rede a que pertence. */
async function reach(unitId: string) {
  const actor = await requireOrgScope()
  const unit = await getUnitForAdmin(actor.orgId, unitId)
  if (!unit) return null
  return { actor, unit }
}

function refresh(slug: string) {
  revalidatePath('/admin/unidades')
  revalidatePath(`/admin/unidades/${slug}`)
  revalidatePath('/loja')
  revalidatePath(`/loja/${slug}`)
}

// ---------------------------------------------------------------------
// A loja
// ---------------------------------------------------------------------

function detailsFrom(form: FormData, fallbackTimezone: string) {
  const name = String(form.get('name') ?? '').trim()
  const typed = String(form.get('slug') ?? '').trim()
  const text = (key: string) => String(form.get(key) ?? '').trim() || null

  return {
    name,
    slug: slugify(typed || name),
    timezone: String(form.get('timezone') ?? '').trim() || fallbackTimezone,
    addressLine: text('address'),
    postalCode: text('postal'),
    city: text('city'),
    phone: text('phone'),
    email: text('email'),
    whatsappPhone: text('whatsapp'),
  }
}

export async function createUnitAction(
  _previous: UnitState,
  form: FormData,
): Promise<UnitState> {
  // A folha já está atrás do `requireMaster`, mas a acção é uma porta
  // por direito próprio: quem souber o nome dela chama-a sem passar pela
  // folha. O portão repete-se aqui porque é aqui que decide.
  const actor = await requireMaster()
  const org = await requireOrg()

  const details = detailsFrom(form, org.timezone)
  if (!details.name) return { error: 'A loja precisa de um nome.' }
  if (!details.slug) return { error: 'Esse nome não dá endereço nenhum.' }

  const result = await createUnit(actor.orgId, details)
  if (!result.ok) {
    return {
      error:
        result.reason === 'slug_taken'
          ? 'Já há uma loja com esse endereço. Escolha outro.'
          : 'Faltam dados para criar a loja.',
    }
  }

  revalidatePath('/admin/unidades')
  revalidatePath('/loja')
  redirect(`/admin/unidades/${details.slug}`)
}

export async function saveUnitAction(
  _previous: UnitState,
  form: FormData,
): Promise<UnitState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return GONE

  const details = detailsFrom(form, found.unit.timezone)
  if (!details.name) return { error: 'A loja precisa de um nome.' }
  if (!details.slug) return { error: 'Esse nome não dá endereço nenhum.' }

  const result = await updateUnit(found.actor.orgId, found.unit.id, details)
  if (!result.ok) {
    return {
      error:
        result.reason === 'slug_taken'
          ? 'Já há uma loja com esse endereço. Escolha outro.'
          : 'Faltam dados para guardar.',
    }
  }

  refresh(found.unit.slug)
  if (details.slug !== found.unit.slug) {
    redirect(`/admin/unidades/${details.slug}`)
  }
  return { error: null, done: 'Loja guardada.' }
}

/** As regras que o motor de disponibilidade obedece, sem excepção. */
export async function saveRulesAction(
  _previous: UnitState,
  form: FormData,
): Promise<UnitState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return GONE

  const number = (key: string) => Number(String(form.get(key) ?? '').trim())
  const strategy = String(form.get('strategy') ?? '')
  if (
    strategy !== 'balance_load' &&
    strategy !== 'first_available' &&
    strategy !== 'least_busy_week'
  ) {
    return { error: 'Estratégia desconhecida.' }
  }

  const values = {
    minLeadMinutes: number('min_lead'),
    maxLeadDays: number('max_lead'),
    slotGranularityMinutes: number('granularity'),
    gapBetweenServicesMinutes: number('gap'),
    cancelWindowHours: number('cancel_window'),
    assignmentStrategy: strategy,
  } as const

  if (Object.values(values).some((v) => typeof v === 'number' && !Number.isInteger(v))) {
    return { error: 'Escreva números inteiros.' }
  }

  const result = await updateBookingRules(
    found.actor.orgId,
    found.unit.id,
    values,
  )
  if (!result.ok) {
    return {
      error:
        result.reason === 'invalid'
          ? 'Valores fora do que é possível. A granularidade vai de 5 a 120 minutos.'
          : 'Essa loja não existe.',
    }
  }

  refresh(found.unit.slug)
  return { error: null, done: 'Regras guardadas.' }
}

// ---------------------------------------------------------------------
// Horário
// ---------------------------------------------------------------------

export async function addHoursAction(
  _previous: UnitState,
  form: FormData,
): Promise<UnitState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return GONE

  const weekday = Number(String(form.get('weekday') ?? ''))
  const opens = parseMinutes(String(form.get('opens') ?? ''))
  const closes = parseMinutes(String(form.get('closes') ?? ''))

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { error: 'Dia desconhecido.' }
  }
  if (opens === null || closes === null) {
    return { error: 'Escreva as horas como 09:00.' }
  }
  if (closes <= opens) return { error: 'Fecha antes de abrir.' }

  const result = await addHours(found.unit.id, weekday, opens, closes)
  if (!result.ok) {
    return {
      error:
        result.reason === 'overlap'
          ? 'Esta faixa apanha outra do mesmo dia. Uma pausa de almoço são duas faixas que não se tocam.'
          : 'Horas inválidas.',
    }
  }

  refresh(found.unit.slug)
  return { error: null, done: null }
}

export async function removeHoursAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return
  const id = String(form.get('id') ?? '')
  if (id) await removeHours(found.unit.id, id)
  refresh(found.unit.slug)
}

/** Copiar um dia para os outros poupa seis vezes o mesmo trabalho. */
export async function copyWeekdayAction(
  _previous: UnitState,
  form: FormData,
): Promise<UnitState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return GONE

  const from = Number(String(form.get('from') ?? ''))
  if (!Number.isInteger(from) || from < 0 || from > 6) {
    return { error: 'Dia desconhecido.' }
  }

  const to = form
    .getAll('to')
    .map((value) => Number(String(value)))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)

  if (to.length === 0) return { error: 'Escolha para que dias copiar.' }

  await copyWeekday(found.unit.id, from, to)
  refresh(found.unit.slug)
  return { error: null, done: 'Horário copiado.' }
}

// ---------------------------------------------------------------------
// Feriados e horários especiais
// ---------------------------------------------------------------------

export async function addSpecialAction(
  _previous: UnitState,
  form: FormData,
): Promise<UnitState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return GONE

  const day = String(form.get('day') ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Escolha a data.' }

  const closed = String(form.get('mode') ?? 'closed') === 'closed'
  const opens = closed ? null : parseMinutes(String(form.get('opens') ?? ''))
  const closes = closed ? null : parseMinutes(String(form.get('closes') ?? ''))

  if (!closed && (opens === null || closes === null)) {
    return { error: 'Escreva as horas como 09:00.' }
  }

  const result = await addSpecial(found.unit.id, {
    day,
    isClosed: closed,
    opensMin: opens,
    closesMin: closes,
    note: String(form.get('note') ?? '').trim() || null,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'overlap'
          ? 'Já há algo marcado nesse dia que apanha estas horas. Apague primeiro o que lá está.'
          : 'Horas inválidas.',
    }
  }

  refresh(found.unit.slug)
  return { error: null, done: null }
}

export async function removeSpecialAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return
  const id = String(form.get('id') ?? '')
  if (id) await removeSpecial(found.unit.id, id)
  refresh(found.unit.slug)
}

// ---------------------------------------------------------------------
// Recursos físicos
// ---------------------------------------------------------------------

export type ResourceState = { error: string | null; done?: string | null }

/** O tipo é da rede: "cadeira de lavagem" existe uma vez, não duas. */
export async function createTypeAction(
  _previous: ResourceState,
  form: FormData,
): Promise<ResourceState> {
  const actor = await requireOrgScope()
  const name = String(form.get('name') ?? '').trim()
  if (!name) return { error: 'Dê um nome ao tipo.' }

  const result = await createResourceType(actor.orgId, name, slugify(name))
  if (!result.ok) {
    return {
      error:
        result.reason === 'taken'
          ? 'Já existe um tipo com esse nome.'
          : 'Nome inválido.',
    }
  }

  revalidatePath('/admin/unidades')
  return { error: null, done: 'Tipo criado.' }
}

export async function removeTypeAction(
  _previous: ResourceState,
  form: FormData,
): Promise<ResourceState> {
  const actor = await requireOrgScope()
  const id = String(form.get('id') ?? '')
  if (!id) return { error: 'Tipo desconhecido.' }

  const result = await removeResourceType(actor.orgId, id)
  if (!result.ok) {
    return {
      error:
        result.reason === 'in_use'
          ? 'Ainda há equipamento ou serviços a contar com este tipo.'
          : 'Não foi possível apagar.',
    }
  }

  revalidatePath('/admin/unidades')
  return { error: null, done: 'Tipo apagado.' }
}

/** A instância é da loja: duas cabines na loja A são duas linhas. */
export async function addResourceAction(
  _previous: ResourceState,
  form: FormData,
): Promise<ResourceState> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return { error: 'Essa loja não existe.' }

  const typeId = String(form.get('type') ?? '')
  const name = String(form.get('name') ?? '').trim()
  if (!typeId) return { error: 'Escolha o tipo.' }
  if (!name) return { error: 'Dê um nome — "Cabine 1", por exemplo.' }

  const result = await createResource(found.unit.id, typeId, name)
  if (!result.ok) return { error: 'Nome inválido.' }

  refresh(found.unit.slug)
  return { error: null, done: null }
}

export async function removeResourceAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('unit') ?? ''))
  if (!found) return
  const id = String(form.get('id') ?? '')
  if (id) await removeResource(found.unit.id, id)
  refresh(found.unit.slug)
}
