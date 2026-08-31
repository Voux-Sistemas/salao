import Link from 'next/link'
import clsx from 'clsx'
import type { ComponentProps, ReactNode } from 'react'
import { Ornament } from '@/components/brand'

/**
 * As peças de que o resto do sistema é feito. Escritas uma vez, servem
 * as duas peles (.skin-salon e .skin-desk) porque só falam pelos nomes
 * das fichas de cor — nunca por cores literais.
 */

// ---------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------

type Variant = 'primary' | 'outline' | 'quiet' | 'danger' | 'ok'
type Size = 'sm' | 'md' | 'lg'

/*
 * A classe "botao" não pinta nada: existe para o globals.css lhe poder
 * pegar. A montra arredonda-os por completo — é a forma da casa, a
 * mesma da pílula — e o balcão fica com o canto dele. Sem esta âncora,
 * arredondar a montra obrigava a mexer no --radius, que também é o
 * canto dos cartões, e o fio quadrado do papel timbrado perdia-se.
 */
const BASE =
  'botao inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 ' +
  'disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap ' +
  'active:translate-y-px'

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[0.8125rem] rounded-[var(--radius)]',
  md: 'h-10 px-5 text-sm rounded-[var(--radius)]',
  lg: 'h-[3.25rem] px-8 text-[0.9375rem] rounded-[var(--radius)] tracking-[0.04em]',
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'sheen bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] ' +
    'hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]',
  outline:
    'border border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] ' +
    'hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]',
  // O terciário tem de continuar a ler-se como botão em repouso. Sem
  // fundo nenhum, um "Juntar" ou um "Copiar para…" ao lado de campos
  // com contorno passa por legenda e ninguém lhe toca. A lavagem é
  // feita a partir de --ink, não de um cinzento fixo: assim serve tanto
  // a porcelana como a banda escura, onde --ink é quase branco.
  quiet:
    'bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] text-[var(--ink-muted)] ' +
    'hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)] hover:text-[var(--ink)]',
  danger:
    'border border-[color-mix(in_srgb,var(--bad)_40%,transparent)] text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]',
  // O irmão do azul, na cor do que corre bem. Nasceu para o botão que
  // avisa a cliente: ao lado de um «Cancelar» vermelho, um contorno
  // neutro não dizia de que lado estava.
  //
  // É CHEIO, e não um contorno com letra verde. Um contorno lê-se como
  // «o outro botão», e a distância entre um verde escuro e a tinta
  // preta, num rótulo de catorze píxeis, é menor do que parece no
  // ecrã de quem o desenha. Cheio, vê-se de relance.
  //
  // NÃO É O AZUL DOS COMANDOS por escolha: o azul é «carregar aqui» e
  // já está no botão de cima. Duas cores diferentes para duas coisas
  // diferentes lêem-se sem se ler.
  ok:
    'sheen bg-[var(--ok)] text-white hover:bg-[color-mix(in_srgb,var(--ok)_84%,black)] ' +
    'hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]',
}

