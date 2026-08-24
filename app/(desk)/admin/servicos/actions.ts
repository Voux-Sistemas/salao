'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOrgScope } from '@/lib/auth/actor'
import {
  createCategory,
  createService,
  getService,
  removeCategory,
  removeOverride,
  removeRequirement,
  renameCategory,
  retireService,
  saveOverride,
  saveRequirement,
  updateService,
  type ServiceInput,
} from '@/lib/catalog-admin'
import { dropUploadedImageIfOrphan, saveUploadedImage } from '@/lib/imagens'
import { inputToCents } from '@/lib/money'
import { safePhotoUrl, slugify } from '@/lib/text'

export type CatalogState = { error: string | null; done?: string | null }

const GONE: CatalogState = { error: 'Esse serviço não existe.' }

async function reach(serviceId: string) {
  const actor = await requireOrgScope()
  const service = await getService(actor.orgId, serviceId)
  if (!service) return null
  return { actor, service }
}

function refresh(serviceId?: string) {
  revalidatePath('/admin/servicos')
  if (serviceId) revalidatePath(`/admin/servicos/${serviceId}`)
  revalidatePath('/agendar')
  // O preçário da loja mostra o nome na língua da cliente — se ela
  // acabou de traduzir um serviço, é ali que se vê.
  revalidatePath('/loja', 'layout')
}

// ---------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------

export async function createCategoryAction(
  _previous: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const actor = await requireOrgScope()
  const name = String(form.get('name') ?? '').trim()
  if (!name) return { error: 'Dê um nome à categoria.' }

  const result = await createCategory(actor.orgId, name, slugify(name))
  if (!result.ok) {
    return {
      error:
        result.reason === 'taken'
          ? 'Já existe uma categoria com esse nome.'
          : 'Nome inválido.',
    }
  }

  refresh()
  return { error: null, done: 'Categoria criada.' }
}

export async function renameCategoryAction(
  _previous: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const actor = await requireOrgScope()
  const id = String(form.get('id') ?? '')
  const name = String(form.get('name') ?? '').trim()
  if (!id) return { error: 'Categoria desconhecida.' }
  if (!name) return { error: 'Dê um nome à categoria.' }

  await renameCategory(actor.orgId, id, name)
  refresh()
  return { error: null, done: 'Categoria guardada.' }
}

export async function removeCategoryAction(
  _previous: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const actor = await requireOrgScope()
  const id = String(form.get('id') ?? '')
  if (!id) return { error: 'Categoria desconhecida.' }

  const result = await removeCategory(actor.orgId, id)
  if (!result.ok) {
    return {
      error:
        result.reason === 'in_use'
          ? 'Ainda há serviços nesta categoria. Mude-os primeiro.'
          : 'Não foi possível apagar.',
    }
  }

  refresh()
  return { error: null, done: 'Categoria apagada.' }
}

// ---------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------

/** Campo vazio é campo que não existe: guarda-se nulo, não "". */
function texto(form: FormData, campo: string): string | null {
  return String(form.get(campo) ?? '').trim() || null
}

function serviceFrom(form: FormData): ServiceInput | null {
  const name = String(form.get('name') ?? '').trim()
  const typed = String(form.get('slug') ?? '').trim()
  const price = inputToCents(String(form.get('price') ?? ''))
  const duration = Number(String(form.get('duration') ?? '').trim())

  if (price === null) return null
  if (!Number.isInteger(duration)) return null

  return {
    categoryId: String(form.get('category') ?? ''),
    slug: slugify(typed || name),
    name,
    description: texto(form, 'description'),
    basePriceCents: price,
    durationMinutes: duration,
    bookableOnline: form.get('online') === 'on',
    // Um endereço que não passa o crivo entra como "sem fotografia" em
    // vez de rebentar a gravação: quem se enganou não perde o preço e a
    // duração que acabou de escrever.
    imageUrl: safePhotoUrl(String(form.get('image') ?? '')),
    imageAlt: String(form.get('imageAlt') ?? '').trim() || null,
  }
}

/**
 * A fotografia escolhida no telemóvel. O formulário já a encolheu; se
 * vier um ficheiro, ele ganha ao endereço que estivesse no campo.
 * Devolve o erro escrito para a dona, ou o endereço novo, ou nada.
 */
async function photoFrom(
  orgId: string,
  form: FormData,
): Promise<{ url: string | null } | { error: string }> {
  const file = form.get('photo')
  if (!(file instanceof File) || file.size === 0) return { url: null }

  const saved = await saveUploadedImage(orgId, file)
  if ('error' in saved) {
    return {
      error:
        saved.error === 'size'
          ? 'Essa fotografia é demasiado pesada. Escolha outra.'
          : 'Esse ficheiro não é uma fotografia que o site saiba mostrar.',
    }
  }
  return { url: saved.url }
}

