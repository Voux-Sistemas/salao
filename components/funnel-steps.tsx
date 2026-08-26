import Link from 'next/link'
import clsx from 'clsx'
import type { Dictionary } from '@/lib/i18n'

/**
 * Cinco passos e um recibo. Os passos já dados são ligações — voltar
 * atrás funciona, porque o que foi escolhido viaja no endereço.
 *
 * A ordem é a que a casa pediu: loja, dia, profissional, serviço, hora.
 * A profissional vem cedo — é a escolha que a cliente quer fazer, e não
 * uma que lhe caia em cima — mas depois do dia, porque quem folga à
 * terça não é escolha nenhuma. O serviço vem antes da hora porque é ele
 * que diz quanto tempo é preciso reservar: ao contrário, ofereciam-se
 * horas que depois não cabiam.
 */
export function FunnelSteps({
  current,
  dict,
  hrefs,
}: {
  current: 1 | 2 | 3 | 4 | 5 | 6
  dict: Dictionary
  /** Endereço de cada passo já percorrido; null desliga a ligação. */
  hrefs?: (string | null)[]
}) {
  const labels = [
    dict.funnel.steps.store,
    dict.funnel.steps.day,
    dict.funnel.steps.staff,
    dict.funnel.steps.service,
    dict.funnel.steps.time,
    dict.funnel.steps.confirm,
  ]

  return (
    <ol className="flex items-center gap-2 text-[0.6875rem] tracking-[0.14em] uppercase">
      {labels.map((label, index) => {
        const step = index + 1
        const done = step < current
        const href = done ? (hrefs?.[index] ?? null) : null
        const content = (
          <span
            className={clsx(
              'transition-colors',
              step === current
                ? 'text-[var(--accent)]'
                : done
                  ? 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  : 'text-[var(--ink-faint)]',
            )}
          >
            <span className="tabular">{step}</span>
            <span className="hidden sm:inline"> · {label}</span>
          </span>
        )

        return (
          <li key={label} className="flex items-center gap-2">
            {href ? (
              // Ao telemóvel o rótulo esconde-se e sobra o algarismo: nove
              // pixéis de largura para voltar atrás. A caixa de toque
              // cresce à volta dele sem o número mudar de tamanho.
              <Link
                href={href}
                className="inline-flex min-h-11 min-w-8 items-center justify-center sm:min-h-0 sm:min-w-0"
              >
                {content}
              </Link>
            ) : (
              content
            )}
            {/* Seis algarismos e cinco traços não cabem na largura de um
                telemóvel: o traço só aparece onde o rótulo também
                aparece, e em baixo fica a fila de números. */}
            {step < labels.length ? (
              <span aria-hidden className="hidden text-[var(--line)] sm:inline">
                —
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
