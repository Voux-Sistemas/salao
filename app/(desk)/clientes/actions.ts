'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireManagement } from '@/lib/auth/actor'
import {
  addNote,
  createClient,
  getClient,
  planImport,
  removeNote,
  runImport,
  updateClient,
  type ClientInput,
  type ImportRow,
} from '@/lib/clients'
import { readClients } from '@/lib/csv'
import { normalisePhone } from '@/lib/env'
import { isLanguage } from '@/lib/i18n/config'

export type ClientState = { error: string | null; done?: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim()
}

function optional(form: FormData, key: string): string | null {
  return text(form, key) || null
}

function uuidOrNull(form: FormData, key: string): string | null {
  const value = text(form, key)
  return UUID.test(value) ? value : null
}

function readInput(form: FormData): ClientInput | string {
  const name = text(form, 'name')
  if (!name) return 'A ficha precisa de um nome.'

  const phone = normalisePhone(text(form, 'phone'))
  if (phone.replace(/\D/g, '').length < 6) {
    return 'O telefone é a identidade da cliente — escreva-o por inteiro.'
  }

  const language = text(form, 'language')
  const birthdate = optional(form, 'birthdate')
  if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return 'A data de nascimento escreve-se como 1990-04-30.'
  }

  return {
    name,
    phone,
    email: optional(form, 'email'),
    language: isLanguage(language) ? language : 'pt',
    birthdate,
    preferredUnitId: uuidOrNull(form, 'unit'),
    preferredStaffId: uuidOrNull(form, 'staff'),
    drinkPreference: optional(form, 'drink'),
    allergies: optional(form, 'allergies'),
    serviceNotes: optional(form, 'service_notes'),
    tags: text(form, 'tags')
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12),
  }
}

/**
 * Gravar a ficha. Criar leva à ficha nova; guardar deixa-nos onde
 * estávamos — depois de gravar volta-se ao sítio de onde se veio.
 */
export async function saveClientAction(
  _previous: ClientState,
  form: FormData,
): Promise<ClientState> {
  const actor = await requireManagement()
  const input = readInput(form)
  if (typeof input === 'string') return { error: input }

  const id = uuidOrNull(form, 'id')

  if (!id) {
    const result = await createClient(actor.orgId, input)
    if (!result.ok) {
      return {
        error:
          result.reason === 'duplicate_phone'
            ? 'Esse telefone já tem ficha nesta casa. Procure por ele.'
            : 'Não foi possível criar a ficha.',
      }
    }
    revalidatePath('/clientes')
    redirect(`/clientes/${result.clientId}`)
  }

  const existing = await getClient(actor.orgId, id)
  if (!existing) return { error: 'Essa ficha não existe.' }

  const result = await updateClient(actor.orgId, id, input)
  if (!result.ok) {
    return {
      error:
        result.reason === 'duplicate_phone'
          ? 'Esse telefone já pertence a outra ficha.'
          : 'Essa ficha não existe.',
    }
  }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return { error: null, done: 'Ficha guardada.' }
}

/** Nota interna: da equipa para a equipa, nunca à vista da cliente. */
export async function addNoteAction(
  _previous: ClientState,
  form: FormData,
): Promise<ClientState> {
  const actor = await requireManagement()
  const clientId = uuidOrNull(form, 'client')
  const body = text(form, 'body')

  if (!clientId) return { error: 'Essa ficha não existe.' }
  if (!body) return { error: 'Escreva a nota antes de a guardar.' }

  const client = await getClient(actor.orgId, clientId)
  if (!client) return { error: 'Essa ficha não existe.' }

  await addNote({ clientId, body, authorId: actor.id })
  revalidatePath(`/clientes/${clientId}`)
  return { error: null, done: 'Nota guardada.' }
}

export async function removeNoteAction(
  _previous: ClientState,
  form: FormData,
): Promise<ClientState> {
  const actor = await requireManagement()
  const clientId = uuidOrNull(form, 'client')
  const noteId = uuidOrNull(form, 'note')
  if (!clientId || !noteId) return { error: 'Essa nota não existe.' }

  const client = await getClient(actor.orgId, clientId)
  if (!client) return { error: 'Essa ficha não existe.' }

  await removeNote(clientId, noteId)
  revalidatePath(`/clientes/${clientId}`)
  return { error: null, done: 'Nota apagada.' }
}

// ---------------------------------------------------------------------
// Importar
// ---------------------------------------------------------------------

export type ImportState = {
  error: string | null
  done?: string | null
  /** O ficheiro tal como veio, para o passo da confirmação. */
  raw?: string
  rows?: ImportRow[]
  toCreate?: number
  truncated?: boolean
}

const MAX_BYTES = 512 * 1024

async function readUpload(form: FormData): Promise<string | null> {
  const file = form.get('file')
  if (file && typeof file !== 'string') {
    if (file.size === 0) return null
    if (file.size > MAX_BYTES) return null
    return file.text()
  }
  const pasted = String(form.get('raw') ?? '')
  return pasted.trim() ? pasted : null
}

/** Primeiro vê-se, depois é que se grava. */
export async function previewImportAction(
  _previous: ImportState,
  form: FormData,
): Promise<ImportState> {
  const actor = await requireManagement()

  const raw = await readUpload(form)
  if (!raw) {
    return {
      error:
        'Escolha um ficheiro CSV com menos de 512 KB, ou cole o conteúdo na caixa.',
    }
  }

  const { records } = readClients(raw)
  if (records.length === 0) {
    return { error: 'Não se encontrou nenhuma linha com nome e telefone.' }
  }

  const plan = await planImport(actor.orgId, records)
  return {
    error: null,
    raw,
    rows: plan.rows,
    toCreate: plan.toCreate,
    truncated: records.length > plan.rows.length,
  }
}

/** O segundo passo grava — e só o que o plano deu como novo. */
export async function runImportAction(
  _previous: ImportState,
  form: FormData,
): Promise<ImportState> {
  const actor = await requireManagement()

  const raw = String(form.get('raw') ?? '')
  if (!raw.trim()) return { error: 'Volte a escolher o ficheiro.' }

  const { records } = readClients(raw)
  if (records.length === 0) return { error: 'Volte a escolher o ficheiro.' }

  const result = await runImport(actor.orgId, records)
  revalidatePath('/clientes')

  return {
    error: null,
    done:
      result.created === 0
        ? 'Não havia nada de novo para gravar.'
        : `${result.created} ficha${result.created === 1 ? '' : 's'} criada${
            result.created === 1 ? '' : 's'
          }.`,
  }
}
