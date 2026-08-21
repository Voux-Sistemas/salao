'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import {
  payAction,
  removeRuleAction,
  saveRuleAction,
  type PayState,
  type RuleState,
} from '@/app/(desk)/admin/comissoes/actions'
import { Button, Field, Input, Notice, Select } from '@/components/ui'
import { formatCents } from '@/lib/money'

const EMPTY_RULE: RuleState = { error: null, done: null }
const EMPTY_PAY: PayState = { error: null, done: null }

function Submit({
  label,
  variant = 'primary',
  size = 'md',
  disabled = false,
}: {
  label: string
  variant?: 'primary' | 'outline' | 'quiet' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending || disabled}
    >
      {label}
    </Button>
  )
}

type Option = { id: string; name: string }

/**
 * A REGRA.
 *
 * Escolhe-se o alcance ao escolher o que se preenche: só profissional,
 * só serviço, os dois, ou nenhum — e nenhum é a regra da casa. A
 * precedência não se configura; é sempre do mais específico para o mais
 * genérico.
 */
export function RuleForm({
  staff,
  services,
}: {
  staff: Option[]
  services: Option[]
}) {
  const [state, action] = useActionState<RuleState, FormData>(
    saveRuleAction,
    EMPTY_RULE,
  )
  const [staffId, setStaffId] = useState('')
  const [serviceId, setServiceId] = useState('')

  const scope =
    staffId && serviceId
      ? 'Vale para esta profissional neste serviço — e ganha a todas as outras.'
      : staffId
        ? 'Vale para tudo o que esta profissional faz, salvo regra de profissional + serviço.'
        : serviceId
          ? 'Vale para este serviço, com quem quer que o faça, salvo regra de profissional.'
          : 'É a regra da casa: vale quando não houver nenhuma mais específica.'

  return (
    <form action={action} className="space-y-3">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.done ? <Notice tone="ok">{state.done}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end">
        <Field label="Profissional" htmlFor="rule-staff">
          <Select
            id="rule-staff"
            name="staff"
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
          >
            <option value="">Todas</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Serviço" htmlFor="rule-service">
          <Select
            id="rule-service"
            name="service"
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
          >
            <option value="">Todos</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Percentagem" htmlFor="rule-percent">
          <Input
            id="rule-percent"
            name="percent"
            inputMode="decimal"
            placeholder="40"
            className="tabular"
          />
        </Field>

        <Submit label="Guardar regra" variant="outline" />
      </div>

      <p className="text-[0.75rem] text-[var(--ink-faint)]">{scope}</p>
    </form>
  )
}

export function RemoveRule({ id }: { id: string }) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label="Apagar regra"
        className="shrink-0 p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
      >
        <Trash2 size={14} />
      </button>
    )
  }

  return (
    <form action={removeRuleAction} className="flex shrink-0 items-center gap-1">
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
  )
}

/**
 * PAGAR.
 *
 * Em duas passagens: arma-se e só depois se paga. Vai o total e o
 * número de linhas que estão no ecrã; se lá atrás a conta já não for
 * essa, o servidor recusa em vez de pagar uma soma que ninguém viu.
 */
export function PayForm({
  staffId,
  staffName,
  totalCents,
  entries,
}: {
  staffId: string
  staffName: string
  totalCents: number
  entries: number
}) {
  const [state, action] = useActionState<PayState, FormData>(
    payAction,
    EMPTY_PAY,
  )
  const [armed, setArmed] = useState(false)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="staff" value={staffId} />
      <input type="hidden" name="total" value={totalCents} />
      <input type="hidden" name="entries" value={entries} />

      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {state.done ? <Notice tone="ok">{state.done}</Notice> : null}

      {armed ? (
        <>
          <Field label="Nota do pagamento" htmlFor={`pay-note-${staffId}`}>
            <Input
              id={`pay-note-${staffId}`}
              name="note"
              maxLength={160}
              autoComplete="off"
              placeholder="Transferência, dinheiro, referência…"
            />
          </Field>
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">
            Vai marcar {entries} linha{entries === 1 ? '' : 's'} como paga
            {entries === 1 ? '' : 's'} a {staffName}, no total de{' '}
            <span className="tabular text-[var(--ink)]">
              {formatCents(totalCents)}
            </span>
            . Não há como voltar atrás.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Submit label="Pagar mesmo" />
            <Button
              type="button"
              variant="quiet"
              size="md"
              onClick={() => setArmed(false)}
            >
              Afinal não
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" variant="outline" onClick={() => setArmed(true)}>
          Marcar como pago
        </Button>
      )}
    </form>
  )
}
