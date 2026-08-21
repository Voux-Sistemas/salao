'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireManagement, unitsFor, type Actor } from '@/lib/auth/actor'
import { passwordProblem } from '@/lib/auth/password'
import { normalisePhone } from '@/lib/env'
import { requireOrg } from '@/lib/org'
import {
  addAbsence,
  addRole,
  attachUnit,
  closeSchedule,
  createMember,
  deactivateMember,
  detachUnit,
  getMember,
  openSchedule,
  reactivateMember,
  removeAbsence,
  removeRole,
  removeSchedule,
  setPassword,
  setSkill,
  updateMember,
  type AbsenceKind,
  type Level,
  type MemberInput,
} from '@/lib/team'
import { atMinutes, dayEnd, dayStart, parseMinutes, today } from '@/lib/time'

export type TeamState = { error: string | null; done?: string | null }

const GONE: TeamState = { error: 'Essa pessoa não existe.' }

/**
 * A gerente também entra aqui — logo, o portão é o da gestão, e o
 * alcance decide-se pessoa a pessoa dentro de lib/team. Quem está fora
 * do alcance recebe "não existe", igual a quem nunca existiu.
 */
async function reach(staffId: string) {
  const actor = await requireManagement()
  const member = await getMember(actor, staffId)
  if (!member) return null
  return { actor, member }
}

function refresh(staffId?: string) {
  revalidatePath('/admin/equipe')
  if (staffId) revalidatePath(`/admin/equipe/${staffId}`)
  revalidatePath('/agenda')
  revalidatePath('/agendar')
}

async function orgToday(): Promise<string> {
  const org = await requireOrg()
  return today(org.timezone)
}

/** O fuso é o da loja escolhida; sem loja, o da rede. */
async function timezoneFor(actor: Actor, unitId: string | null): Promise<string> {
  const org = await requireOrg()
  if (!unitId) return org.timezone
  const units = await unitsFor(actor)
  return units.find((unit) => unit.id === unitId)?.timezone ?? org.timezone
}

// ---------------------------------------------------------------------
// A ficha
// ---------------------------------------------------------------------

function memberFrom(form: FormData): MemberInput {
  const text = (key: string) => String(form.get(key) ?? '').trim() || null
  return {
    name: String(form.get('name') ?? '').trim(),
    phone: normalisePhone(String(form.get('phone') ?? '')),
    email: text('email'),
    bio: text('bio'),
    displayColor: String(form.get('color') ?? '').trim() || '#D9C08A',
    acceptsOnline: form.get('online') === 'on',
  }
}

function memberError(reason: string): string {
  if (reason === 'taken') {
    return 'Já há alguém na equipa com esse telefone. O telefone é a identidade e não se repete.'
  }
  if (reason === 'email_taken') return 'Esse e-mail já está noutra ficha.'
  if (reason === 'not_found') return 'Essa pessoa não existe.'
  return 'Falta o nome ou o telefone.'
}

export async function createMemberAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const actor = await requireManagement()
  const input = memberFrom(form)
  const unitIds = form.getAll('units').map(String).filter(Boolean)

  const result = await createMember(actor, input, unitIds)
  if (!result.ok) return { error: memberError(result.reason) }

  refresh()
  redirect(`/admin/equipe/${result.id}`)
}

export async function saveMemberAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const result = await updateMember(
    found.actor,
    found.member.id,
    memberFrom(form),
  )
  if (!result.ok) return { error: memberError(result.reason) }

  refresh(found.member.id)
  return { error: null, done: 'Ficha guardada.' }
}

export async function deactivateMemberAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const result = await deactivateMember(
    found.actor,
    found.member.id,
    await orgToday(),
  )
  if (!result.ok) {
    if (result.reason === 'has_future') {
      const count = result.count ?? 0
      return {
        error: `Ainda há ${count} marcação${count === 1 ? '' : 'ões'} pela frente com esta pessoa. Desmarque-as ou passe-as a outra mão antes de a tirar da equipa.`,
      }
    }
    return GONE
  }

  refresh(found.member.id)
  return { error: null, done: 'Fora da equipa. A escala foi fechada hoje.' }
}

