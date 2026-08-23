'use client'

import { useActionState, useState, type ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import clsx from 'clsx'
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
import type { PhotoChoice } from '@/lib/catalog-admin'
import { Panel } from '@/components/gestao-panel'
import { Photo, PhotoFallback } from '@/components/photo'
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui'
import { centsToInput, formatCents, inputToCents } from '@/lib/money'
import { safePhotoUrl } from '@/lib/text'

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

/** Campo numérico com a unidade escrita lá dentro, à direita. */
function SuffixInput({
  suffix,
  className,
  ...props
}: ComponentProps<'input'> & { suffix: string }) {
  return (
    <div className={clsx('relative', className)}>
      <Input
        {...props}
        className="tabular pr-12 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        {suffix}
      </span>
    </div>
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
        <Field label="Nova categoria" htmlFor="category-name" className="w-64">
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

/**
 * Mudar o nome no sítio; apagar só quando já não tem nada dentro.
 *
 * Os dois campos pequenos ao lado são o nome para fora — o que a cliente
 * lê quando o sítio está em inglês ou em espanhol. Vazios é o normal:
 * sem tradução, sai o português.
 */
export function CategoryLine({
  id,
  name,
  nameEn,
  nameEs,
  services,
}: {
  id: string
  name: string
  nameEn: string | null
  nameEs: string | null
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
    <div className="px-5 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <form
          action={renameAction}
          className="flex flex-1 flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <Input
            name="name"
            defaultValue={name}
            maxLength={60}
            autoComplete="off"
            aria-label={`Nome de ${name}`}
            className="max-w-xs"
          />
          <Input
            name="name_en"
            defaultValue={nameEn ?? ''}
            maxLength={60}
            autoComplete="off"
            placeholder="English"
            aria-label={`${name} em inglês`}
            className="max-w-[9.5rem]"
          />
          <Input
            name="name_es"
            defaultValue={nameEs ?? ''}
            maxLength={60}
            autoComplete="off"
            placeholder="Español"
            aria-label={`${name} em espanhol`}
            className="max-w-[9.5rem]"
          />
          <Submit label="Guardar" variant="quiet" size="sm" />
        </form>

        <span className="tabular shrink-0 text-[0.75rem] text-[var(--ink-muted)]">
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
  name_en: string | null
  name_es: string | null
  category_id: string
  description: string | null
  description_en: string | null
  description_es: string | null
  base_price_cents: number
  duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  bookable_online: boolean
  image_url: string | null
  image_alt: string | null
}

/**
 * O preço-base e a duração são o ponto de partida. As folgas antes e
 * depois não aparecem à cliente, mas ocupam a agenda da profissional.
 */
export function ServiceForm({
  service,
  categories,
  photos = [],
}: {
  service?: ServiceFields
  categories: Option[]
  photos?: PhotoChoice[]
}) {
  const [state, action] = useActionState<CatalogState, FormData>(
    service ? saveServiceAction : createServiceAction,
    EMPTY,
  )
  const [price, setPrice] = useState(
    service ? centsToInput(service.base_price_cents) : '0,00',
  )
  const preview = inputToCents(price)
  const [image, setImage] = useState(service?.image_url ?? '')
  const imageSrc = safePhotoUrl(image)

  return (
    <form action={action} className="space-y-5">
      {service ? (
        <input type="hidden" name="service" value={service.id} />
      ) : null}
      <Result state={state} />

      <Panel
        title="Identidade"
        hint="O nome que a cliente lê, a categoria onde o encontra."
      >
        <div className="space-y-4">
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
        </div>
      </Panel>

      <Panel
        title="Nas outras línguas"
        hint="Só para a cliente que lê o sítio em inglês ou espanhol. Em branco, sai o português — e o balcão vê sempre o nome de cima."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome em inglês" htmlFor="service-name-en">
              <Input
                id="service-name-en"
                name="nameEn"
                defaultValue={service?.name_en ?? ''}
                maxLength={80}
                autoComplete="off"
                placeholder={service?.name ?? ''}
              />
            </Field>
            <Field label="Nome em espanhol" htmlFor="service-name-es">
              <Input
                id="service-name-es"
                name="nameEs"
                defaultValue={service?.name_es ?? ''}
                maxLength={80}
                autoComplete="off"
                placeholder={service?.name ?? ''}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição em inglês" htmlFor="service-description-en">
              <Textarea
                id="service-description-en"
                name="descriptionEn"
                defaultValue={service?.description_en ?? ''}
                maxLength={400}
              />
            </Field>
            <Field label="Descrição em espanhol" htmlFor="service-description-es">
              <Textarea
                id="service-description-es"
                name="descriptionEs"
                defaultValue={service?.description_es ?? ''}
                maxLength={400}
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        title="Preço e duração"
        hint="O ponto de partida de toda a rede. O que muda numa loja ou numa mão diz-se depois, como excepção."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <Field label="Preço-base" htmlFor="service-price" className="w-32">
              <Input
                id="service-price"
                name="price"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="tabular"
              />
            </Field>
            <p
              aria-live="polite"
              className={clsx(
                'display pb-1.5 text-xl leading-none',
                preview === null
                  ? 'text-[var(--bad)]'
                  : 'text-[var(--ink)]',
              )}
            >
              {preview === null ? 'preço por acertar' : formatCents(preview)}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <Field label="Duração" htmlFor="service-duration" className="w-32">
              <SuffixInput
                id="service-duration"
                name="duration"
                type="number"
                min={5}
                step={5}
                defaultValue={service?.duration_minutes ?? 60}
                suffix="min"
              />
            </Field>
            <Field label="Folga antes" htmlFor="service-before" className="w-32">
              <SuffixInput
                id="service-before"
                name="before"
                type="number"
                min={0}
                step={5}
                defaultValue={service?.buffer_before_minutes ?? 0}
                suffix="min"
              />
            </Field>
            <Field label="Folga depois" htmlFor="service-after" className="w-32">
              <SuffixInput
                id="service-after"
                name="after"
                type="number"
                min={0}
                step={5}
                defaultValue={service?.buffer_after_minutes ?? 0}
                suffix="min"
              />
            </Field>
          </div>
          <p className="text-[0.75rem] text-[var(--ink-faint)]">
            As folgas ocupam a agenda da profissional — para preparar e
            arrumar — mas a cliente nunca as vê.
          </p>
        </div>
      </Panel>

      <Panel
        title="Fotografia"
        hint="Opcional. Sem fotografia o serviço mostra o monograma da casa — que é o desenho normal, não uma falha."
      >
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="w-40 shrink-0 overflow-hidden border border-[var(--line-soft)]">
            <div className="aspect-[4/3] w-full">
              {imageSrc ? (
                <Photo src={imageSrc} alt="" />
              ) : (
                <PhotoFallback seed={service?.name ?? ''} label={service?.name} />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <Field
              label="Endereço da imagem"
              htmlFor="service-image"
              hint="Um caminho do site (/fotos/…) ou um endereço https://."
            >
              <Input
                id="service-image"
                name="image"
                value={image}
                onChange={(event) => setImage(event.target.value)}
                placeholder="/fotos/valongo/1.jpg"
                maxLength={500}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            {image.trim() && !imageSrc ? (
              <Notice tone="warn">
                Esse endereço não serve. Guardar assim deixa o serviço sem
                fotografia.
              </Notice>
            ) : null}

            {photos.length > 0 ? (
              <div>
                <p className="eyebrow">Fotografias da casa</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {photos.map((choice) => (
                    // `type="button"`: dentro de um formulário, um botão sem
                    // tipo submete-o — escolher a foto gravava o serviço.
                    <button
                      key={choice.url}
                      type="button"
                      onClick={() => setImage(choice.url)}
                      title={choice.label}
                      aria-label={choice.label}
                      aria-pressed={image === choice.url}
                      className={clsx(
                        'size-14 overflow-hidden border transition-colors',
                        image === choice.url
                          ? 'border-[var(--accent)]'
                          : 'border-[var(--line)] hover:border-[var(--ink-faint)]',
                      )}
                    >
                      <Photo src={choice.url} alt="" />
                    </button>
                  ))}
                  {image ? (
                    <button
                      type="button"
                      onClick={() => setImage('')}
                      className="h-14 px-3 text-[0.75rem] text-[var(--ink-muted)] underline underline-offset-4 transition-colors hover:text-[var(--bad)]"
                    >
                      Sem fotografia
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Field
              label="Descrição da imagem"
              htmlFor="service-image-alt"
              hint="O que uma leitora de ecrã lê em voz alta. Em branco, lê o nome do serviço."
            >
              <Input
                id="service-image-alt"
                name="imageAlt"
                defaultValue={service?.image_alt ?? ''}
                maxLength={120}
                autoComplete="off"
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        title="Onde aparece"
        hint="No site e no funil de marcação — ou só na mão da recepção."
      >
        <label className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            name="online"
            defaultChecked={service?.bookable_online ?? true}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span>
            Marcável online
            <span className="block text-[0.75rem] text-[var(--ink-muted)]">
              Desligado, some do funil público sem deixar de existir ao
              balcão.
            </span>
          </span>
        </label>
      </Panel>

      <div className="flex justify-end">
        <Submit label={service ? 'Guardar serviço' : 'Criar serviço'} />
      </div>
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

      <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Field
          label="Preço"
          htmlFor="override-price"
          className="w-28"
          hint="Vazio: o base."
        >
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
          className="w-32"
          hint="Vazio: a base."
        >
          <SuffixInput
            id="override-duration"
            name="duration"
            type="number"
            min={5}
            step={5}
            placeholder="—"
            suffix="min"
          />
        </Field>
        <Field
          label="Motivo"
          htmlFor="override-note"
          className="min-w-56 flex-1"
          hint="Fica na linha, para amanhã se saber porquê."
        >
          <Input
            id="override-note"
            name="note"
            maxLength={120}
            autoComplete="off"
            placeholder="Cabelo comprido, sénior…"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[0.75rem] text-[var(--ink-faint)]">
          Deixar as duas em &ldquo;Todas&rdquo; não é uma excepção — é o
          preço-base, que se muda na ficha.
        </p>
        <Submit label="Guardar excepção" variant="outline" />
      </div>
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
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* No telemóvel os 256px do tipo enchiam a linha e os 96px do
            número caíam sozinhos por baixo, encostados à esquerda. O
            tipo toma a linha; o número fica ao lado do botão. */}
        <Field
          label="Precisa de"
          htmlFor="requirement-type"
          className="w-full sm:w-64"
        >
          <Select id="requirement-type" name="type">
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantos" htmlFor="requirement-quantity" className="w-24">
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
