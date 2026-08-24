'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Trash2 } from 'lucide-react'
import {
  addAbsenceAction,
  addRoleAction,
  closeScheduleAction,
  createMemberAction,
  deactivateMemberAction,
  openScheduleAction,
  reactivateMemberAction,
  removeAbsenceAction,
  removeRoleAction,
  removeScheduleAction,
  saveMemberAction,
  setPasswordAction,
  setUnitAction,
  toggleSkillAction,
  type TeamState,
} from '@/app/(desk)/admin/equipe/actions'
import { Panel } from '@/components/gestao-panel'
import { Badge, Button, Field, Input, Notice, Select, Textarea } from '@/components/ui'
import { ABSENCE_LABEL, LEVEL_LABEL } from '@/lib/status'
import { WEEKDAY_NAMES_PT, formatIsoDay, formatMinutes } from '@/lib/time'

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
// A ficha
// ---------------------------------------------------------------------

export type MemberFields = {
  id: string
  name: string
  phone: string
  email: string | null
  public_alias: string | null
  bio: string | null
  display_color: string
  accepts_online_booking: boolean
}

/**
 * A mesma folha para criar e para corrigir. Ao criar dizem-se logo as
 * lojas; depois disso, as lojas mexem-se na secção delas, porque tirar
 * uma tem consequências na escala.
 */
