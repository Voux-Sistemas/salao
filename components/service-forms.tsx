'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import {
  createCategoryAction,
  createServiceAction,
  removeCategoryAction,
  removeOverrideAction,
  removeRequirementAction,
  renameCategoryAction,
  retireServiceAction,
  saveOverrideAction,
  saveRequirementAction,
  saveServiceAction,
  type CatalogState,
} from '@/app/(desk)/admin/servicos/actions'
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui'
import { centsToInput } from '@/lib/money'

const EMPTY: CatalogState = { error: null, done: null }

function Submit({
  label,
  variant = 'primary',
  size = 'md',
}: {
  label: string
  variant?: 'primary' | 'outline' | 'quiet' | 'danger'
  size?: 'sm' | 'md'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {label}
    </Button>
  )
}

function Result({ state }: { state: CatalogState }) {
  if (state.error) return <Notice tone="bad">{state.error}</Notice>
  if (state.done) return <Notice tone="ok">{state.done}</Notice>
  return null
}

function IconSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={pending}
      className="p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)] disabled:opacity-40"
    >
      <Trash2 size={14} />
    </button>
  )
}

type Option = { id: string; name: string }

// ---------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------

export function CategoryForm() {
  const [state, action] = useActionState<CatalogState, FormData>(
    createCategoryAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-2">
      <Result state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Nova categoria" htmlFor="category-name" className="w-56">
          <Input
            id="category-name"
            name="name"
            maxLength={60}
            autoComplete="off"
            placeholder="Cabelo, unhas, estética…"
          />
        </Field>
        <Submit label="Criar" variant="outline" />
      </div>
    </form>
  )
}

/** Mudar o nome no sítio; apagar só quando já não tem nada dentro. */
export function CategoryLine({
  id,
  name,
  services,
}: {
  id: string
  name: string
  services: number
}) {
  const [rename, renameAction] = useActionState<CatalogState, FormData>(
    renameCategoryAction,
    EMPTY,
  )
  const [remove, removeAction] = useActionState<CatalogState, FormData>(
    removeCategoryAction,
    EMPTY,
  )
  const [armed, setArmed] = useState(false)

  return (
    <div className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <form action={renameAction} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <Input
            name="name"
            defaultValue={name}
            maxLength={60}
            autoComplete="off"
            aria-label={`Nome de ${name}`}
            className="max-w-xs"
          />
          <Submit label="Guardar" variant="quiet" size="sm" />
        </form>

        <span className="shrink-0 text-[0.75rem] text-[var(--ink-muted)]">
          {services} serviço{services === 1 ? '' : 's'}
        </span>

        {armed ? (
          <form action={removeAction} className="flex shrink-0 items-center gap-1">
            <input type="hidden" name="id" value={id} />
            <Submit label="Apagar" variant="danger" size="sm" />
            <Button
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => setArmed(false)}
            >
              Não
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setArmed(true)}
            aria-label={`Apagar ${name}`}
            className="shrink-0 p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {rename.error ? (
        <p className="mt-1 text-[0.75rem] text-[var(--bad)]">{rename.error}</p>
      ) : null}
      {remove.error ? (
        <p className="mt-1 text-[0.75rem] text-[var(--bad)]">{remove.error}</p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------
// O serviço
// ---------------------------------------------------------------------

export type ServiceFields = {
  id: string
  slug: string
  name: string
  category_id: string
  description: string | null
  base_price_cents: number
  duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  bookable_online: boolean
}

/**
 * O preço-base e a duração são o ponto de partida. As folgas antes e
 * depois não aparecem à cliente, mas ocupam a agenda da profissional.
 */
export function ServiceForm({
  service,
  categories,
}: {
  service?: ServiceFields
  categories: Option[]
}) {
  const [state, action] = useActionState<CatalogState, FormData>(
    service ? saveServiceAction : createServiceAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-4">
      {service ? (
        <input type="hidden" name="service" value={service.id} />
      ) : null}
      <Result state={state} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Nome" htmlFor="service-name">
          <Input
            id="service-name"
            name="name"
            defaultValue={service?.name ?? ''}
            maxLength={80}
            required
            autoComplete="off"
          />
        </Field>
        <Field label="Categoria" htmlFor="service-category">
          <Select
            id="service-category"
            name="category"
            defaultValue={service?.category_id ?? categories[0]?.id ?? ''}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Descrição"
        htmlFor="service-description"
        hint="O que a cliente lê antes de escolher."
      >
        <Textarea
          id="service-description"
          name="description"
          defaultValue={service?.description ?? ''}
          maxLength={400}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preço-base" htmlFor="service-price">
          <Input
            id="service-price"
            name="price"
            inputMode="decimal"
            defaultValue={
              service ? centsToInput(service.base_price_cents) : '0,00'
            }
            className="tabular"
          />
        </Field>
        <Field label="Duração (minutos)" htmlFor="service-duration">
          <Input
            id="service-duration"
            name="duration"
            type="number"
            min={5}
            step={5}
            defaultValue={service?.duration_minutes ?? 60}
            className="tabular"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Folga antes (minutos)"
          htmlFor="service-before"
          hint="Ocupa a agenda; a cliente não a vê."
        >
          <Input
            id="service-before"
            name="before"
            type="number"
            min={0}
            step={5}
            defaultValue={service?.buffer_before_minutes ?? 0}
            className="tabular"
          />
        </Field>
        <Field
          label="Folga depois (minutos)"
          htmlFor="service-after"
          hint="Para limpar, arrumar, respirar."
        >
          <Input
            id="service-after"
            name="after"
            type="number"
            min={0}
            step={5}
            defaultValue={service?.buffer_after_minutes ?? 0}
            className="tabular"
          />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-[0.8125rem] text-[var(--ink)]">
        <input
          type="checkbox"
          name="online"
          defaultChecked={service?.bookable_online ?? true}
          className="mt-0.5"
        />
        <span>
          Marcável online
          <span className="block text-[0.75rem] text-[var(--ink-muted)]">
            Desligado, some do funil público sem deixar de existir ao balcão.
          </span>
        </span>
      </label>

      <Field
        label="Endereço curto"
        htmlFor="service-slug"
        hint="Deixe em branco para vir do nome."
        className="max-w-xs"
      >
        <Input
          id="service-slug"
          name="slug"
          defaultValue={service?.slug ?? ''}
          maxLength={60}
          autoComplete="off"
        />
      </Field>

      <Submit label={service ? 'Guardar serviço' : 'Criar serviço'} />
    </form>
  )
}

/** Retirar do catálogo: o passado guarda o nome e o preço congelados. */
export function RetireService({ serviceId }: { serviceId: string }) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <Button type="button" variant="quiet" size="sm" onClick={() => setArmed(true)}>
        Retirar do catálogo
      </Button>
    )
  }

  return (
    <form action={retireServiceAction} className="space-y-2">
      <input type="hidden" name="service" value={serviceId} />
      <p className="text-[0.8125rem] text-[var(--ink-muted)]">
        Deixa de se poder marcar. O que já foi feito fica como está.
      </p>
      <div className="flex items-center gap-2">
        <Submit label="Retirar mesmo" variant="danger" size="sm" />
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => setArmed(false)}
        >
          Afinal não
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Excepções
// ---------------------------------------------------------------------

