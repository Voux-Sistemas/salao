import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Ornament } from '@/components/brand'

/**
 * AS DUAS TELAS QUE NINGUÉM QUER VER.
 *
 * Página que não existe e página que rebentou. Escritas uma vez porque
 * a diferença entre as duas é o texto e os botões — o resto é a mesma
 * coisa: o raminho da casa, um título em didone e uma saída.
 *
 * Antes disto, um erro mostrava o ecrã cinzento do Next, em inglês, com
 * uma pilha de chamadas. Uma cliente que veja isso fecha o site e liga
 * para outro lado.
 *
 * Não tem 'use client' nem 'server-only': é só marcação, e serve tanto
 * o `not-found.tsx` (que é do servidor) como o `error.tsx` (que tem de
 * ser do cliente). Quem chama é que decide a pele à sua volta.
 */
export function Problem({
  eyebrow,
  title,
  body,
  actions,
  digest,
  className,
}: {
  eyebrow: string
  title: string
  body: string
  actions: ReactNode
  /**
   * O carimbo do erro. Em produção a mensagem verdadeira nunca chega ao
   * browser — fica no registo do servidor. Este código é o fio que liga
   * o que a cliente viu à linha certa desse registo, e é por isso que
   * está aqui: para ela o poder ler ao telefone.
   */
  digest?: string | null
  className?: string
}) {
  return (
    <section
      className={clsx(
        'mx-auto flex w-full max-w-lg flex-col items-center px-6 py-24 text-center sm:py-32',
        className,
      )}
    >
      <Ornament className="animate-fade" />

      <p className="eyebrow animate-fade delay-1 mt-8">{eyebrow}</p>

      <h1 className="display animate-rise delay-2 mt-4 text-[2.25rem] leading-[1.15] text-[var(--ink)] sm:text-[2.75rem]">
        {title}
      </h1>

      <p className="animate-fade delay-3 mt-5 max-w-md text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
        {body}
      </p>

      <div className="animate-fade delay-4 mt-10 flex flex-wrap items-center justify-center gap-3">
        {actions}
      </div>

      {digest ? (
        <p className="animate-fade delay-5 mt-12 text-[0.6875rem] tracking-[0.1em] text-[var(--ink-faint)] uppercase">
          Ref. {digest}
        </p>
      ) : null}
    </section>
  )
}
