'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { clsx } from 'clsx'
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

const KINDS = Object.keys(ABSENCE_LABEL) as (keyof typeof ABSENCE_LABEL)[]

/** «quinta, 4 de setembro» — para a frase que lê de volta o que se grava. */
function porExtenso(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  /*
    Ao meio-dia UTC e com o fuso fixado, de propósito: esta frase é
    desenhada no servidor e outra vez no navegador, e uma data lida à
    meia-noite cai do lado errado do dia em metade dos fusos — a frase
    saía diferente das duas vezes e o React reclamava do desencontro.
  */
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/**
 * MARCAR UMA AUSÊNCIA — DUAS PERGUNTAS, POR ORDEM.
 *
 * Eram cinco faixas de comandos permanentes para o que é, quase sempre,
 * «a Ana falta na quinta». E faziam as perguntas ao contrário: «Tipo» e
 * «Loja» — que são sempre Folga e Todas — vinham à frente, e a data,
 * que é a única coisa que muda sempre, vinha em terceiro.
 *
 * O QUE AS PERDIA MESMO ERA O «DIA INTEIRO». É o interruptor que decide
 * se aparece «Até» ou «Das / Às», e vivia POR BAIXO dos campos que
 * troca: preenchia-se tudo, e só depois se descobria o botão que teria
 * mudado o que se acabou de preencher. Aqui sobe para antes deles.
 *
 * PARTE DO DIA É UM DIA SÓ. O servidor já só gravava um dia nesse caso
 * — «das 12 às 14, de quinta a domingo» não é uma ausência, são quatro
 * — mas o campo continuava a chamar-se «De», e um «De» sem «Até» faz
 * esperar um intervalo. Passa a chamar-se «No dia».
 *
 * E O FORMULÁRIO FECHA-SE. O bloco chama-se «Ausências» e a lista do
 * que já está marcado é a razão de se vir aqui; ela fica à vista, e
 * isto é um botão até alguém precisar dele.
 */
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
  const [aberto, setAberto] = useState(false)
  const [kind, setKind] = useState<keyof typeof ABSENCE_LABEL>('day_off')
  const [allDay, setAllDay] = useState(true)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState('')
  const [starts, setStarts] = useState('12:00')
  const [ends, setEnds] = useState('14:00')
  const [unit, setUnit] = useState('')
  const [reason, setReason] = useState('')

  /* Gravou: o painel fecha-se sozinho e fica só o recibo. Comparar com
     o último visto, e não com «tem alguma coisa», porque duas ausências
     seguidas devolvem a mesma frase. */
  const [visto, setVisto] = useState<string | null>(null)
  if (state.done && state.done !== visto) {
    setVisto(state.done)
    setAberto(false)
  }

  if (!aberto) {
    return (
      <div className="space-y-3">
        <Result state={state} />
        <Button type="button" variant="outline" onClick={() => setAberto(true)}>
          + Marcar ausência
        </Button>
      </div>
    )
  }

  const nomeLoja = units.find((u) => u.id === unit)?.name
  const onde = nomeLoja ? `só em ${nomeLoja}` : 'em todas as lojas'
  const dia = porExtenso(from)
  const ate = allDay && to && to !== from ? porExtenso(to) : null

  return (
    <form
      action={action}
      className="space-y-3 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_4%,transparent)] p-4"
    >
      <Result state={state} />
      <input type="hidden" name="staff" value={staffId} />
      <input type="hidden" name="kind" value={kind} />
      {/* O servidor lê `allday === 'on'`: em «parte do dia» o campo não
          vai, que é o mesmo que uma caixa por marcar. */}
      {allDay ? <input type="hidden" name="allday" value="on" /> : null}

      {/* ---- 1 · o que é ---- */}
      <Passo n={1} titulo="o que é" />
      <div className="flex flex-wrap gap-2">
        {KINDS.map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => setKind(valor)}
            aria-pressed={kind === valor}
            className={clsx(
              'rounded-full border px-3.5 py-1.5 text-[0.8125rem] transition-colors',
              kind === valor
                ? 'border-[var(--accent)] bg-[var(--accent)] font-semibold text-[var(--accent-ink)]'
                : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:border-[var(--ink-faint)]',
            )}
          >
            {ABSENCE_LABEL[valor]}
          </button>
        ))}
      </div>

      {/* ---- 2 · quando ---- */}
      <div className="pt-1">
        <Passo n={2} titulo="quando" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Comutador on={allDay} onClick={() => setAllDay(true)}>
          Dia inteiro
        </Comutador>
        <Comutador on={!allDay} onClick={() => setAllDay(false)}>
          Só parte do dia
        </Comutador>
      </div>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <Field
          label={allDay ? 'De' : 'No dia'}
          htmlFor="abs-from"
          className="w-full sm:w-40"
        >
          <Input
            id="abs-from"
            name="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="tabular"
            required
          />
        </Field>

        {allDay ? (
          <Field label="Até" htmlFor="abs-to" className="w-full sm:w-40">
            <Input
              id="abs-to"
              name="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="tabular"
            />
          </Field>
        ) : (
          <>
            <Field label="Das" htmlFor="abs-starts" className="w-28">
              <Input
                id="abs-starts"
                name="starts"
                type="time"
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
                className="tabular"
                required
              />
            </Field>
            <Field label="Às" htmlFor="abs-ends" className="w-28">
              <Input
                id="abs-ends"
                name="ends"
                type="time"
                value={ends}
                onChange={(e) => setEnds(e.target.value)}
                className="tabular"
                required
              />
            </Field>
          </>
        )}
      </div>

      {/*
        A FRASE QUE LÊ DE VOLTA O QUE SE VAI GRAVAR.

        Substitui as duas notas de rodapé que explicavam o que os campos
        deviam dizer sozinhos («Até em branco: só esse dia»). E apanha o
        engano de dedo numa data — o único erro que este formulário
        produz e que nenhuma validação apanha, porque 04/09 e 04/10 são
        as duas datas boas.
      */}
      {dia ? (
        <p className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          Falta{' '}
          <strong className="font-semibold text-[var(--accent-strong)]">
            {allDay
              ? ate
                ? `de ${dia} a ${ate}`
                : 'o dia inteiro'
              : `das ${starts} às ${ends}`}
          </strong>
          {allDay && ate ? '' : ` de ${dia}`}.
          {allDay ? '' : ' Continua disponível o resto do dia.'}
        </p>
      ) : null}

      {/*
        LOJA E MOTIVO ENCOLHEM PARA A RESPOSTA QUE JÁ TÊM.

        Dois campos que se usam numa ausência em cada dez não podem
        gastar uma faixa cada um à frente dos que se usam sempre. Aqui a
        resposta está escrita — «em todas as lojas, sem motivo escrito»
        — e quem precisa de outra abre. Fechado continua a ser enviado:
        o `details` esconde, não desliga.
      */}
      <details className="text-[0.8125rem]">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden">
          <span>
            {onde.charAt(0).toUpperCase() + onde.slice(1)},{' '}
            {reason ? `motivo: ${reason}` : 'sem motivo escrito'}.
          </span>
          <span className="font-semibold text-[var(--accent)]">alterar</span>
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-3">
          <Field label="Loja" htmlFor="abs-unit" className="w-full sm:w-44">
            <Select
              id="abs-unit"
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="">Todas as lojas</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Motivo" htmlFor="abs-reason" className="min-w-48 flex-1">
            <Input
              id="abs-reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              autoComplete="off"
              placeholder="Opcional"
            />
          </Field>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Submit label="Marcar ausência" />
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-[0.8125rem] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** O número do passo, para se ver que são dois e onde vai o segundo. */
function Passo({ n, titulo }: { n: number; titulo: string }) {
  return (
    <p className="text-[0.6875rem] font-bold tracking-[0.12em] text-[var(--accent-strong)] uppercase">
      {n} · {titulo}
    </p>
  )
}

function Comutador({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        'rounded-full border px-3.5 py-1.5 text-[0.8125rem] transition-colors',
        on
          ? 'border-[var(--accent)] bg-[var(--accent)] font-semibold text-[var(--accent-ink)]'
          : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:border-[var(--ink-faint)]',
      )}
    >
      {children}
    </button>
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
