import Link from 'next/link'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n'
import { formatMonthLong, formatWeekdayShort, type IsoDay } from '@/lib/time'

/*
 * O vidro escuro da faixa. O dourado entra por cima, do lado da semana,
 * muito baixo: é luz, não cor. O fio de dentro é o que separa a faixa
 * da porcelana sem precisar de borda.
 */
const BAND_GROUND =
  'radial-gradient(640px 300px at 92% -30%, rgba(211,184,126,0.13), rgba(211,184,126,0) 70%), linear-gradient(158deg, #1E1811 0%, #141009 100%)'

/**
 * A MOLDURA LEVE DO FUNIL.
 *
 * É a do mockup «Profissional · elegante», que a casa aprovou. Entra
 * passo a passo: a página da profissional é a primeira, e as outras
 * continuam na `FunnelShell` até terem o seu mockup aprovado.
 *
 * O que muda em relação à antiga:
 *
 * - A faixa escura deixa de ir de ponta a ponta. É um painel de cantos
 *   redondos, mais baixo, com o título num peso fino.
 * - A semana vive DENTRO da faixa, à direita do título: o dia é parte
 *   da pergunta («com quem, neste dia?»), não uma tira solta no corpo.
 * - O rasto é uma frase — «Loja · Dia · Profissional · …» — e no
 *   telemóvel dá lugar a «‹ Dia» e à conta do passo.
 * - A letra é a Manrope, a mesma da equipa.
 */