/**
 * Uma excepção não muda o serviço — muda o que ele custa ou quanto
 * demora naquela loja, com aquela pessoa, ou nas duas coisas.
 */
export function OverrideForm({
  serviceId,
  units,
  staff,
}: {
  serviceId: string
  units: Option[]
  staff: Option[]
}) {
  const [state, action] = useActionState<CatalogState, FormData>(
    saveOverrideAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="service" value={serviceId} />
      <Result state={state} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Loja" htmlFor="override-unit">
          <Select id="override-unit" name="unit">
            <option value="">Todas</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Profissional" htmlFor="override-staff">
          <Select id="override-staff" name="staff">
            <option value="">Todas</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
        <Field label="Preço" htmlFor="override-price" hint="Vazio = o base.">
          <Input
            id="override-price"
            name="price"
            inputMode="decimal"
            placeholder="—"
            className="tabular"
          />
        </Field>
        <Field
          label="Duração"
          htmlFor="override-duration"
          hint="Minutos. Vazio = a base."
        >
          <Input
            id="override-duration"
            name="duration"
            type="number"
            min={5}
            step={5}
            placeholder="—"
            className="tabular"
          />
        </Field>
        <Field label="Motivo" htmlFor="override-note">
          <Input
            id="override-note"
            name="note"
            maxLength={120}
            autoComplete="off"
            placeholder="Cabelo comprido, sénior…"
          />
        </Field>
      </div>

      <p className="text-[0.75rem] text-[var(--ink-faint)]">
        Deixar as duas em &ldquo;Todas&rdquo; não é uma excepção — é o
        preço-base, que se muda lá em cima.
      </p>

      <Submit label="Guardar excepção" variant="outline" />
    </form>
  )
}

export function RemoveOverride({
  serviceId,
  id,
}: {
  serviceId: string
  id: string
}) {
  return (
    <form action={removeOverrideAction}>
      <input type="hidden" name="service" value={serviceId} />
      <input type="hidden" name="id" value={id} />
      <IconSubmit label="Apagar excepção" />
    </form>
  )
}

// ---------------------------------------------------------------------
// Recursos
// ---------------------------------------------------------------------

/** Sem um recurso livre de cada tipo, o horário não se oferece. */
export function RequirementForm({
  serviceId,
  types,
}: {
  serviceId: string
  types: Option[]
}) {
  const [state, action] = useActionState<CatalogState, FormData>(
    saveRequirementAction,
    EMPTY,
  )

  if (types.length === 0) {
    return (
      <p className="text-[0.8125rem] text-[var(--ink-muted)]">
        Ainda não há tipos de recurso na rede. Criam-se em Unidades.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="service" value={serviceId} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
        <Field label="Precisa de" htmlFor="requirement-type">
          <Select id="requirement-type" name="type">
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantos" htmlFor="requirement-quantity">
          <Input
            id="requirement-quantity"
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            className="tabular"
          />
        </Field>
        <Submit label="Juntar" variant="outline" />
      </div>
    </form>
  )
}

export function RemoveRequirement({
  serviceId,
  typeId,
}: {
  serviceId: string
  typeId: string
}) {
  return (
    <form action={removeRequirementAction}>
      <input type="hidden" name="service" value={serviceId} />
      <input type="hidden" name="type" value={typeId} />
      <IconSubmit label="Retirar exigência" />
    </form>
  )
}
