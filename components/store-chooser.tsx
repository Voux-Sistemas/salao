import Link from 'next/link'
import { ChevronRight, Store } from 'lucide-react'
import { Badge } from '@/components/ui'
import { sameWord } from '@/lib/text'

/**
 * O SELETOR DE LOJA.
 *
 * Agenda, Caixa e Avisos partilham a mesma porta: sem loja no endereço,
 * o ecrã pergunta em que casa se está. Quem só tem uma loja nunca chega
 * a ver isto — as páginas reencaminham antes.
 *
 * ISTO É UMA PASSAGEM, NÃO UMA CAPA. Estava desenhado como um cartaz:
 * tudo centrado a meio da altura, o título grande e um ramo desenhado
 * por baixo — bonito da primeira vez, uma paragem à quinquagésima. Quem
 * abre o caixa de manhã quer o botão onde ele estava ontem, em cima e à
 * esquerda, sem esperar por nada. Agora é isso: um cabeçalho curto e
 * duas fichas com o que interessa saber antes de entrar.
 *
 * Nada de avatar com a inicial: «Chiado» e «Cascais» dão o mesmo C e o
 * avatar não distinguia nada. O quadrado à esquerda é só o glifo de
 * loja, igual nas duas — serve de âncora para o olho, não de código.
 */

export type ChooserStore = {
  href: string
  name: string
  /** Cidade ou morada — a linha pequena por baixo do nome. */
  meta?: string | null
  /** O estado da casa, à direita do nome. */
  badge?: {
    label: string
    tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'bad'
  } | null
  /** Uma frase sobre o que lá espera: o esperado na gaveta, a fila. */
  line?: string | null
}

export function StoreChooser({
  title,
  hint,
  cta = 'Abrir',
  stores,
}: {
  title: string
  hint?: string
  cta?: string
  stores: ChooserStore[]
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="surge mb-5">
        <h1 className="display text-[1.75rem] leading-none text-[var(--ink)]">
          {title}
        </h1>
        <span aria-hidden className="fio-casa mt-3" />
        {hint ? (
          <p className="mt-3 max-w-lg text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
            {hint}
          </p>
        ) : null}
      </header>

      <div className="surge surge-1 grid gap-3 sm:grid-cols-2">
        {stores.map((store) => (
          <Link
            key={store.href}
            href={store.href}
            className="group flex flex-col rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] px-5 py-5 shadow-[0_1px_2px_rgba(15,21,32,0.04)] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-[var(--accent)]"
                >
                  <Store size={17} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="display truncate text-lg leading-tight text-[var(--ink)]">
                    {store.name}
                  </p>
                  {/* A cidade só entra se disser algo que o nome não diga:
                      a casa de Cascais chama-se Cascais e ficava a ler-se
                      «Cascais / Cascais», uma linha a repetir a de cima. */}
                  {store.meta && !sameWord(store.meta, store.name) ? (
                    <p className="truncate text-[0.75rem] text-[var(--ink-faint)]">
                      {store.meta}
                    </p>
                  ) : null}
                </div>
              </div>
              {store.badge ? (
                <span className="shrink-0">
                  <Badge tone={store.badge.tone ?? 'neutral'}>
                    {store.badge.label}
                  </Badge>
                </span>
              ) : null}
            </div>

            {store.line ? (
              <p className="mt-3.5 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                {store.line}
              </p>
            ) : null}

            {/* `mt-auto` para o rodapé das duas fichas ficar à mesma
                altura, tenha uma delas uma linha a mais ou a menos. */}
            <span className="mt-auto inline-flex items-center gap-1 self-start pt-4 text-[0.8125rem] font-semibold text-[var(--accent)]">
              {cta}
              <ChevronRight
                size={15}
                strokeWidth={2.25}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
