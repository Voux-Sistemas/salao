'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import {
  addHoursAction,
  addResourceAction,
  addSpecialAction,
  copyWeekdayAction,
  createTypeAction,
  createUnitAction,
  removeHoursAction,
  removeResourceAction,
  removeSpecialAction,
  removeTypeAction,
  saveRulesAction,
  saveUnitAction,
  type ResourceState,
  type UnitState,
} from '@/app/(desk)/admin/unidades/actions'
import { Button, Field, Input, Notice, Select } from '@/components/ui'
import { STRATEGY_LABEL } from '@/lib/status'
import { WEEKDAY_NAMES_PT } from '@/lib/time'

const EMPTY: UnitState = { error: null, done: null }
const EMPTY_RESOURCE: ResourceState = { error: null, done: null }

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

function Result({ state }: { state: { error: string | null; done?: string | null } }) {
  if (state.error) return <Notice tone="bad">{state.error}</Notice>
  if (state.done) return <Notice tone="ok">{state.done}</Notice>
  return null
}

// ---------------------------------------------------------------------
// A loja
// ---------------------------------------------------------------------

export type UnitFields = {
  id: string
  slug: string
  name: string
  timezone: string
  address_line: string | null
  postal_code: string | null
  city: string | null
  phone: string | null
  email: string | null
  whatsapp_phone: string | null
}

/**
 * A morada e o contacto da loja. O endereço curto é o que fica na barra
 * — muda-se, mas quem tiver o antigo guardado deixa de o encontrar.
 */
export function UnitDetailsForm({
  unit,
  defaultTimezone,
}: {
  unit?: UnitFields
  defaultTimezone: string
}) {
  const [state, action] = useActionState<UnitState, FormData>(
    unit ? saveUnitAction : createUnitAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-4">
      {unit ? <input type="hidden" name="unit" value={unit.id} /> : null}
      <Result state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="unit-name">
          <Input
            id="unit-name"
            name="name"
            defaultValue={unit?.name ?? ''}
            maxLength={80}
            required
            autoComplete="off"
          />
        </Field>
        <Field
          label="Endereço curto"
          htmlFor="unit-slug"
          hint="É o que aparece na barra: /loja/este-pedaço."
        >
          <Input
            id="unit-slug"
            name="slug"
            defaultValue={unit?.slug ?? ''}
            maxLength={60}
            autoComplete="off"
            placeholder="deixe em branco para vir do nome"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Morada" htmlFor="unit-address">
          <Input
            id="unit-address"
            name="address"
            defaultValue={unit?.address_line ?? ''}
            maxLength={160}
            autoComplete="off"
          />
        </Field>
        <Field label="Código postal" htmlFor="unit-postal">
          <Input
            id="unit-postal"
            name="postal"
            defaultValue={unit?.postal_code ?? ''}
            maxLength={20}
            autoComplete="off"
          />
        </Field>
        <Field label="Cidade" htmlFor="unit-city">
          <Input
            id="unit-city"
            name="city"
            defaultValue={unit?.city ?? ''}
            maxLength={60}
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Telefone" htmlFor="unit-phone">
          <Input
            id="unit-phone"
            name="phone"
            defaultValue={unit?.phone ?? ''}
            maxLength={30}
            autoComplete="off"
          />
        </Field>
        <Field
          label="WhatsApp"
          htmlFor="unit-whatsapp"
          hint="É por aqui que a casa fala com a cliente."
        >
          <Input
            id="unit-whatsapp"
            name="whatsapp"
            defaultValue={unit?.whatsapp_phone ?? ''}
            maxLength={30}
            autoComplete="off"
          />
        </Field>
        <Field label="Email" htmlFor="unit-email">
          <Input
            id="unit-email"
            name="email"
            type="email"
            defaultValue={unit?.email ?? ''}
            maxLength={160}
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        label="Fuso horário"
        htmlFor="unit-timezone"
        hint="Tudo se guarda em UTC; é este fuso que decide que horas a loja vê."
        className="max-w-xs"
      >
        <Input
          id="unit-timezone"
          name="timezone"
          defaultValue={unit?.timezone ?? defaultTimezone}
          maxLength={60}
          autoComplete="off"
        />
      </Field>

      <Submit label={unit ? 'Guardar loja' : 'Criar loja'} />
    </form>
  )
}

// ---------------------------------------------------------------------
// Regras de marcação
// ---------------------------------------------------------------------

export type RuleFields = {
  id: string
  min_lead_minutes: number
  max_lead_days: number
  slot_granularity_minutes: number
  gap_between_services_minutes: number
  cancel_window_hours: number
  assignment_strategy: 'balance_load' | 'first_available' | 'least_busy_week'
}