export async function reactivateMemberAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return
  await reactivateMember(found.actor, found.member.id)
  refresh(found.member.id)
}

export async function setPasswordAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const password = String(form.get('password') ?? '')
  const again = String(form.get('again') ?? '')
  const problem = passwordProblem(password)
  if (problem) return { error: problem }
  if (password !== again) return { error: 'As duas não são iguais.' }

  const done = await setPassword(found.actor, found.member.id, password)
  if (!done) return GONE

  refresh(found.member.id)
  return {
    error: null,
    done: 'Palavra-passe reposta. Todas as sessões desta pessoa foram fechadas.',
  }
}

// ---------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------

function roleError(reason: string): string {
  if (reason === 'taken') return 'Já tem esse papel.'
  if (reason === 'last_owner') {
    return 'É a última dona da rede. Dê o papel a outra pessoa antes de o tirar a esta.'
  }
  if (reason === 'forbidden') return 'Esse papel não está ao seu alcance.'
  if (reason === 'invalid') return 'A dona é sempre da rede toda — não se prende a uma loja.'
  return 'Essa pessoa não existe.'
}

export async function addRoleAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const level = String(form.get('level') ?? '') as Level
  if (!['owner', 'manager', 'professional'].includes(level)) {
    return { error: 'Escolha o papel.' }
  }
  const unitId = String(form.get('unit') ?? '').trim() || null

  const result = await addRole(found.actor, found.member.id, level, unitId)
  if (!result.ok) return { error: roleError(result.reason) }

  refresh(found.member.id)
  return { error: null, done: 'Papel dado.' }
}

export async function removeRoleAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const id = String(form.get('id') ?? '')
  if (!id) return { error: 'Papel desconhecido.' }

  const result = await removeRole(found.actor, found.member.id, id)
  if (!result.ok) return { error: roleError(result.reason) }

  refresh(found.member.id)
  return { error: null, done: 'Papel retirado.' }
}

// ---------------------------------------------------------------------
// Lojas onde atende
// ---------------------------------------------------------------------

export async function setUnitAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const unitId = String(form.get('unit') ?? '')
  if (!unitId) return { error: 'Loja desconhecida.' }

  const result =
    form.get('on') === '1'
      ? await attachUnit(found.actor, found.member.id, unitId)
      : await detachUnit(found.actor, found.member.id, unitId, await orgToday())

  if (!result.ok) {
    return {
      error:
        result.reason === 'has_schedule'
          ? 'Ainda tem escala aberta nessa loja. Feche-a primeiro.'
          : result.reason === 'forbidden'
            ? 'Essa loja não está ao seu alcance.'
            : 'Essa pessoa não existe.',
    }
  }

  refresh(found.member.id)
  return { error: null, done: null }
}

// ---------------------------------------------------------------------
// Habilidades
// ---------------------------------------------------------------------

export async function toggleSkillAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return
  const serviceId = String(form.get('service') ?? '')
  if (!serviceId) return
  await setSkill(found.actor, found.member.id, serviceId, form.get('on') === '1')
  refresh(found.member.id)
}

// ---------------------------------------------------------------------
// Escala
// ---------------------------------------------------------------------

function scheduleError(reason: string): string {
  if (reason === 'overlap') {
    return 'Nesse dia da semana já há escala a apanhar estas horas. Feche a antiga com um último dia e só depois abra a nova.'
  }
  if (reason === 'not_there') {
    return 'Esta pessoa não atende nessa loja. Ligue-a à loja primeiro.'
  }
  if (reason === 'forbidden') return 'Essa loja não está ao seu alcance.'
  if (reason === 'past') {
    return 'Esta vigência já começou. Não se apaga — fecha-se com um último dia.'
  }
  if (reason === 'invalid') return 'As horas e as datas não batem certo.'
  return 'Essa pessoa não existe.'
}

