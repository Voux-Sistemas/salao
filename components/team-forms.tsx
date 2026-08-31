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

const KINDS = Object.keys(ABSENCE_LABEL) as (keyof typeof ABSENCE_LABEL)[]

/** Os quatro que a base conhece, mais o «Outro» que aterra em bloqueio. */
type Motivo = keyof typeof ABSENCE_LABEL | 'outro'

/** As três formas de faltar. Cada uma pede campos diferentes. */
type Quando = 'inteiro' | 'parte' | 'varios'

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
 * MARCAR UMA AUSÊNCIA — MOTIVO, QUANDO, E AS DATAS.
 *
 * Eram cinco faixas de comandos permanentes para o que é, quase sempre,
 * «a Ana falta na quinta». Ficam duas caixinhas em cima e as datas por
 * baixo — as mesmas caixinhas do resto da casa, e não pastilhas nem
 * interruptores próprios desta página.
 *
 * O QUE AS PERDIA MESMO ERA O «DIA INTEIRO». É o comando que decide se
 * aparece «Até» ou «Das / Às», e vivia POR BAIXO dos campos que troca:
 * preenchia-se tudo, e só depois se descobria a caixa que teria mudado
 * o que se acabou de preencher. Aqui está antes deles, onde manda.
 *
 * E NUNCA HÁ UMA CAIXA VAZIA. O «Quando» tem três respostas — um dia
 * inteiro, só parte de um dia, vários dias seguidos — e cada uma mostra
 * apenas os campos que se preenchem mesmo. Não há «Até» em branco à
 * espera, nem nota de rodapé a explicar que pode ficar assim.
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
  const [motivo, setMotivo] = useState<Motivo>('day_off')
  const [quando, setQuando] = useState<Quando>('inteiro')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
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
  /* O intervalo só existe em «vários dias», e só se o fim for depois
     do princípio — uma data mal escrita não vira frase. */
  const ate = quando === 'varios' && to > from ? porExtenso(to) : null

  return (
    <form
      action={action}
      className="space-y-3 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_4%,transparent)] p-4"
    >
      <Result state={state} />
      <input type="hidden" name="staff" value={staffId} />
      {/*
        «OUTRO» NÃO É UM TIPO NOVO NA BASE — É UM BLOQUEIO COM NOME.

        A base conhece quatro: folga, férias, formação e bloqueio. O
        bloqueio é o genérico, o «fecha-me aqui um buraco», e é onde
        aterra o que não é nenhum dos outros três. O que faz de «Outro»
        uma resposta útil não é uma linha nova na base, é a razão
        escrita à mão — e por isso ela passa a ser obrigatória.
      */}
      <input
        type="hidden"
        name="kind"
        value={motivo === 'outro' ? 'block' : motivo}
      />
      {/* O servidor lê `allday === 'on'`: só em «parte de um dia» é que
          o campo não vai, que é o mesmo que uma caixa por marcar. */}
      {quando === 'parte' ? null : (
        <input type="hidden" name="allday" value="on" />
      )}

      {/*
        UMA COISA POR LINHA NO TELEMÓVEL — TODAS, SEM EXCEPÇÃO.

        Estas duas estiveram lado a lado e o «Só parte do dia» saía
        cortado ao meio: uma caixinha de escolha não encolhe o texto,
        corta-o. As datas e as horas estiveram lado a lado e saíam pela
        borda fora — não por causa delas, como cheguei a escrever aqui,
        mas por causa do `box-sizing` que faltava a todos os campos da
        casa; ver o `box-border` no `ui.tsx`.

        A regra passou a ser a mesma para todas, e é a única que aguenta
        qualquer telemóvel: uma por linha até ao `sm`, e só a partir daí
        emparelham.

        E TODAS COM A MESMA LARGURA — a da caixa que as contém. Cheguei
        a pôr tectos diferentes em cada uma («13 rem para as datas, 11
        para as horas») e o resultado foi um formulário em degraus, com
        cada campo a acabar num sítio. Simetria vale mais do que a
        largura ideal de cada campo visto sozinho.
      */}
      <div className="grid items-end gap-3 sm:max-w-md sm:grid-cols-2">
        <Field label="Motivo" htmlFor="abs-kind">
          <Select
            id="abs-kind"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as Motivo)}
          >
            {KINDS.map((valor) => (
              <option key={valor} value={valor}>
                {ABSENCE_LABEL[valor]}
              </option>
            ))}
            <option value="outro">Outro…</option>
          </Select>
        </Field>

        <Field label="Quando" htmlFor="abs-quando">
          <Select
            id="abs-quando"
            value={quando}
            onChange={(e) => setQuando(e.target.value as Quando)}
          >
            <option value="inteiro">Um dia inteiro</option>
            <option value="parte">Só parte de um dia</option>
            <option value="varios">Vários dias seguidos</option>
          </Select>
        </Field>
      </div>

      {/* Escolhido «Outro», a razão deixa de ser opcional: sem ela a
          ausência fica na lista a dizer «Bloqueio» e mais nada, e
          ninguém se lembra do que era daqui a três semanas. */}
      {motivo === 'outro' ? (
        <Field label="Qual" htmlFor="abs-qual" className="max-w-md">
          <Input
            id="abs-qual"
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={120}
            autoComplete="off"
            placeholder="Consulta médica…"
            required
          />
        </Field>
      ) : null}

      {/*
        NUNCA UMA CAIXA VAZIA. É ISTO QUE RESOLVE O PROBLEMA DE VEZ.

        Havia um «Até» sempre à vista, quase sempre em branco, com uma
        nota por baixo a explicar que podia ficar assim. Passei três
        passagens a mexer-lhe na largura, e a largura nunca foi o
        problema: o problema é uma caixa que está lá e não se preenche.
        Vazia parece um erro ou um campo obrigatório por preencher, e
        nenhuma medida a conserta.

        A resposta é o «Quando» ter TRÊS respostas em vez de duas, e
        cada uma mostrar só os campos que se preenchem mesmo:

          um dia inteiro      →  No dia
          só parte de um dia  →  No dia · Das · Às
          vários dias         →  De · Até     (as duas obrigatórias)

        Nenhum ecrã tem uma caixa por preencher, e a nota de rodapé
        desaparece com ela — deixou de haver o que explicar.

        O SERVIDOR JÁ ACEITAVA ISTO SEM MUDAR NADA: `to` em falta vale
        `from`, que é exactamente o que «um dia inteiro» quer dizer.
      */}
      {quando === 'varios' ? (
        <div className="grid items-start gap-3 sm:max-w-md sm:grid-cols-2">
          <Field label="De" htmlFor="abs-from">
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
          <Field label="Até" htmlFor="abs-to">
            <Input
              id="abs-to"
              name="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="tabular"
              required
            />
          </Field>
        </div>
      ) : quando === 'inteiro' ? (
        <div className="sm:max-w-[13rem]">
          <Field label="No dia" htmlFor="abs-from">
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
        </div>
      ) : (
        <div className="space-y-3 sm:flex sm:max-w-md sm:items-end sm:gap-3 sm:space-y-0">
          <Field label="No dia" htmlFor="abs-from" className="sm:w-40">
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
          {/* Uma caixa de hora por linha no telemóvel, lado a lado a
              partir do `sm`. */}
          <div className="grid gap-3 sm:flex sm:gap-3">
            <Field label="Das" htmlFor="abs-starts" className="sm:w-28">
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
            <Field label="Às" htmlFor="abs-ends" className="sm:w-28">
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
          </div>
        </div>
      )}

      {/*
        A FRASE QUE LÊ DE VOLTA O QUE SE VAI GRAVAR.

        Apanha o engano de dedo numa data — o único erro que este
        formulário produz e que nenhuma validação apanha, porque 04/09 e
        04/10 são as duas datas boas. E lê o dia da semana por extenso,
        que é onde o engano salta à vista: ninguém marca folga a uma
        segunda quando queria a quinta.
      */}
      {dia ? (
        <p className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          Falta{' '}
          <strong className="font-semibold text-[var(--accent-strong)]">
            {quando === 'parte'
              ? `das ${starts} às ${ends}`
              : ate
                ? `de ${dia} a ${ate}`
                : 'o dia inteiro'}
          </strong>
          {ate ? '' : ` de ${dia}`}.
          {quando === 'parte' ? ' Continua disponível o resto do dia.' : ''}
        </p>
      ) : null}

      {/*
        A LOJA E A NOTA ENCOLHEM PARA A RESPOSTA QUE JÁ TÊM.

        Dois campos que se usam numa ausência em cada dez não podem
        gastar uma faixa cada um à frente dos que se usam sempre. A
        resposta está escrita — «em todas as lojas, sem nota» — e quem
        precisa de outra abre. Fechado continua a ser enviado: o
        `details` esconde, não desliga.

        A NOTA SAI DAQUI QUANDO O MOTIVO É «OUTRO», porque aí ela é a
        razão da ausência e sobe para o pé do motivo. Só uma das duas
        existe de cada vez — duas caixas com o mesmo nome enviavam duas
        respostas para o mesmo campo.
      */}
      <details className="text-[0.8125rem]">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden">
          <span>
            {onde.charAt(0).toUpperCase() + onde.slice(1)}
            {motivo === 'outro'
              ? '.'
              : reason
                ? `, com nota: ${reason}.`
                : ', sem nota.'}
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
          {motivo === 'outro' ? null : (
            <Field label="Nota" htmlFor="abs-reason" className="min-w-48 flex-1">
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
          )}
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