/**
 * O que o motor de disponibilidade obedece. A recepção pode passar por
 * cima da antecedência mínima — chama-se a isso um encaixe, e fica
 * registado como tal.
 */
export function RulesForm({ unit }: { unit: RuleFields }) {
  const [state, action] = useActionState<UnitState, FormData>(
    saveRulesAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unit" value={unit.id} />
      <Result state={state} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Passo dos horários"
          htmlFor="rule-granularity"
          hint="Minutos entre horas oferecidas."
        >
          <Input
            id="rule-granularity"
            name="granularity"
            type="number"
            min={5}
            max={120}
            step={5}
            defaultValue={unit.slot_granularity_minutes}
            className="tabular"
          />
        </Field>
        <Field
          label="Antecedência mínima"
          htmlFor="rule-min-lead"
          hint="Minutos. A recepção pode ignorar."
        >
          <Input
            id="rule-min-lead"
            name="min_lead"
            type="number"
            min={0}
            step={5}
            defaultValue={unit.min_lead_minutes}
            className="tabular"
          />
        </Field>
        <Field
          label="Antecedência máxima"
          htmlFor="rule-max-lead"
          hint="Dias que a agenda abre à frente."
        >
          <Input
            id="rule-max-lead"
            name="max_lead"
            type="number"
            min={1}
            defaultValue={unit.max_lead_days}
            className="tabular"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Intervalo entre serviços"
          htmlFor="rule-gap"
          hint="Minutos entre um serviço e o seguinte."
        >
          <Input
            id="rule-gap"
            name="gap"
            type="number"
            min={0}
            step={5}
            defaultValue={unit.gap_between_services_minutes}
            className="tabular"
          />
        </Field>
        <Field
          label="Janela de cancelamento"
          htmlFor="rule-cancel"
          hint="Horas antes em que ainda se pode desmarcar."
        >
          <Input
            id="rule-cancel"
            name="cancel_window"
            type="number"
            min={0}
            defaultValue={unit.cancel_window_hours}
            className="tabular"
          />
        </Field>
        <Field
          label="Sem preferência"
          htmlFor="rule-strategy"
          hint="Como se escolhe quem atende."
        >
          <Select
            id="rule-strategy"
            name="strategy"
            defaultValue={unit.assignment_strategy}
          >
            {(
              Object.keys(STRATEGY_LABEL) as (keyof typeof STRATEGY_LABEL)[]
            ).map((key) => (
              <option key={key} value={key}>
                {STRATEGY_LABEL[key]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Submit label="Guardar regras" variant="outline" />
    </form>
  )
}

// ---------------------------------------------------------------------
// Horário
// ---------------------------------------------------------------------

/** Uma faixa a mais no mesmo dia — é assim que se abre depois do almoço. */
export function AddHoursForm({
  unitId,
  weekday,
}: {
  unitId: string
  weekday: number
}) {
  const [state, action] = useActionState<UnitState, FormData>(
    addHoursAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="unit" value={unitId} />
      <input type="hidden" name="weekday" value={weekday} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="opens"
          placeholder="09:00"
          maxLength={5}
          autoComplete="off"
          className="tabular w-20"
          aria-label={`Abre — ${WEEKDAY_NAMES_PT[weekday]}`}
        />
        <span className="text-[var(--ink-faint)]">–</span>
        <Input
          name="closes"
          placeholder="13:00"
          maxLength={5}
          autoComplete="off"
          className="tabular w-20"
          aria-label={`Fecha — ${WEEKDAY_NAMES_PT[weekday]}`}
        />
        <Submit label="Juntar" variant="quiet" size="sm" />
      </div>
    </form>
  )
}

export function RemoveHours({
  unitId,
  id,
}: {
  unitId: string
  id: string
}) {
  return (
    <form action={removeHoursAction}>
      <input type="hidden" name="unit" value={unitId} />
      <input type="hidden" name="id" value={id} />
      <IconSubmit label="Apagar faixa" />
    </form>
  )
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

/** Segunda igual a terça, quarta, quinta e sexta — quase sempre é assim. */
export function CopyWeekdayForm({
  unitId,
  from,
}: {
  unitId: string
  from: number
}) {
  const [state, action] = useActionState<UnitState, FormData>(
    copyWeekdayAction,
    EMPTY,
  )
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button
        type="button"
        variant="quiet"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Copiar para…
      </Button>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="unit" value={unitId} />
      <input type="hidden" name="from" value={from} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="flex flex-wrap items-center gap-2">
        {WEEKDAY_NAMES_PT.map((name, day) =>
          day === from ? null : (
            <label
              key={day}
              className="flex items-center gap-1 text-[0.75rem] text-[var(--ink-muted)]"
            >
              <input type="checkbox" name="to" value={day} />
              {name.slice(0, 3)}
            </label>
          ),
        )}
      </div>
      <p className="text-[0.75rem] text-[var(--ink-faint)]">
        Substitui por completo o horário desses dias.
      </p>
      <div className="flex items-center gap-2">
        <Submit label="Copiar" variant="outline" size="sm" />
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Fechar
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Feriados e horários especiais
// ---------------------------------------------------------------------

/** Se houver linha para a data, ela manda no dia inteiro. */
export function AddSpecialForm({ unitId }: { unitId: string }) {
  const [state, action] = useActionState<UnitState, FormData>(
    addSpecialAction,
    EMPTY,
  )
  const [mode, setMode] = useState<'closed' | 'window'>('closed')

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit" value={unitId} />
      <Result state={state} />

      <div className="grid gap-3 sm:grid-cols-[10rem_10rem_1fr] sm:items-end">
        <Field label="Dia" htmlFor="special-day">
          <Input id="special-day" name="day" type="date" className="tabular" />
        </Field>
        <Field label="O que acontece" htmlFor="special-mode">
          <Select
            id="special-mode"
            name="mode"
            value={mode}
            onChange={(event) =>
              setMode(event.target.value === 'window' ? 'window' : 'closed')
            }
          >
            <option value="closed">Fechado o dia todo</option>
            <option value="window">Horário especial</option>
          </Select>
        </Field>
        <Field label="Nota" htmlFor="special-note">
          <Input
            id="special-note"
            name="note"
            maxLength={80}
            autoComplete="off"
            placeholder="Feriado, véspera de Natal…"
          />
        </Field>
      </div>

      {mode === 'window' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            name="opens"
            placeholder="09:00"
            maxLength={5}
            autoComplete="off"
            className="tabular w-20"
            aria-label="Abre"
          />
          <span className="text-[var(--ink-faint)]">–</span>
          <Input
            name="closes"
            placeholder="15:00"
            maxLength={5}
            autoComplete="off"
            className="tabular w-20"
            aria-label="Fecha"
          />
        </div>
      ) : null}

      <Submit label="Marcar no calendário" variant="outline" />
    </form>
  )
}

export function RemoveSpecial({
  unitId,
  id,
}: {
  unitId: string
  id: string
}) {
  return (
    <form action={removeSpecialAction}>
      <input type="hidden" name="unit" value={unitId} />
      <input type="hidden" name="id" value={id} />
      <IconSubmit label="Apagar dia especial" />
    </form>
  )
}

// ---------------------------------------------------------------------
// Recursos físicos
// ---------------------------------------------------------------------

/** O tipo é da rede. Cria-se uma vez e serve as duas lojas. */
export function ResourceTypeForm() {
  const [state, action] = useActionState<ResourceState, FormData>(
    createTypeAction,
    EMPTY_RESOURCE,
  )

  return (
    <form action={action} className="space-y-2">
      <Result state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Novo tipo" htmlFor="type-name" className="w-56">
          <Input
            id="type-name"
            name="name"
            maxLength={60}
            autoComplete="off"
            placeholder="Cabine, cadeira de lavagem…"
          />
        </Field>
        <Submit label="Criar tipo" variant="outline" />
      </div>
    </form>
  )
}

export function RemoveType({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState<ResourceState, FormData>(
    removeTypeAction,
    EMPTY_RESOURCE,
  )
  const [armed, setArmed] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.error ? (
        <span className="text-[0.75rem] text-[var(--bad)]">{state.error}</span>
      ) : null}
      {armed ? (
        <form action={action} className="flex items-center gap-1">
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
          className="p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

/** A instância é da loja: duas cabines são duas linhas. */
export function AddResourceForm({
  unitId,
  types,
}: {
  unitId: string
  types: { id: string; name: string }[]
}) {
  const [state, action] = useActionState<ResourceState, FormData>(
    addResourceAction,
    EMPTY_RESOURCE,
  )

  if (types.length === 0) {
    return (
      <p className="text-[0.8125rem] text-[var(--ink-muted)]">
        Crie primeiro um tipo de recurso — é da rede, e serve as duas lojas.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="unit" value={unitId} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Tipo" htmlFor="resource-type">
          <Select id="resource-type" name="type">
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nome" htmlFor="resource-name">
          <Input
            id="resource-name"
            name="name"
            maxLength={60}
            autoComplete="off"
            placeholder="Cabine 1"
          />
        </Field>
        <Submit label="Juntar" variant="outline" />
      </div>
    </form>
  )
}

export function RemoveResource({
  unitId,
  id,
}: {
  unitId: string
  id: string
}) {
  return (
    <form action={removeResourceAction}>
      <input type="hidden" name="unit" value={unitId} />
      <input type="hidden" name="id" value={id} />
      <IconSubmit label="Retirar equipamento" />
    </form>
  )
}
