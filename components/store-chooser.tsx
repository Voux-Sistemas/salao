import Link from 'next/link'
import { Ornament } from '@/components/brand'
import { Badge } from '@/components/ui'
import { IconChevronRight } from '@/components/desk-icons'
import { sameWord } from '@/lib/text'

/**
 * O SELETOR DE LOJA.
 *
 * Agenda, Caixa e Avisos partilham a mesma porta: sem loja no endereço,
 * o ecrã pergunta em que casa se está. Quem só tem uma loja nunca chega
 * a ver isto — as páginas reencaminham antes.
 *
 * Estava escrito três vezes, com três desenhos diferentes, e as duas
 * fichas ficavam encostadas ao canto de cima com o resto do ecrã vazio.
 * Aqui a escolha centra-se no palco e ganha a mesma cara nas três
 * portas. Nada de avatar com a inicial: «Chiado» e «Cascais» dão o
 * mesmo C e o avatar não distinguia nada.
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
  eyebrow,
  title,
  hint,
  cta = 'Abrir',
  stores,
}: {
  eyebrow: string
  title: string
  hint?: string
  cta?: string
  stores: ChooserStore[]
}) {
  return (
    // No ecrã largo centra-se na altura toda; no telemóvel fica em cima,
    // que é onde o polegar já está.
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-10 sm:px-6 lg:min-h-[calc(100dvh-3.5rem)] lg:justify-center lg:py-12">
      <div className="text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display animate-rise mt-2 text-3xl text-[var(--ink)]">
          {title}
        </h1>
        {hint ? (
          <p className="animate-fade delay-1 mx-auto mt-3 max-w-md text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
            {hint}
          </p>
        ) : null}
        <div className="animate-fade delay-2 mt-7 flex justify-center text-[var(--line)]">
          <Ornament className="scale-90" />
        </div>
      </div>

      <div className="animate-rise delay-2 mt-9 grid gap-4 sm:grid-cols-2">
        {stores.map((store) => (
          <Link
            key={store.href}
            href={store.href}
            className="lift group flex flex-col border border-[var(--line)] bg-[var(--surface-raised)] px-6 py-6"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="display text-xl leading-tight text-[var(--ink)] transition-colors group-hover:text-[var(--accent)]">
                {store.name}
              </p>
              {store.badge ? (
                <span className="shrink-0">
                  <Badge tone={store.badge.tone ?? 'neutral'}>
                    {store.badge.label}
                  </Badge>
                </span>
              ) : null}
            </div>

            {/* A cidade só entra se disser algo que o nome não diga: a
                casa de Cascais chama-se Cascais e ficava a ler-se
                «Cascais / CASCAIS», uma linha a repetir a de cima. */}
            {store.meta && !sameWord(store.meta, store.name) ? (
              <p className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                {store.meta}
              </p>
            ) : null}

            {store.line ? (
              <p className="mt-4 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                {store.line}
              </p>
            ) : null}

            <span className="link-slide mt-6 inline-flex items-center gap-1.5 self-start text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--accent)]">
              {cta}
              <IconChevronRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
