import Link from 'next/link'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n'
import { formatMonthLong, formatWeekdayShort, type IsoDay } from '@/lib/time'

/*
 * O vidro escuro da faixa. O dourado entra por cima, do lado da semana,
 * muito baixo: é luz, não cor. O fio de dentro é o que separa a faixa
 * da porcelana sem precisar de borda.
 */
const BAND_GROUND =
  'radial-gradient(640px 300px at 92% -30%, rgba(211,184,126,0.12), rgba(211,184,126,0) 70%), linear-gradient(158deg, #1E1811 0%, #141009 100%)'

/**
 * A MOLDURA LEVE DO FUNIL.
 *
 * É a dos mockups «· delicado» do dia, da profissional, do serviço, da
 * hora e da confirmação, que a casa aprovou — os cinco passos do funil
 * que vêm depois da loja já a usam.
 *
 * O que muda em relação à antiga:
 *
 * - A faixa escura deixa de ir de ponta a ponta. É um painel de cantos
 *   redondos, baixo, com o título em corpo contido.
 * - «‹ Voltar» é um botão, no canto da faixa, em todos os ecrãs.
 * - A semana vive DENTRO da faixa: o dia é parte da pergunta («com
 *   quem, neste dia?»), não uma tira solta no corpo.
 * - O rasto é uma frase — «Loja · Dia · Profissional · …» — e no
 *   telemóvel dá lugar à conta do passo.
 * - A letra é a da casa, a mesma dos outros passos: Playfair no título e
 *   nas iniciais; Inter no resto. Chegou a experimentar-se a Manrope
 *   aqui, e a página parecia de outro site a meio da marcação.
 *
 * TUDO PEQUENO DE PROPÓSITO. A primeira versão tinha botões de 36 px,
 * título de 24 e números de 17, e no telemóvel a casa achou-a grosseira.
 * Os tamanhos daqui são os do mockup delicado; antes de os subir, ver lá.
 */
