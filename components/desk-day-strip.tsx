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
 * SEM CAIXAS: SÓ O DIA ABERTO É QUE SE PINTA.
 *
 * Cada dia foi uma caixa branca com contorno, e enquanto o cabeçalho da
 * agenda era uma faixa branca isso não se via — caixa branca sobre
 * branco é só um fio. Quando o cabeçalho passou para o creme, as sete
 * células viraram sete objectos destacados em fila, que é o desenho de
 * uma grelha de formulário e não de uma semana. E dentro de uma coluna
 * de 68rem cada uma ficou com 143px para uma palavra de nove pontos:
 * uma caixa que é quase toda ar.
 *
 * Agora não há caixa nenhuma. Ficam sete rótulos sobre o papel, e uma
 * só pastilha pintada — a do dia que se está a ver. Deixa de importar
 * que as células sejam largas, porque já não há contorno a denunciar o
 * vazio, e a área de toque continua a ser a célula inteira.
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
                  'flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] transition-colors',
                  dense ? 'h-10' : 'h-12',
                  current
                    ? 'bg-[var(--accent)] text-[color-mix(in_srgb,var(--accent-ink)_72%,transparent)]'
                    : 'text-[var(--ink-faint)] hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]',
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
                {/* O número é o que se procura; o dia da semana é a
                    legenda dele. Sem caixa a separá-los, a diferença
                    tem de estar no peso da tinta. */}
                <span
                  className={clsx(
                    'tabular leading-none',
                    dense ? 'text-[0.8125rem]' : 'text-[0.875rem]',
                    current
                      ? 'text-[var(--accent-ink)]'
                      : 'text-[var(--ink-muted)]',
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
  // Sem contorno, como as células: uma seta com caixa ao lado de sete
  // dias sem caixa lia-se como a única coisa carregável da fita.
  const shape =
    'flex w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]'
  if (!href) {
    return (
      <span aria-hidden className={clsx(shape, 'text-[var(--line)]')}>
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
        'text-[var(--ink-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-[var(--ink)]',
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