export function FunnelStage({
  step,
  dict,
  hrefs,
  eyebrow,
  title,
  back,
  week,
  children,
}: {
  step: 1 | 2 | 3 | 4 | 5 | 6
  dict: Dictionary
  /** Endereço de cada passo já percorrido; null desliga a ligação. */
  hrefs?: (string | null)[]
  /** A loja, em maiúsculas pequenas por cima do título. */
  eyebrow: string
  title: string
  /** O passo anterior, para o «‹» do telemóvel. */
  back?: { href: string; label: string }
  /** A semana da faixa (ver `BandWeek`). */
  week?: ReactNode
  children: ReactNode
}) {
  const labels = [
    dict.funnel.steps.store,
    dict.funnel.steps.day,
    dict.funnel.steps.staff,
    dict.funnel.steps.service,
    dict.funnel.steps.time,
    dict.funnel.steps.confirm,
  ]
  const count = dict.funnel.stepCount
    .replace('{n}', String(step))
    .replace('{total}', String(labels.length))

  return (
    <div className="tabular flex min-h-[78vh] flex-col font-[family-name:var(--font-desk)]">
      {/* ---------------------------------------------- a faixa --- */}
      <div className="mx-auto w-full max-w-[74.5rem] px-3 pt-1 sm:px-5 sm:pt-2">
        <header
          className="band-dark relative overflow-hidden rounded-[24px] px-4 pt-3.5 pb-[18px] shadow-[inset_0_0_0_1px_rgba(211,184,126,0.16)] sm:rounded-[28px] sm:px-8 sm:pt-[42px] sm:pb-10"
          style={{ background: BAND_GROUND }}
        >
          {/* No telemóvel: voltar, e onde se está. */}
          <div className="flex items-center justify-between gap-3 sm:hidden">
            {back ? (
              <Link
                href={back.href}
                className="-my-2 -ml-1.5 inline-flex items-center gap-0.5 py-2 pr-2 pl-1 text-[0.8125rem] font-medium text-[var(--ink)]"
              >
                <ChevronLeft size={15} strokeWidth={2} aria-hidden />
                {back.label}
              </Link>
            ) : (
              <span />
            )}
            <span className="truncate text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
              {eyebrow}
              <span className="tracking-[0.06em] text-[var(--ink-muted)] normal-case">
                {' · '}
                {count}
              </span>
            </span>
          </div>

          <div className="lg:flex lg:items-end lg:justify-between lg:gap-10">
            <div className="min-w-0">
              <p className="hidden text-[0.75rem] leading-4 font-semibold tracking-[0.2em] text-[var(--accent)] uppercase sm:block">
                {eyebrow}
              </p>
              <h1 className="animate-rise mt-2 text-[1.5rem] leading-[1.15] font-medium tracking-[-0.028em] text-balance text-[var(--ink)] sm:mt-3 sm:text-[2.25rem] sm:leading-[1.1] sm:tracking-[-0.03em] lg:text-[2.625rem]">
                {title}
              </h1>

              <ol className="mt-3 hidden flex-wrap items-center text-[0.8125rem] leading-[18px] sm:flex">
                {labels.map((label, index) => {
                  const number = index + 1
                  const done = number < step
                  const current = number === step
                  const href = done ? (hrefs?.[index] ?? null) : null
                  const tone = current
                    ? 'font-semibold text-[var(--accent-strong)]'
                    : done
                      ? 'text-[var(--ink-muted)]'
                      : 'text-[rgba(242,237,226,0.38)]'
                  return (
                    <li key={label} className="flex items-center">
                      {index > 0 ? (
                        <span aria-hidden className="px-2 text-[rgba(242,237,226,0.38)]">
                          ·
                        </span>
                      ) : null}
                      {href ? (
                        <Link
                          href={href}
                          className={clsx(tone, 'transition-colors hover:text-[var(--ink)]')}
                        >
                          {label}
                        </Link>
                      ) : (
                        <span aria-current={current ? 'step' : undefined} className={tone}>
                          {label}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>

            {week ? <div className="mt-3.5 sm:mt-6 lg:mt-0 lg:shrink-0">{week}</div> : null}
          </div>
        </header>
      </div>

      {/* ----------------------------------------------- o corpo --- */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-[74.5rem] px-3 pt-6 pb-12 sm:px-[3.25rem] sm:pt-[52px] sm:pb-16">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * A SEMANA DA FAIXA.
 *
 * Sete dias a começar no escolhido, como a tira antiga: carregar no
 * último leva à semana seguinte. Por cima, o mês por extenso (os dois,
 * quando a semana atravessa o fim do mês). O dia escolhido é um disco
 * dourado; um dia sem ninguém fica apagado e sem ligação, como na tira.
 */
export function BandWeek({
  day,
  days,
  timezone,
  language,
  href,
  label,
  disabled,
}: {
  day: IsoDay
  days: IsoDay[]
  timezone: string
  language: string
  href: (day: IsoDay) => string
  /** Nome da semana para quem a ouve em vez de a ver. */
  label: string
  disabled?: ReadonlySet<IsoDay>
}) {
  const months = [...new Set(days.map((value) => formatMonthLong(value, timezone, language)))]

  return (
    <nav aria-label={label} className="flex flex-col sm:items-start sm:gap-3.5 lg:items-end">
      <p className="hidden text-[0.6875rem] leading-[14px] font-semibold tracking-[0.22em] text-[var(--ink-muted)] uppercase sm:block lg:pr-3">
        {months.join(' · ')}
      </p>
      <ul className="flex justify-between sm:justify-start sm:gap-2">
        {days.map((value) => {
          const selected = value === day
          const off = !selected && (disabled?.has(value) ?? false)
          const weekday = formatWeekdayShort(value, timezone, language).replace(/\.$/, '')
          const inside = (
            <>
              <span
                className={clsx(
                  'text-[0.5625rem] leading-[11px] font-semibold tracking-[0.1em] uppercase sm:text-[0.625rem] sm:leading-3 sm:tracking-[0.12em]',
                  selected
                    ? 'text-[var(--accent)]'
                    : off
                      ? 'text-[rgba(242,237,226,0.26)]'
                      : 'text-[var(--ink-muted)]',
                )}
              >
                {weekday}
              </span>
              <span
                className={clsx(
                  'flex size-9 items-center justify-center rounded-full text-[0.9375rem] transition-colors sm:size-11 sm:text-[1.0625rem]',
                  selected
                    ? 'bg-[#C6A96B] font-bold text-[#1E1811]'
                    : off
                      ? 'font-medium text-[rgba(242,237,226,0.26)]'
                      : 'font-medium text-[var(--ink)] group-hover:bg-[rgba(242,237,226,0.08)]',
                )}
              >
                {value.slice(8, 10)}
              </span>
            </>
          )
          const shape = 'flex flex-col items-center gap-[5px] sm:gap-2'
          return (
            <li key={value} className="w-[38px] sm:w-11">
              {off ? (
                <div aria-disabled className={shape}>
                  {inside}
                </div>
              ) : (
                <Link
                  href={href(value)}
                  aria-current={selected ? 'date' : undefined}
                  className={clsx(
                    shape,
                    'group rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                  )}
                >
                  {inside}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