export async function createServiceAction(
  _previous: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const actor = await requireOrgScope()

  const input = serviceFrom(form)
  if (!input) return { error: 'Preço e minutos escrevem-se em números.' }
  if (!input.name) return { error: 'O serviço precisa de um nome.' }
  if (!input.categoryId) return { error: 'Escolha a categoria.' }

  const photo = await photoFrom(actor.orgId, form)
  if ('error' in photo) return { error: photo.error }
  if (photo.url) input.imageUrl = photo.url

  const result = await createService(actor.orgId, input)
  if (!result.ok) {
    return {
      error:
        result.reason === 'taken'
          ? 'Já há um serviço com esse endereço. Escolha outro nome.'
          : 'A duração tem de ser maior que zero.',
    }
  }

  refresh()
  redirect(`/admin/servicos/${result.id}`)
}

export async function saveServiceAction(
  _previous: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const found = await reach(String(form.get('service') ?? ''))
  if (!found) return GONE

  const input = serviceFrom(form)
  if (!input) return { error: 'Preço e minutos escrevem-se em números.' }
  if (!input.name) return { error: 'O serviço precisa de um nome.' }
  if (!input.categoryId) return { error: 'Escolha a categoria.' }

  const photo = await photoFrom(found.actor.orgId, form)
  if ('error' in photo) return { error: photo.error }
  if (photo.url) input.imageUrl = photo.url

  const result = await updateService(
    found.actor.orgId,
    found.service.id,
    input,
  )
  if (!result.ok) {
    return {
      error:
        result.reason === 'taken'
          ? 'Já há um serviço com esse endereço. Escolha outro nome.'
          : result.reason === 'not_found'
            ? 'Esse serviço não existe.'
            : 'A duração tem de ser maior que zero.',
    }
  }

  // A fotografia antiga carregada do telemóvel, se ficou órfã, sai.
  if (found.service.image_url !== input.imageUrl) {
    await dropUploadedImageIfOrphan(found.service.image_url)
  }

  refresh(found.service.id)
  return { error: null, done: 'Serviço guardado.' }
}

/**
 * Retirar do catálogo não apaga o passado: o que já foi feito guarda o
 * nome e o preço congelados na comanda.
 */
export async function retireServiceAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('service') ?? ''))
  if (!found) return
  await retireService(found.actor.orgId, found.service.id)
  refresh(found.service.id)
  redirect('/admin/servicos')
}

// ---------------------------------------------------------------------
// Excepções
// ---------------------------------------------------------------------

export async function saveOverrideAction(
  _previous: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const found = await reach(String(form.get('service') ?? ''))
  if (!found) return GONE

  const unitId = String(form.get('unit') ?? '').trim() || null
  const staffId = String(form.get('staff') ?? '').trim() || null
  if (!unitId && !staffId) {
    return { error: 'Uma excepção é sempre de uma loja, de uma pessoa, ou das duas coisas.' }
  }

  const rawPrice = String(form.get('price') ?? '').trim()
  const rawDuration = String(form.get('duration') ?? '').trim()

  const price = rawPrice === '' ? null : inputToCents(rawPrice)
  if (rawPrice !== '' && price === null) return { error: 'Preço inválido.' }

  const duration = rawDuration === '' ? null : Number(rawDuration)
  if (rawDuration !== '' && !Number.isInteger(duration)) {
    return { error: 'Minutos escrevem-se em números inteiros.' }
  }

  const result = await saveOverride(found.actor.orgId, found.service.id, {
    unitId,
    staffId,
    priceCents: price,
    durationMinutes: duration,
    note: String(form.get('note') ?? '').trim() || null,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'empty'
          ? 'Uma excepção que não muda o preço nem a duração não é excepção nenhuma.'
          : 'Valores inválidos.',
    }
  }

  refresh(found.service.id)
  return { error: null, done: 'Excepção guardada.' }
}

export async function removeOverrideAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('service') ?? ''))
  if (!found) return
  const id = String(form.get('id') ?? '')
  if (id) await removeOverride(found.actor.orgId, found.service.id, id)
  refresh(found.service.id)
}

// ---------------------------------------------------------------------
// Recursos que o serviço consome
// ---------------------------------------------------------------------

export async function saveRequirementAction(
  _previous: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const found = await reach(String(form.get('service') ?? ''))
  if (!found) return GONE

  const typeId = String(form.get('type') ?? '')
  const quantity = Number(String(form.get('quantity') ?? '1').trim())
  if (!typeId) return { error: 'Escolha o tipo de recurso.' }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: 'A quantidade é pelo menos um.' }
  }

  const result = await saveRequirement(found.service.id, typeId, quantity)
  if (!result.ok) return { error: 'Não foi possível guardar.' }

  refresh(found.service.id)
  return { error: null, done: null }
}

export async function removeRequirementAction(form: FormData): Promise<void> {
  const found = await reach(String(form.get('service') ?? ''))
  if (!found) return
  const typeId = String(form.get('type') ?? '')
  if (typeId) await removeRequirement(found.service.id, typeId)
  refresh(found.service.id)
}