export function MemberForm({
  member,
  units,
}: {
  member?: MemberFields
  units?: UnitOption[]
}) {
  const [state, action] = useActionState<TeamState, FormData>(
    member ? saveMemberAction : createMemberAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-5">
      <Result state={state} />
      {member ? <input type="hidden" name="staff" value={member.id} /> : null}

      <Panel
        title="Identidade"
        hint="O nome, o telefone com que entra e a cor com que aparece na agenda."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="member-name">
            <Input
              id="member-name"
              name="name"
              defaultValue={member?.name}
              maxLength={80}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            label="Nome público"
            htmlFor="member-alias"
            hint="O que a cliente vê no site. Em branco, vê o nome de cima."
          >
            <Input
              id="member-alias"
              name="alias"
              defaultValue={member?.public_alias ?? ''}
              maxLength={80}
              autoComplete="off"
              placeholder="Profissional 1"
            />
          </Field>

          <Field
            label="Telefone"
            htmlFor="member-phone"
            hint="É por aqui que entra no sistema. Não se repete na rede."
          >
            <Input
              id="member-phone"
              name="phone"
              defaultValue={member?.phone}
              inputMode="tel"
              autoComplete="off"
              required
              className="tabular"
            />
          </Field>

          <Field
            label="E-mail"
            htmlFor="member-email"
            hint="Opcional. Serve para recuperar a palavra-passe."
          >
            <Input
              id="member-email"
              name="email"
              type="email"
              defaultValue={member?.email ?? ''}
              autoComplete="off"
            />
          </Field>

          <Field
            label="Cor na agenda"
            htmlFor="member-color"
            hint="É como se distingue à distância numa coluna cheia."
          >
            <Input
              id="member-color"
              name="color"
              type="color"
              defaultValue={member?.display_color ?? '#D9C08A'}
              className="h-10 max-w-24 p-1"
            />
          </Field>
        </div>
      </Panel>

      <Panel
        title="No site"
        hint="O que a cliente vê quando escolhe por quem ser atendida."
      >
        <div className="space-y-4">
          <Field
            label="Apresentação"
            htmlFor="member-bio"
            hint="Uma linha ou duas. Fica visível à cliente."
          >
            <Textarea
              id="member-bio"
              name="bio"
              defaultValue={member?.bio ?? ''}
              maxLength={400}
            />
          </Field>

          <label className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              name="online"
              defaultChecked={member ? member.accepts_online_booking : true}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              Aceita marcação online
              <span className="block text-[0.75rem] text-[var(--ink-muted)]">
                Desligado, deixa de aparecer no funil público — mas continua a
                receber marcações feitas ao balcão.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      {!member && units && units.length > 0 ? (
        <Panel
          title="Lojas onde atende"
          hint="Onde põe os pés. Mexe-se depois na ficha, porque tirar uma loja tem consequências na escala."
        >
          <fieldset>
            <legend className="sr-only">Lojas onde atende</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {units.map((unit) => (
                <label
                  key={unit.id}
                  className="flex items-center gap-2 text-sm text-[var(--ink)]"
                >
                  <input
                    type="checkbox"
                    name="units"
                    value={unit.id}
                    className="accent-[var(--accent)]"
                  />
                  {unit.name}
                </label>
              ))}
            </div>
          </fieldset>
        </Panel>
      ) : null}

      <div className="flex justify-end">
        <Submit label={member ? 'Guardar ficha' : 'Criar ficha'} />
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------

export type RoleFields = {
  id: string
  role: 'owner' | 'manager' | 'professional'
  unit_id: string | null
  unit_name: string | null
}

export function RolesPanel({
  staffId,
  roles,
  units,
  canGrantNetwork,
}: {
  staffId: string
  roles: RoleFields[]
  units: UnitOption[]
  canGrantNetwork: boolean
}) {
  const [add, addAction] = useActionState<TeamState, FormData>(
    addRoleAction,
    EMPTY,
  )
  const [remove, removeAction] = useActionState<TeamState, FormData>(
    removeRoleAction,
    EMPTY,
  )
  const [level, setLevel] = useState<'owner' | 'manager' | 'professional'>(
    'professional',
  )
  const [unit, setUnit] = useState('')

  const network = unit === ''
  const sentence =
    level === 'owner'
      ? 'A dona vê e mexe na rede toda. Não se prende a uma loja.'
      : network
        ? level === 'manager'
          ? 'Gerente sem loja associada é gerente da rede toda.'
          : 'Profissional: vê a agenda dela e mais nada.'
        : level === 'manager'
          ? 'Gerente dessa loja: o dia, o caixa e as clientes dela. Não vê o catálogo da rede nem as comissões.'
          : 'Profissional: vê a agenda dela e mais nada.'

  return (
    <div>
      {roles.length > 0 ? (
        <div className="divide-y divide-[var(--line-soft)]">
          {roles.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 px-5 py-3 sm:px-6"
            >
              <Badge
                tone={row.role === 'owner' ? 'accent' : 'neutral'}
                className="w-28 justify-center"
              >
                {LEVEL_LABEL[row.role]}
              </Badge>
              <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                {row.unit_name ?? 'Rede toda'}
              </p>
              <form action={removeAction}>
                <input type="hidden" name="staff" value={staffId} />
                <input type="hidden" name="id" value={row.id} />
                <IconSubmit label={`Tirar ${LEVEL_LABEL[row.role]}`} />
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-5 py-4 text-[0.8125rem] text-[var(--ink-faint)] sm:px-6">
          Sem papel nenhum, esta pessoa não consegue entrar.
        </p>
      )}

      <form
        action={addAction}
        className="space-y-2.5 border-t border-[var(--line-soft)] bg-[var(--surface-2)] px-5 py-4 sm:px-6"
      >
        <Result state={add} />
        <Result state={remove} />
        <input type="hidden" name="staff" value={staffId} />
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          {/* As larguras fixas destes campos são para o ecrã largo, onde
              a fila inteira cabe. No telemóvel davam uma coluna às
              escadinhas — 176px, 224px, um botão — encostada à esquerda
              com o resto do cartão vazio. Aqui cada um toma a linha. */}
          <Field label="Papel" htmlFor="role-level" className="w-full sm:w-44">
            <Select
              id="role-level"
              name="level"
              value={level}
              onChange={(event) =>
                setLevel(
                  event.target.value as 'owner' | 'manager' | 'professional',
                )
              }
            >
              <option value="professional">{LEVEL_LABEL.professional}</option>
              <option value="manager">{LEVEL_LABEL.manager}</option>
              {canGrantNetwork ? (
                <option value="owner">{LEVEL_LABEL.owner}</option>
              ) : null}
            </Select>
          </Field>

          <Field label="Loja" htmlFor="role-unit" className="w-full sm:w-56">
            <Select
              id="role-unit"
              name="unit"
              value={level === 'owner' ? '' : unit}
              disabled={level === 'owner'}
              onChange={(event) => setUnit(event.target.value)}
            >
              {canGrantNetwork || level === 'professional' ? (
                <option value="">Rede toda</option>
              ) : null}
              {units.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>

          <Submit label="Dar papel" variant="outline" />
        </div>
        <p className="text-[0.75rem] text-[var(--ink-muted)]">{sentence}</p>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------
// Lojas onde atende
// ---------------------------------------------------------------------

export function MemberUnits({
  staffId,
  units,
  current,
}: {
  staffId: string
  units: UnitOption[]
  current: string[]
}) {
  const [state, action] = useActionState<TeamState, FormData>(
    setUnitAction,
    EMPTY,
  )

  return (
    <div className="space-y-3">
      <Result state={state} />
      <div className="flex flex-wrap gap-2">
        {units.map((unit) => {
          const on = current.includes(unit.id)
          return (
            <form key={unit.id} action={action}>
              <input type="hidden" name="staff" value={staffId} />
              <input type="hidden" name="unit" value={unit.id} />
              <input type="hidden" name="on" value={on ? '0' : '1'} />
              <Toggle on={on} label={unit.name} />
            </form>
          )
        })}
      </div>
    </div>
  )
}

/** Um interruptor que é um botão: carrega-se e o servidor decide. */
function Toggle({ on, label }: { on: boolean; label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={on}
      className={[
        'inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-3 py-1.5',
        'text-[0.8125rem] transition-colors disabled:opacity-40',
        on
          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] text-[var(--accent-strong)]'
          : 'border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--ink-faint)] hover:text-[var(--ink)]',
      ].join(' ')}
    >
      {on ? <Check size={13} /> : null}
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------
// Habilidades
// ---------------------------------------------------------------------

export function SkillsPanel({
  staffId,
  groups,
}: {
  staffId: string
  groups: { category: string; services: { id: string; name: string; has: boolean }[] }[]
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.category}>
          <p className="mb-2 text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
            {group.category}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.services.map((service) => (
              <form key={service.id} action={toggleSkillAction}>
                <input type="hidden" name="staff" value={staffId} />
                <input type="hidden" name="service" value={service.id} />
                <input
                  type="hidden"
                  name="on"
                  value={service.has ? '0' : '1'}
                />
                <Toggle on={service.has} label={service.name} />
              </form>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Escala
// ---------------------------------------------------------------------

export function OpenScheduleForm({
  staffId,
  units,
  today,
}: {
  staffId: string
  units: UnitOption[]
  today: string
}) {
  const [state, action] = useActionState<TeamState, FormData>(
    openScheduleAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-3">
      <Result state={state} />
      <input type="hidden" name="staff" value={staffId} />

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* Loja e dia tomam a linha no telemóvel; as duas horas partem-na
            ao meio, que é como se lê «das nove às seis». Antes eram
            quatro larguras fixas a cair umas por baixo das outras em
            degraus. */}
        <Field label="Loja" htmlFor="sched-unit" className="w-full sm:w-48">
          <Select id="sched-unit" name="unit" required>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Dia da semana"
          htmlFor="sched-weekday"
          className="w-full sm:w-40"
        >
          <Select id="sched-weekday" name="weekday" defaultValue="1">
            {WEEKDAY_NAMES_PT.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Entra"
          htmlFor="sched-starts"
          className="flex-1 sm:w-28 sm:flex-none"
        >
          <Input
            id="sched-starts"
            name="starts"
            type="time"
            defaultValue="09:00"
            className="tabular"
            required
          />
        </Field>

        <Field
          label="Sai"
          htmlFor="sched-ends"
          className="flex-1 sm:w-28 sm:flex-none"
        >
          <Input
            id="sched-ends"
            name="ends"
            type="time"
            defaultValue="18:00"
            className="tabular"
            required
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* As duas datas emparelham; a nota e o botão descem para uma
            linha inteira. No telemóvel a nota subia para o lado do
            rótulo «Até» — ficava a explicar um campo que estava por
            baixo dela, e o botão trepava com ela. */}
        <Field
          label="A partir de"
          htmlFor="sched-from"
          className="flex-1 sm:w-40 sm:flex-none"
        >
          <Input
            id="sched-from"
            name="from"
            type="date"
            defaultValue={today}
            className="tabular"
            required
          />
        </Field>

        <Field
          label="Até"
          htmlFor="sched-to"
          className="flex-1 sm:w-40 sm:flex-none"
        >
          <Input id="sched-to" name="to" type="date" className="tabular" />
        </Field>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:flex-1">
          <p className="text-[0.75rem] text-[var(--ink-faint)]">
            &ldquo;Até&rdquo; em branco: sem fim à vista.
          </p>
          <Submit label="Abrir escala" variant="outline" />
        </div>
      </div>
    </form>
  )
}

export type ScheduleFields = {
  id: string
  unit_name: string
  weekday: number
  starts_min: number
  ends_min: number
  valid_from: string
  valid_to: string | null
  is_current: boolean
  is_future: boolean
}

/**
 * Uma vigência não se edita. Fecha-se com um último dia — e abre-se
 * outra por cima, a partir do dia seguinte.
 */
export function ScheduleLine({
  staffId,
  row,
  today,
}: {
  staffId: string
  row: ScheduleFields
  today: string
}) {
  const [close, closeAction] = useActionState<TeamState, FormData>(
    closeScheduleAction,
    EMPTY,
  )
  const [remove, removeAction] = useActionState<TeamState, FormData>(
    removeScheduleAction,
    EMPTY,
  )
  const [closing, setClosing] = useState(false)

  return (
    <div className="px-5 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="w-24 shrink-0 text-sm text-[var(--ink)]">
          {WEEKDAY_NAMES_PT[row.weekday]}
        </span>
        <span className="tabular w-28 shrink-0 text-sm text-[var(--ink)]">
          {formatMinutes(row.starts_min)}–{formatMinutes(row.ends_min)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--ink-muted)]">
          {row.unit_name}
        </span>

        {row.is_future ? <Badge tone="warn">Começa depois</Badge> : null}
        {/* Lia-se «2026-02-02 → sem fim»: a data escrita para a máquina.
            A vigência é uma data de calendário, não um instante — não há
            fuso a converter, só a ordem portuguesa a pôr. */}
        <span className="tabular shrink-0 text-[0.75rem] text-[var(--ink-faint)]">
          {formatIsoDay(row.valid_from)}
          {row.valid_to ? ` → ${formatIsoDay(row.valid_to)}` : ' → sem fim'}
        </span>

        {row.is_future ? (
          <form action={removeAction} className="shrink-0">
            <input type="hidden" name="staff" value={staffId} />
            <input type="hidden" name="id" value={row.id} />
            <IconSubmit label="Apagar escala" />
          </form>
        ) : (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => setClosing((value) => !value)}
          >
            {closing ? 'Deixar estar' : 'Fechar'}
          </Button>
        )}
      </div>

      {closing ? (
        <form
          action={closeAction}
          className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2"
        >
          <input type="hidden" name="staff" value={staffId} />
          <input type="hidden" name="id" value={row.id} />
          <Field
            label="Último dia"
            htmlFor={`close-${row.id}`}
            className="flex-1 sm:w-40 sm:flex-none"
            hint="Vale até este dia, inclusive."
          >
            <Input
              id={`close-${row.id}`}
              name="last"
              type="date"
              defaultValue={today}
              className="tabular"
              required
            />
          </Field>
          <Submit label="Fechar" variant="danger" size="sm" />
        </form>
      ) : null}

      {close.error || close.done || remove.error || remove.done ? (
        <div className="mt-2 space-y-1">
          <Result state={close} />
          <Result state={remove} />
        </div>
      ) : null}
    </div>
  )
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