export async function openScheduleAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const startsMin = parseMinutes(String(form.get('starts') ?? ''))
  const endsMin = parseMinutes(String(form.get('ends') ?? ''))
  if (startsMin === null || endsMin === null) {
    return { error: 'As horas escrevem-se como 09:00.' }
  }

  const validFrom = String(form.get('from') ?? '').trim()
  if (!validFrom) return { error: 'Diga a partir de quando vale.' }
  const validTo = String(form.get('to') ?? '').trim() || null

  const result = await openSchedule(found.actor, found.member.id, {
    unitId: String(form.get('unit') ?? ''),
    weekday: Number(String(form.get('weekday') ?? '')),
    startsMin,
    endsMin,
    validFrom,
    validTo,
  })
  if (!result.ok) return { error: scheduleError(result.reason) }

  refresh(found.member.id)
  return { error: null, done: 'Escala aberta.' }
}

export async function closeScheduleAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const id = String(form.get('id') ?? '')
  const lastDay = String(form.get('last') ?? '').trim()
  if (!id || !lastDay) return { error: 'Diga qual é o último dia.' }

  const result = await closeSchedule(found.actor, found.member.id, id, lastDay)
  if (!result.ok) return { error: scheduleError(result.reason) }

  refresh(found.member.id)
  return { error: null, done: 'Escala fechada.' }
}

export async function removeScheduleAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const id = String(form.get('id') ?? '')
  if (!id) return { error: 'Escala desconhecida.' }

  const result = await removeSchedule(
    found.actor,
    found.member.id,
    id,
    await orgToday(),
  )
  if (!result.ok) return { error: scheduleError(result.reason) }

  refresh(found.member.id)
  return { error: null, done: 'Escala apagada.' }
}

// ---------------------------------------------------------------------
// Ausências
// ---------------------------------------------------------------------

export async function addAbsenceAction(
  _previous: TeamState,
  form: FormData,
): Promise<TeamState> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return GONE

  const kind = String(form.get('kind') ?? '') as AbsenceKind
  if (!['day_off', 'vacation', 'training', 'block'].includes(kind)) {
    return { error: 'Escolha o tipo de ausência.' }
  }

  const unitId = String(form.get('unit') ?? '').trim() || null
  const from = String(form.get('from') ?? '').trim()
  if (!from) return { error: 'Diga o dia.' }
  const to = String(form.get('to') ?? '').trim() || from
  if (to < from) return { error: 'O último dia é antes do primeiro.' }

  const timezone = await timezoneFor(found.actor, unitId)
  const allDay = form.get('allday') === 'on'

  let startsAt: Date
  let endsAt: Date
  if (allDay) {
    startsAt = dayStart(from, timezone)
    endsAt = dayEnd(to, timezone)
  } else {
    const startsMin = parseMinutes(String(form.get('starts') ?? ''))
    const endsMin = parseMinutes(String(form.get('ends') ?? ''))
    if (startsMin === null || endsMin === null) {
      return { error: 'As horas escrevem-se como 09:00.' }
    }
    if (endsMin <= startsMin) return { error: 'A hora de fim é antes do início.' }
    startsAt = atMinutes(from, startsMin, timezone)
    endsAt = atMinutes(from, endsMin, timezone)
  }

  const result = await addAbsence(found.actor, found.member.id, {
    unitId,
    kind,
    startsAt,
    endsAt,
    reason: String(form.get('reason') ?? '').trim() || null,
  })
  if (!result.ok) {
    return {
      error:
        result.reason === 'forbidden'
          ? 'Essa loja não está ao seu alcance.'
          : result.reason === 'invalid'
            ? 'O fim é antes do início.'
            : 'Essa pessoa não existe.',
    }
  }

  refresh(found.member.id)
  if (result.clashes > 0) {
    return {
      error: null,
      done: `Ausência marcada — mas há ${result.clashes} marcação${result.clashes === 1 ? '' : 'ões'} dentro deste intervalo. O sistema não lhes toca: trate-as na agenda.`,
    }
  }
  return { error: null, done: 'Ausência marcada.' }
}

export async function removeAbsenceAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('staff') ?? ''))
  if (!found) return
  const id = String(form.get('id') ?? '')
  if (id) await removeAbsence(found.actor, found.member.id, id)
  refresh(found.member.id)
}