export function FunnelStage({
  step,
  dict,
  hrefs,
  picksStaff = true,
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
  /**
   * Ao domingo é falso: o passo da profissional sai da fila, e a conta
   * passa a ser de cinco. A numeração das páginas não muda — `step={5}`
   * são as horas em qualquer dia — só o que se desenha.
   */
  picksStaff?: boolean
  /** A loja, em maiúsculas pequenas por cima do título. */
  eyebrow: string
  title: string
  /** O passo anterior: o botão «‹ Voltar». */
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
  const shown = labels
    .map((label, index) => ({ label, index }))
    .filter((entry) => picksStaff || entry.index !== 2)
  const position = shown.findIndex((entry) => entry.index + 1 === step)
  const count = dict.funnel.stepCount
    .replace('{n}', String(position >= 0 ? position + 1 : step))
    .replace('{total}', String(shown.length))

  return (
    <div className="tabular flex min-h-[78vh] flex-col">
      {/* ---------------------------------------------- a faixa --- */}
      <div className="mx-auto w-full max-w-[74.5rem] px-3 pt-2.5 sm:px-5 sm:pt-4">
        <header
          className="band-dark relative overflow-hidden rounded-[20px] px-3.5 pt-3 pb-3.5 shadow-[inset_0_0_0_1px_rgba(211,184,126,0.14)] sm:rounded-[24px] sm:px-8 sm:pt-6 sm:pb-7"
          style={{ background: BAND_GROUND }}
        >
          {/* Voltar, e — no telemóvel — onde se está. */}
          <div className="flex items-center justify-between gap-3">
            {back ? (
              <Link
                href={back.href}
                className="inline-flex h-7 items-center gap-[3px] rounded-full bg-[rgba(242,237,226,0.08)] pr-2.5 pl-1.5 text-[0.78125rem] font-medium text-[#E9E2D4] transition-colors outline-offset-2 hover:bg-[rgba(242,237,226,0.14)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:h-[30px] sm:gap-1 sm:pr-3 sm:pl-2 sm:text-[0.8125rem]"
              >
                <ChevronLeft size={14} strokeWidth={2} aria-hidden />
                {back.label}
              </Link>
            ) : (
              <span />
            )}
            <span className="truncate text-[0.625rem] leading-3 font-semibold tracking-[0.16em] text-[var(--accent)] uppercase sm:hidden">
              {eyebrow}
              <span className="font-medium tracking-[0.04em] text-[#8F8472] normal-case">
                {' · '}
                {count}
              </span>
            </span>
          </div>

          <div className="lg:flex lg:items-end lg:justify-between lg:gap-10">
            <div className="min-w-0">
              <p className="mt-5 hidden text-[0.6875rem] leading-[14px] font-semibold tracking-[0.2em] text-[var(--accent)] uppercase sm:block">
                {eyebrow}
              </p>
              <h1 className="display animate-rise mx-0.5 mt-3 text-[1.3125rem] leading-[1.2] text-balance text-[var(--ink)] sm:mx-0 sm:mt-2 sm:text-[1.875rem] sm:leading-[1.15] lg:text-[2.125rem]">
                {title}
              </h1>

              <ol className="mt-3 hidden flex-wrap items-center text-[0.75rem] leading-4 sm:flex">
                {shown.map(({ label, index }, position) => {
                  const number = index + 1
                  const done = number < step
                  const current = number === step
                  const href = done ? (hrefs?.[index] ?? null) : null
                  const tone = current
                    ? 'font-medium text-[var(--accent-strong)]'
                    : done
                      ? 'text-[var(--ink-muted)]'
                      : 'text-[rgba(242,237,226,0.36)]'
                  return (
                    <li key={label} className="flex items-center">
                      {position > 0 ? (
                        <span aria-hidden className="px-2 text-[rgba(242,237,226,0.36)]">
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

            {week ? (
              <div className="lg:shrink-0">
                {/* Enquanto a semana fica por baixo do título, um fio
                    separa-os; ao lado dele, no monitor, não faz falta. */}
                <div
                  aria-hidden
                  className="mt-3.5 mb-2.5 h-px bg-[rgba(242,237,226,0.08)] sm:mt-5 sm:mb-4 lg:hidden"
                />
                {week}
              </div>
            ) : null}
          </div>
        </header>
      </div>

      {/* ----------------------------------------------- o corpo --- */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-[74.5rem] px-3 pt-[22px] pb-12 sm:px-[3.25rem] sm:pt-10 sm:pb-16">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * A SEMANA DA FAIXA.
 *
 * Sete dias a começar no escolhido. Em cima, o mês por extenso (os dois,
 * quando a semana atravessa o fim do mês) entre as setas da semana
 * anterior e da seguinte — assim os sete dias ficam com a largura toda.
 * Não há «ver calendário»: o dia já foi escolhido no passo anterior, e
 * aqui só se afina.
 *
 * OS NÚMEROS VÃO EM INTER, NÃO EM PLAYFAIR. Os algarismos da Playfair
 * têm alturas diferentes — o 4, o 7 e o 9 descem abaixo da linha — e
 * numa fila de sete dias isso lia-se grosseiro.
 *
 * OS DIAS DA SEMANA VÃO EM TRÊS LETRAS, CORTADAS À MÃO. O `short` do
 * Intl em pt-PT dá «terça», «sábado», «domingo» — por extenso — e no
 * telemóvel encavalitavam-se uns nos outros.
 */
export function BandWeek({
  day,
  days,
  timezone,
  language,
  href,
  previous,
  next,
  dict,
  disabled,
}: {
  day: IsoDay
  days: IsoDay[]
  timezone: string
  language: string
  href: (day: IsoDay) => string
  /** Endereço da semana anterior; null quando já é a primeira. */
  previous: string | null
  /** Endereço da semana seguinte; null quando já passa do limite. */
  next: string | null
  dict: Dictionary
  disabled?: ReadonlySet<IsoDay>
}) {
  const months = [...new Set(days.map((value) => formatMonthLong(value, timezone, language)))]

  return (
    <nav aria-label={dict.funnel.steps.day} className="w-full lg:w-[324px]">
      <div className="flex items-center justify-between">
        <WeekArrow href={previous} label={dict.funnel.previousWeek}>
          <ChevronLeft size={13} strokeWidth={2} aria-hidden />
        </WeekArrow>
        <p className="text-[0.625rem] leading-3 font-medium tracking-[0.2em] text-[var(--ink-muted)] uppercase sm:text-[0.6875rem] sm:leading-[14px]">
          {months.join(' · ')}
        </p>
        <WeekArrow href={next} label={dict.funnel.nextWeek}>
          <ChevronRight size={13} strokeWidth={2} aria-hidden />
        </WeekArrow>
      </div>

      <div className="mt-2 grid grid-cols-7 sm:mt-2.5">
        {days.map((value) => {
          const selected = value === day
          const off = !selected && (disabled?.has(value) ?? false)
          const weekday = formatWeekdayShort(value, timezone, language)
            .replace(/\.$/, '')
            .slice(0, 3)
          const inside = (
            <>
              <span
                className={clsx(
                  'text-[0.5625rem] leading-[11px] font-medium tracking-[0.08em] uppercase sm:text-[0.625rem] sm:leading-3 sm:tracking-[0.1em]',
                  selected
                    ? 'text-[var(--accent)]'
                    : off
                      ? 'text-[rgba(242,237,226,0.26)]'
                      : 'text-[#8F8472]',
                )}
              >
                {weekday}
              </span>
              <span
                className={clsx(
                  'flex size-8 items-center justify-center rounded-full text-[0.875rem] leading-none transition-colors sm:size-9 sm:text-[0.9375rem]',
                  selected
                    ? 'bg-[#C6A96B] font-semibold text-[#1E1811]'
                    : off
                      ? 'text-[rgba(242,237,226,0.26)]'
                      : 'text-[#EDE6D8] group-hover:bg-[rgba(242,237,226,0.08)]',
                )}
              >
                {value.slice(8, 10)}
              </span>
            </>
          )
          const shape = 'flex flex-col items-center gap-1 sm:gap-[5px]'
          return off ? (
            <div key={value} aria-disabled className={shape}>
              {inside}
            </div>
          ) : (
            <Link
              key={value}
              href={href(value)}
              aria-current={selected ? 'date' : undefined}
              className={clsx(
                shape,
                'group rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
              )}
            >
              {inside}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * A seta de uma semana: um círculo só com fio. Sem semana para onde ir,
 * o fio e a seta ficam apagados.
 */
function WeekArrow({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: ReactNode
}) {
  const shape = 'flex size-[26px] shrink-0 items-center justify-center rounded-full sm:size-7'
  if (!href) {
    return (
      <span
        aria-hidden
        className={clsx(
          shape,
          'text-[rgba(242,237,226,0.22)] shadow-[inset_0_0_0_1px_rgba(242,237,226,0.08)]',
        )}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={clsx(
        shape,
        'text-[#E9E2D4] shadow-[inset_0_0_0_1px_rgba(242,237,226,0.16)] transition-colors outline-offset-2 hover:bg-[rgba(242,237,226,0.08)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
      )}
    >
      {children}
    </Link>
  )
}
