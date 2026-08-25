'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import {
  addAbsenceAction,
  deactivateMemberAction,
  reactivateMemberAction,
  removeAbsenceAction,
  setPasswordAction,
  type TeamState,
} from '@/app/(desk)/admin/equipe/actions'
import { Button, Field, Input, Notice, Select } from '@/components/ui'
import { ABSENCE_LABEL } from '@/lib/status'

const EMPTY: TeamState = { error: null, done: null }

type UnitOption = { id: string; name: string }

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

function Result({ state }: { state: TeamState }) {
  if (state.error) return <Notice tone="bad">{state.error}</Notice>
  if (state.done) return <Notice tone="ok">{state.done}</Notice>
  return null
}

// ---------------------------------------------------------------------
// Ausências
// ---------------------------------------------------------------------

export function AbsenceForm({
  staffId,
  units,
  today,
}: {
  staffId: string
  units: UnitOption[]
  today: string
}) {
  const [state, action] = useActionState<TeamState, FormData>(
    addAbsenceAction,
    EMPTY,
  )
  const [allDay, setAllDay] = useState(true)

  return (
    <form action={action} className="space-y-3">
      <Result state={state} />
      <input type="hidden" name="staff" value={staffId} />

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* Tipo e loja tomam a linha; as duas datas — ou as duas horas,
            quando não é dia inteiro — partem-na ao meio. Antes eram
            quatro larguras fixas diferentes, uma escadinha encostada à
            esquerda do cartão. */}
        <Field label="Tipo" htmlFor="abs-kind" className="w-full sm:w-36">
          <Select id="abs-kind" name="kind" defaultValue="day_off">
            {(
              Object.keys(ABSENCE_LABEL) as (keyof typeof ABSENCE_LABEL)[]
            ).map((kind) => (
              <option key={kind} value={kind}>
                {ABSENCE_LABEL[kind]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Loja" htmlFor="abs-unit" className="w-full sm:w-44">
          <Select id="abs-unit" name="unit" defaultValue="">
            <option value="">Todas</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="De"
          htmlFor="abs-from"
          className="flex-1 sm:w-40 sm:flex-none"
        >
          <Input
            id="abs-from"
            name="from"
            type="date"
            defaultValue={today}
            className="tabular"
            required
          />
        </Field>

        {allDay ? (
          <Field
            label="Até"
            htmlFor="abs-to"
            className="flex-1 sm:w-40 sm:flex-none"
          >
            <Input id="abs-to" name="to" type="date" className="tabular" />
          </Field>
        ) : (
          <>
            <Field
              label="Das"
              htmlFor="abs-starts"
              className="flex-1 sm:w-28 sm:flex-none"
            >
              <Input
                id="abs-starts"
                name="starts"
                type="time"
                defaultValue="12:00"
                className="tabular"
                required
              />
            </Field>
            <Field
              label="Às"
              htmlFor="abs-ends"
              className="flex-1 sm:w-28 sm:flex-none"
            >
              <Input
                id="abs-ends"
                name="ends"
                type="time"
                defaultValue="14:00"
                className="tabular"
                required
              />
            </Field>
          </>
        )}
      </div>

      <p className="text-[0.75rem] text-[var(--ink-faint)]">
        Loja em branco: falta em todas.
        {allDay ? ' “Até” em branco: só esse dia.' : ''}
      </p>

      <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          name="allday"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          className="accent-[var(--accent)]"
        />
        Dia inteiro
      </label>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Field label="Motivo" htmlFor="abs-reason" className="min-w-56 flex-1">
          <Input
            id="abs-reason"
            name="reason"
            maxLength={120}
            autoComplete="off"
            placeholder="Opcional"
          />
        </Field>
        <Submit label="Marcar ausência" variant="outline" />
      </div>
    </form>
  )
}

export function RemoveAbsence({
  staffId,
  id,
}: {
  staffId: string
  id: string
}) {
  return (
    <form action={removeAbsenceAction}>
      <input type="hidden" name="staff" value={staffId} />
      <input type="hidden" name="id" value={id} />
      <IconSubmit label="Apagar ausência" />
    </form>
  )
}

// ---------------------------------------------------------------------
// Palavra-passe e saída
// ---------------------------------------------------------------------

export function PasswordForm({
  staffId,
  hasPassword,
}: {
  staffId: string
  hasPassword: boolean
}) {
  const [state, action] = useActionState<TeamState, FormData>(
    setPasswordAction,
    EMPTY,
  )
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="space-y-2">
        <Result state={state} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            {hasPassword ? 'Repor palavra-passe' : 'Definir palavra-passe'}
          </Button>
          {hasPassword ? null : (
            <p className="text-[0.8125rem] text-[var(--ink-muted)]">
              Enquanto não tiver uma, não consegue entrar.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <Result state={state} />
      <input type="hidden" name="staff" value={staffId} />
      <p className="max-w-lg text-[0.8125rem] text-[var(--ink-muted)]">
        Escreva-a aqui e diga-a à pessoa. Ao guardar, todas as sessões
        abertas em nome dela fecham-se.
      </p>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Field label="Nova" htmlFor="pw-new" className="w-full sm:w-52">
          <Input
            id="pw-new"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Outra vez" htmlFor="pw-again" className="w-full sm:w-52">
          <Input
            id="pw-again"
            name="again"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <Submit label="Guardar" />
        <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
          Deixar estar
        </Button>
      </div>
    </form>
  )
}

export function MemberExit({
  staffId,
  isActive,
}: {
  staffId: string
  isActive: boolean
}) {
  const [state, action] = useActionState<TeamState, FormData>(
    deactivateMemberAction,
    EMPTY,
  )
  const [armed, setArmed] = useState(false)

  if (!isActive) {
    return (
      <form action={reactivateMemberAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="staff" value={staffId} />
        <Submit label="Voltar a activar" variant="outline" />
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">
          Está fora da equipa. A escala foi fechada no dia da saída.
        </p>
      </form>
    )
  }

  return (
    <div className="space-y-2">
      <Result state={state} />
      {armed ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="staff" value={staffId} />
          <p className="max-w-lg text-[0.8125rem] text-[var(--ink-muted)]">
            Sai da equipa: deixa de aparecer na agenda e no site, e a escala
            fecha-se hoje. O que já atendeu continua a saber que foi ela.
          </p>
          <div className="flex items-center gap-2">
            <Submit label="Tirar da equipa" variant="danger" />
            <Button
              type="button"
              variant="quiet"
              onClick={() => setArmed(false)}
            >
              Deixar estar
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="quiet" onClick={() => setArmed(true)}>
          Tirar da equipa
        </Button>
      )}
    </div>
  )
}