export function buttonClass(
  variant: Variant = 'primary',
  size: Size = 'md',
  className?: string,
) {
  return clsx(BASE, SIZES[size], VARIANTS[variant], className)
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

// ---------------------------------------------------------------------
// Superfícies
// ---------------------------------------------------------------------

export function Card({
  className,
  children,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={clsx(
        'card bg-[var(--surface-raised)] border border-[var(--line-soft)] rounded-[var(--radius)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('eyebrow', className)}>{children}</p>
}

export function Divider({ className }: { className?: string }) {
  return <div className={clsx('rule my-8', className)} />
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="text-center py-16 px-6">
      {/* Um estado vazio em texto solto lê-se como uma falha. O
          raminho diz que o ecrã está inteiro — só não tem nada dentro.
          Na montra, entenda-se: no balcão o mesmo desenho passava a
          enfeite fora de sítio, e a folha de estilo esconde-o lá. */}
      <div className="enfeite mb-5 flex justify-center text-[var(--line)]">
        <Ornament className="scale-75" />
      </div>
      <p className="display text-xl text-[var(--ink)]">{title}</p>
      {hint ? (
        <p className="mt-2 text-sm text-[var(--ink-muted)] max-w-sm mx-auto">{hint}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[0.8125rem] font-medium text-[var(--ink)]"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[0.75rem] text-[var(--bad)]">{error}</p>
      ) : hint ? (
        <p className="text-[0.75rem] text-[var(--ink-muted)]">{hint}</p>
      ) : null}
    </div>
  )
}

/*
  A LETRA DOS CAMPOS: CATORZE, EXCEPTO ONDE ABRE TECLADO.

  Era dezasseis em todos os campos no telemóvel, e por uma razão boa: o
  Safari do iPhone dá um salto de zoom mal se toca num campo com letra
  mais pequena, e deixa a página encavalitada, meia fora do ecrã, com a
  pessoa a arrastar para trás. Foi por isso que se escreveu assim.

  Mas o zoom só acontece onde APARECE TECLADO. Uma caixinha de escolha
  abre a roda do iPhone; uma caixa de data ou de hora abre o calendário
  e o relógio. Nenhuma delas escreve nada, e nenhuma delas faz o ecrã
  saltar — e são elas que enchem o balcão de letra grande: as horas da
  escala, as datas das ausências, os motivos, as lojas.

  Então a base passa a catorze, como no monitor, e os dezasseis voltam
  em `max-sm:` só a quem chama o teclado: o texto, o número, o telefone
  e o bloco de notas. Media query ganha sempre à regra de base, seja
  qual for a ordem em que o Tailwind as escreveu — é o mesmo motivo por
  que se usa `max-sm:hidden` e não `hidden sm:block` nesta casa.

  A caixa continua com 44 px de altura no telemóvel: encolhe a letra,
  não o alvo do polegar.
*/
const CONTROL =
  'w-full bg-[var(--surface-raised)] border border-[var(--line)] rounded-[var(--radius)] px-3 ' +
  'text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] ' +
  'transition-[border-color,box-shadow] duration-300 focus:outline-none focus:border-[var(--accent)] ' +
  'focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]'

/** 44px no telemóvel — a medida de um polegar; 40 no monitor. */
const CONTROL_HEIGHT = 'h-11 sm:h-10'

/** Os tipos que abrem uma roda do sistema em vez de um teclado. */
const SEM_TECLADO = new Set(['date', 'time', 'datetime-local', 'month', 'color'])

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={clsx(
        CONTROL,
        CONTROL_HEIGHT,
        SEM_TECLADO.has(props.type ?? 'text') ? null : 'max-sm:text-base',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={clsx(CONTROL, 'max-sm:text-base py-2 min-h-24', className)}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={clsx(
        CONTROL,
        CONTROL_HEIGHT,
        'select-chevron appearance-none pr-8',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

// ---------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad'

const TONES: Record<Tone, string> = {
  neutral: 'border-[var(--line)] text-[var(--ink-muted)]',
  accent: 'border-[var(--accent)] text-[var(--accent)]',
  ok: 'border-[color-mix(in_srgb,var(--ok)_45%,transparent)] text-[var(--ok)]',
  warn: 'border-[color-mix(in_srgb,var(--warn)_45%,transparent)] text-[var(--warn)]',
  bad: 'border-[color-mix(in_srgb,var(--bad)_45%,transparent)] text-[var(--bad)]',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'badge inline-flex items-center gap-1 border rounded-[var(--radius-sm)] px-1.5 py-0.5',
        'text-[0.6875rem] tracking-[0.08em] uppercase',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------
// Mensagens de resultado de uma acção
// ---------------------------------------------------------------------

export function Notice({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  const colour = {
    neutral: 'var(--ink-muted)',
    accent: 'var(--accent)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
  }[tone]

  return (
    <p
      className="text-sm px-3 py-2 rounded-[var(--radius)] border"
      style={{
        color: colour,
        borderColor: `color-mix(in srgb, ${colour} 35%, transparent)`,
        background: `color-mix(in srgb, ${colour} 8%, transparent)`,
      }}
    >
      {children}
    </p>
  )
}
