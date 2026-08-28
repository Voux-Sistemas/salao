import Link from 'next/link'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { weekdayOf, type IsoDay } from '@/lib/time'

/**
 * A FITA DE DIAS DO BALCÃO — o eco da fita do funil público, comprimida
 * para a densidade de quem marca com o telefone na outra mão. Sete dias,
 * setas de semana em semana, tudo por ligações: o retrocesso do
 * navegador continua a funcionar.
 *
 * AS SETAS SÃO OPCIONAIS. Onde o título é um calendário — a agenda do
 * dia — elas não acrescentam nada: o ⌄ da data salta para qualquer dia
 * do ano, e tocar num dia da ponta já recentra a fita, porque ela anda
 * com o dia aberto e não com a semana do calendário. Omitir as duas
 * devolve 64px de largura às sete células, que no telemóvel é a
 * diferença entre um dia legível e um dia apertado. `null` continua a
 * desenhar a seta apagada, para quem tem um limite a mostrar.
 *
 * Componente de servidor puro: recebe os endereços já feitos.
 */
export function DeskDayStrip({
  days,
  active,
  today,
  timezone,
  hrefFor,
  prevHref,
  nextHref,
  dense = false,
}: {
  days: IsoDay[]
  active: IsoDay
  today: IsoDay
  timezone: string
  hrefFor: (day: IsoDay) => string
  /** Omitir esconde a seta; `null` desenha-a apagada. */
  prevHref?: string | null
  nextHref?: string | null
  /** Densidade de barra lateral: células mais baixas, letra mais miúda. */
  dense?: boolean
}) {
  return (
    <nav className="flex items-stretch gap-1.5" aria-label="Escolher o dia">
      {prevHref !== undefined ? (
        <StripArrow href={prevHref} label="Semana anterior">
          <ChevronLeft className="h-3.5 w-3.5" />
        </StripArrow>
      ) : null}

      <ul
        className="grid flex-1 gap-1"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((value) => {
          const current = value === active
          return (
            <li key={value}>
              <Link
                href={hrefFor(value)}
                scroll={false}
                aria-current={current ? 'date' : undefined}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 border transition-colors',
                  dense ? 'h-10' : 'h-12',
                  current
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                    : // O fundo próprio é para a fita poder assentar
                      // sobre o creme da página, e não só sobre branco.
                      'border-[var(--line-soft)] bg-[var(--surface-raised)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                )}
              >
                <span
                  className={clsx(
                    'uppercase leading-none',
                    dense
                      ? 'text-[0.5rem] tracking-[0.08em]'
                      : 'text-[0.5625rem] tracking-[0.12em]',
                  )}
                >
                  {weekdayLetterings(value, timezone)}
                </span>
                <span
                  className={clsx(
                    'tabular leading-none',
                    dense ? 'text-[0.75rem]' : 'text-[0.8125rem]',
                  )}
                >
                  {value.slice(8, 10)}
                </span>
                <span
                  aria-hidden
                  className={clsx(
                    'block h-0.5 w-0.5 rounded-full',
                    value === today
                      ? current
                        ? 'bg-[var(--accent-ink)]'
                        : 'bg-[var(--accent)]'
                      : 'bg-transparent',
                  )}
                />
              </Link>
            </li>
          )
        })}
      </ul>

      {nextHref !== undefined ? (
        <StripArrow href={nextHref} label="Semana seguinte">
          <ChevronRight className="h-3.5 w-3.5" />
        </StripArrow>
      ) : null}
    </nav>
  )
}

function StripArrow({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: React.ReactNode
}) {
  const shape = 'flex w-8 shrink-0 items-center justify-center border'
  if (!href) {
    return (
      <span
        aria-hidden
        className={clsx(shape, 'border-[var(--line-soft)] text-[var(--line)]')}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className={clsx(
        shape,
        'border-[var(--line-soft)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {children}
    </Link>
  )
}

const WEEKDAY_3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

/** Três letras certas, sempre — a Intl pt-PT devolve nomes compridos. */
function weekdayLetterings(day: IsoDay, _timezone: string): string {
  return WEEKDAY_3[weekdayOf(day)] ?? ''
}
