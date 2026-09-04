'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  desmarcarPelaChaveAction,
  remarcarPelaChaveAction,
  type ManageState,
  type RemarcarChaveState,
} from '@/app/(public)/m/[chave]/actions'
import { Button, Empty, Notice } from '@/components/ui'

/**
 * OS BOTÕES DA PÁGINA DA CHAVE.
 *
 * A página é do servidor e assim fica: só o que precisa mesmo de estado
 * no navegador vive aqui — a confirmação de desmarcar, que não pode ser
 * um clique só, e o aviso de erro de uma hora que entretanto foi
 * ocupada.
 *
 * A chave vai num campo escondido, e num campo escondido mexe-se. Não
 * faz mal nenhum: a chave já está no endereço, à vista de quem abriu a
 * página, e o servidor volta a procurá-la de raiz a cada pedido. Trocar
 * a chave do formulário pela de outra pessoa exige já ter essa outra
 * chave — e quem a tem não precisava deste formulário.
 */

function Submit({
  label,
  variant = 'primary',
  size = 'md',
  name,
  value,
  className,
}: {
  label: string
  variant?: 'primary' | 'outline' | 'quiet' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  name?: string
  value?: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      name={name}
      value={value}
      disabled={pending}
      className={className}
    >
      {label}
    </Button>
  )
}

// ---------------------------------------------------------------------
// Desmarcar
// ---------------------------------------------------------------------

const VAZIO: ManageState = { error: null, done: null }

export type DesmarcarLabels = {
  cancel: string
  confirm: string
  back: string
  doneTitle: string
  doneHint: string
}

export function DesmarcarPelaChave({
  chave,
  labels,
}: {
  chave: string
  labels: DesmarcarLabels
}) {
  const [armed, setArmed] = useState(false)
  const [state, action] = useActionState<ManageState, FormData>(
    desmarcarPelaChaveAction,
    VAZIO,
  )

  /*
    Feito, o ecrã inteiro muda de assunto. Deixar o botão «Cancelar
    marcação» ao lado de um aviso verde a dizer que já está cancelada é
    convidar a carregar outra vez em algo que já não faz nada.
  */
  if (state.done) {
    return (
      <div className="w-full">
        <Empty title={labels.doneTitle} hint={labels.doneHint} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      {armed ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">
            {labels.confirm}
          </p>
          <form action={action}>
            <input type="hidden" name="chave" value={chave} />
            <Submit label={labels.cancel} variant="danger" size="sm" />
          </form>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => setArmed(false)}
          >
            {labels.back}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => setArmed(true)}
        >
          {labels.cancel}
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Mudar de hora
// ---------------------------------------------------------------------

const SEM_ERRO: RemarcarChaveState = { error: null }

/**
 * A GRELHA DAS HORAS É UM FORMULÁRIO SÓ.
 *
 * Cada hora é um botão de submissão com o seu próprio valor, e não uma
 * ligação: mudar de hora escreve na agenda, e o que escreve não se faz
 * com um clique numa hiperligação que qualquer coisa pode pré-carregar.
 *
 * Sem uma linha de JavaScript necessária para funcionar — o que vive
 * aqui é só a mensagem de erro quando a hora escolhida foi ocupada
 * entre o desenho da página e o carregar do botão.
 */
export function HorasParaRemarcar({
  chave,
  grupos,
  aviso,
}: {
  chave: string
  grupos: { label: string; horas: { iso: string; label: string }[] }[]
  /** O que se diz quando o dia não tem nada. Vem traduzido de fora. */
  aviso: string
}) {
  const [state, action] = useActionState<RemarcarChaveState, FormData>(
    remarcarPelaChaveAction,
    SEM_ERRO,
  )

  const vazio = grupos.every((grupo) => grupo.horas.length === 0)

  return (
    <form action={action}>
      <input type="hidden" name="chave" value={chave} />

      {state.error ? (
        <div className="mb-5">
          <Notice tone="bad">{state.error}</Notice>
        </div>
      ) : null}

      {vazio ? (
        <p className="mt-6 text-[0.875rem] text-[var(--ink-muted)]">{aviso}</p>
      ) : (
        <div className="mt-6 space-y-8">
          {grupos
            .filter((grupo) => grupo.horas.length > 0)
            .map((grupo) => (
              <section key={grupo.label}>
                <div className="flex items-center gap-3">
                  <h3 className="eyebrow text-[var(--ink-faint)]">{grupo.label}</h3>
                  <span className="h-px flex-1 bg-[var(--line-soft)]" />
                </div>
                <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {grupo.horas.map((hora) => (
                    <li key={hora.iso}>
                      <Hora iso={hora.iso} label={hora.label} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </form>
  )
}

/**
 * Uma hora. É um `<button>` cru e não o `Button` da casa porque tem de
 * encher a célula da grelha com a mesma altura das outras — e porque o
 * desenho é o das horas do funil, que a cliente já viu quando marcou.
 */
function Hora({ iso, label }: { iso: string; label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name="time"
      value={iso}
      disabled={pending}
      className="tabular flex h-12 w-full items-center justify-center border border-[var(--line-soft)] bg-[var(--surface-raised)] text-sm text-[var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] hover:shadow-[var(--shadow-soft)] disabled:pointer-events-none disabled:opacity-40"
    >
      {label}
    </button>
  )
}
