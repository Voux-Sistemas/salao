import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { Dictionary } from '@/lib/i18n'
import { FunnelSteps } from '@/components/funnel-steps'
import { Ornament } from '@/components/brand'
import { ButtonLink } from '@/components/ui'

/**
 * A MOLDURA DO FUNIL.
 *
 * Os cinco passos partilham o mesmo palco: uma faixa escura em cima
 * que anuncia onde se está, o corpo em porcelana e — quando já há
 * escolhas feitas — a coluna do lado com o resumo da visita. É a
 * moldura que dá peso a passos que, por si, têm pouco conteúdo: sem
 * ela a página fica a boiar e o rodapé sobe.
 *
 * No telemóvel o resumo desce para o fundo do conteúdo, colado ao
 * fim — a decisão está sempre à vista sem roubar o ecrã.
 */
export function FunnelShell({
  step,
  dict,
  hrefs,
  picksStaff,
  eyebrow,
  title,
  subtitle,
  aside,
  children,
}: {
  step: 1 | 2 | 3 | 4 | 5 | 6
  dict: Dictionary
  /** Endereço de cada passo já percorrido; null desliga a ligação. */
  hrefs?: (string | null)[]
  /** Ao domingo é falso: o rasto de migalhas fica com cinco passos. */
  picksStaff?: boolean
  /** Sobrepõe a etiqueta pequena por cima do título. */
  eyebrow?: string
  title: string
  subtitle?: string
  /** Resumo da visita; ocupa a coluna da direita no ecrã grande. */
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[78vh] flex-col">
      {/* ---------------------------------------------- a faixa --- */}
      <header className="band-dark relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[42rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--gold) 34%, transparent), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-5xl px-5 pt-10 pb-9 sm:px-8 sm:pt-14 sm:pb-12">
          <p className="eyebrow eyebrow-gold">{eyebrow ?? dict.funnel.eyebrow}</p>
          <h1 className="display animate-rise mt-3 text-[1.9rem] leading-[1.12] sm:text-[2.6rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="animate-fade delay-1 mt-3 max-w-xl text-[0.9375rem] text-[var(--ink-muted)]">
              {subtitle}
            </p>
          ) : null}
          <div className="mt-7 border-t border-[var(--line-soft)] pt-5">
            <FunnelSteps
              current={step}
              dict={dict}
              hrefs={hrefs}
              picksStaff={picksStaff}
            />
          </div>
        </div>
      </header>

      {/* ----------------------------------------------- o corpo --- */}
      <div className="flex-1">
        <div
          className={clsx(
            'mx-auto max-w-5xl gap-12 px-5 py-10 sm:px-8 sm:py-14',
            aside ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]' : '',
          )}
        >
          <div className="min-w-0">{children}</div>
          {aside ? (
            <aside className="mt-12 lg:mt-0">
              <div className="lg:sticky lg:top-24">{aside}</div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * A BARRA DO TELEMÓVEL.
 *
 * Num ecrã pequeno o catálogo é longo e o resumo da visita cai lá para
 * baixo: quem escolhe um serviço fica sem confirmação nem saída à
 * vista. Esta barra cola o total e o "continuar" ao fundo do ecrã
 * assim que houver alguma coisa escolhida. No ecrã grande desaparece —
 * lá a coluna do lado já faz o trabalho.
 *
 * É `sticky`, não `fixed`: assim ocupa lugar no fim do passo e larga o
 * ecrã quando o conteúdo acaba, em vez de ficar pousada por cima do
 * rodapé. Qualquer `overflow` num antepassado desfaz isto.
 */
export function MobileVisitBar({
  meta,
  total,
  href,
  label,
}: {
  meta: string
  total: string
  href: string
  label: string
}) {
  return (
    <div className="animate-rise sticky bottom-0 z-40 -mx-5 mt-10 border-t border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3 shadow-[0_-14px_36px_-24px_rgba(31,24,18,0.55)] sm:-mx-8 sm:px-8 lg:hidden">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-[var(--ink-faint)]">{meta}</p>
          <p className="tabular display mt-1 text-[1.125rem] leading-none text-[var(--ink)]">
            {total}
          </p>
        </div>
        <ButtonLink href={href} className="shrink-0">
          {label}
        </ButtonLink>
      </div>
    </div>
  )
}

/**
 * O resumo da visita: o que já foi escolhido, sempre à vista. Uma
 * linha por serviço, o total em baixo, e o pé só aparece quando há
 * algo a dizer (a hora escolhida, um aviso, o botão de avançar).
 */
export function VisitSummary({
  title,
  head,
  lines,
  total,
  footer,
  empty,
}: {
  title: string
  /** O que fica em destaque antes da lista — o dia e a hora, por exemplo. */
  head?: ReactNode
  lines: { label: string; meta?: string; value?: string }[]
  total?: { label: string; value: string }
  footer?: ReactNode
  empty?: string
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface-raised)] px-6 py-6 shadow-[var(--shadow-soft)]">
      <p className="eyebrow text-[var(--ink-faint)]">{title}</p>

      {head ? (
        <div className="mt-4 border-b border-[var(--line-soft)] pb-4">{head}</div>
      ) : null}

      {lines.length === 0 ? (
        <p className="mt-4 text-[0.875rem] text-[var(--ink-faint)]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {lines.map((line, index) => (
            <li key={`${line.label}-${index}`} className="flex items-baseline gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] leading-snug text-[var(--ink)]">
                  {line.label}
                </p>
                {line.meta ? (
                  <p className="mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
                    {line.meta}
                  </p>
                ) : null}
              </div>
              {line.value ? (
                <span className="tabular shrink-0 text-[0.875rem] text-[var(--ink-muted)]">
                  {line.value}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {total ? (
        <div className="mt-5 flex items-baseline justify-between border-t border-[var(--line-soft)] pt-4">
          <span className="eyebrow text-[var(--ink-faint)]">{total.label}</span>
          <span className="tabular display text-xl text-[var(--ink)]">
            {total.value}
          </span>
        </div>
      ) : null}

      {footer ? <div className="mt-5">{footer}</div> : null}

      <div className="mt-6 flex justify-center text-[var(--line)]">
        <Ornament className="scale-75" />
      </div>
    </div>
  )
}
