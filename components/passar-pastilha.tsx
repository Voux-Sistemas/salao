'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import clsx from 'clsx'
import { passarAction, type DeskState } from '@/app/(desk)/agenda/actions'
import type { Candidate } from '@/lib/agenda'
import { shortName } from '@/lib/text'

const EMPTY: DeskState = { error: null, done: null }

/**
 * A PASTILHA DE QUEM FAZ É QUE TROCA QUEM FAZ.
 *
 * Não há botão novo na linha. A pastilha com o nome já estava em todas
 * — no monitor e no telemóvel — e o que se lhe acrescenta é função:
 * para mudar quem faz, toca-se em quem faz.
 *
 * A LINHA JÁ TINHA COISAS A MAIS À DIREITA: «sem contacto», «fechar», o
 * preço e o nome. Um quinto elemento pesava numa lista que se passou o
 * dia a aliviar — e este não acrescenta nada, aproveita.
 *
 * QUEM NÃO PODE APARECE À MESMA, apagada e com a razão à direita:
 * «ocupada às 14:00», «não faz», «fora do turno». Uma lista curta sem
 * explicação parece uma avaria, e quem a lê fica sem saber se o sistema
 * se enganou ou se a colega está mesmo ocupada.
 */
export function PassarPastilha({
  appointmentId,
  cor,
  nome,
  semDono,
  candidatos,
}: {
  appointmentId: string
  cor: string
  nome: string
  /**
   * A marcação está num perfil que não é gente — uma «cadeira» de
   * domingo. A pastilha grita, para se ver de longe qual falta repartir.
   */
  semDono?: boolean
  candidatos: Candidate[]
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    passarAction,
    EMPTY,
  )
  const [aberto, setAberto] = useState(false)

  /* Passou: o menu fecha-se sozinho. Comparar com o último visto, e não
     com «tem alguma coisa», porque duas passagens dão a mesma frase. */
  const [visto, setVisto] = useState<string | null>(null)
  if (state.done && state.done !== visto) {
    setVisto(state.done)
    setAberto(false)
  }

  return (
    /*
      `relative` para o menu se pendurar, e `z-10` para a pastilha ficar
      ACIMA da folha da ligação que cobre a linha inteira. Sem isso, o
      toque abria a marcação em vez de abrir o menu.
    */
    <span className="relative z-10 shrink-0">
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        aria-expanded={aberto}
        className={clsx(
          'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] transition-colors',
          semDono
            ? 'border-dashed border-[color-mix(in_srgb,var(--house-deep)_50%,transparent)] bg-[color-mix(in_srgb,var(--house-deep)_8%,transparent)] font-bold text-[var(--house-deep)]'
            : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:border-[var(--ink-faint)]',
        )}
      >
        {semDono ? null : (
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: cor }}
          />
        )}
        {semDono ? 'por atribuir' : shortName(nome)}
        <span aria-hidden className="text-[0.5rem] text-[var(--ink-faint)]">
          ▾
        </span>
      </button>

      {aberto ? (
        /*
          O menu da casa: pendurado do fundo da pastilha, encostado à
          direita, com tecto de largura E um `max-w` do ecrã menos as
          margens. É o mesmo que o seletor de loja e os filtros dos
          avisos usam — e é esse `max-w` que o impede de sair pela borda
          num telemóvel estreito.
        */
        <span className="absolute top-full right-0 z-30 mt-1.5 block w-[15rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
          <span className="block px-3 pt-2.5 pb-1.5 text-[0.625rem] font-bold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
            Passar a
          </span>

          {state.error ? (
            <span className="block px-3 pb-2 text-[0.75rem] leading-relaxed text-[var(--bad)]">
              {state.error}
            </span>
          ) : null}

          {candidatos.map((quem) =>
            quem.ok ? (
              <form key={quem.staffId} action={action}>
                <input type="hidden" name="appointment" value={appointmentId} />
                <input type="hidden" name="para" value={quem.staffId} />
                <Linha nome={quem.name} why={quem.why} />
              </form>
            ) : (
              <span
                key={quem.staffId}
                className="flex items-center gap-2 border-t border-[var(--line-soft)] px-3 py-2 text-[0.8125rem] text-[var(--ink-faint)]"
              >
                {quem.name}
                <span className="ml-auto text-[0.6875rem]">{quem.why}</span>
              </span>
            ),
          )}

          <button
            type="button"
            onClick={() => setAberto(false)}
            className="block w-full border-t border-[var(--line-soft)] px-3 py-2 text-center text-[0.75rem] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
          >
            Deixar como está
          </button>
        </span>
      ) : null}
    </span>
  )
}

/** Uma pessoa que pode ficar com isto. O `pending` trava o toque duplo. */
function Linha({ nome, why }: { nome: string; why: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-2 border-t border-[var(--line-soft)] px-3 py-2.5 text-left text-[0.8125rem] text-[var(--ink)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] disabled:opacity-40"
    >
      {nome}
      <span className="ml-auto text-[0.6875rem] text-[var(--ink-faint)]">
        {pending ? 'a passar…' : why}
      </span>
    </button>
  )
}
