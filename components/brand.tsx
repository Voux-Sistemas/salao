import clsx from 'clsx'
import { Check } from 'lucide-react'
import { BRAND } from '@/lib/branding'

/**
 * A MARCA COMO SISTEMA GRÁFICO.
 *
 * O logótipo de origem (logo.jpg, na raiz) é tinta preta sobre papel
 * branco. O papel é recortado uma vez, fora do browser, por
 * `scripts/logo-assets.mjs` — daí saem os dois PNG com transparência que
 * se usam aqui. Sobre fundo escuro a classe `.logo-ink` limita-se a
 * inverter a cor da tinta. O resto — monograma, raminho, divisor — é
 * desenhado à mão em SVG para escalar sem perder o fio.
 */

const LOGO_SIZE: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-28 w-28',
  xl: 'h-44 w-44 sm:h-56 sm:w-56',
}

export function LogoMark({
  size = 'md',
  className,
}: {
  size?: keyof typeof LOGO_SIZE
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={BRAND.legalName}
      draggable={false}
      className={clsx('logo-ink object-contain', LOGO_SIZE[size], className)}
    />
  )
}

/**
 * O SELO: só a grinalda com o monograma, sem o nome por baixo.
 *
 * O lockup completo traz «NOHORA RAMIREZ» e «BEAUTY STUDIO» por baixo da
 * grinalda. Abaixo de uns 120px essas duas linhas deixam de se ler e
 * viram borrão; e sempre que o nome já está escrito ao lado — no
 * cabeçalho, no rodapé — o lockup di-lo duas vezes. Por isso a grinalda
 * tem ficheiro próprio, já quadrado (ver `scripts/logo-assets.mjs`).
 */
const SEAL_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
}

export function LogoSeal({
  size = 'md',
  className,
}: {
  size?: keyof typeof SEAL_SIZE
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-seal.png"
      alt=""
      aria-label={BRAND.legalName}
      role="img"
      draggable={false}
      className={clsx(
        'logo-ink block shrink-0 object-contain',
        SEAL_SIZE[size],
        className,
      )}
    />
  )
}

/**
 * O CARIMBO — o selo da casa a assentar, para o fim do funil.
 *
 * A cliente acabou de dar o nome e o telefone a uma casa onde talvez
 * nunca tenha entrado. O que aparece a seguir é a primeira coisa que a
 * casa lhe diz de volta, e por isso não é um visto de biblioteca de
 * ícones: é a grinalda dela a fechar-se, com o visto a assinar no fim.
 *
 * Quatro tempos encadeados, escritos em `.stamp*` no globals.css. Aqui
 * fica só a estrutura — o anel por baixo, o selo ao meio, o brilho e o
 * visto por cima.
 */
export function LogoStamp({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={BRAND.legalName}
      className={clsx('stamp', className)}
    >
      <span aria-hidden className="stamp-glow" />

      <svg aria-hidden viewBox="0 0 100 100" className="stamp-ring">
        <circle cx="50" cy="50" r="48" />
      </svg>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-seal.png"
        alt=""
        aria-hidden
        draggable={false}
        className="logo-ink stamp-seal object-contain"
      />

      <span aria-hidden className="stamp-sheen" />

      <span aria-hidden className="stamp-check">
        <Check size={17} strokeWidth={2.25} />
      </span>
    </span>
  )
}

/**
 * Raminho de folhas — o eco da grinalda do logótipo, em traço de 1px.
 * Aponta para a direita; espelha-se com scale-x-[-1].
 */
export function Sprig({
  className,
  size = 44,
}: {
  className?: string
  size?: number
}) {
  const height = Math.round(size * 0.45)
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 44 20"
      fill="none"
      aria-hidden
      className={clsx('shrink-0', className)}
    >
      {/* caule */}
      <path
        d="M1 14 C 12 13, 30 12, 43 5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* folhas por cima do caule */}
      <path d="M9 13.2 C 8 9.5, 10 7.2, 12.5 6.4 C 12.9 9.8, 11.6 12.2, 9 13.2 Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M18 11.9 C 17 8.2, 19 5.9, 21.5 5.1 C 21.9 8.5, 20.6 10.9, 18 11.9 Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M27 10.2 C 26 6.5, 28 4.2, 30.5 3.4 C 30.9 6.8, 29.6 9.2, 27 10.2 Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      {/* folhas por baixo do caule */}
      <path d="M13.5 13.6 C 15.5 16.8, 18.5 17.4, 21 16.3 C 19.3 13.4, 16.3 12.6, 13.5 13.6 Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M23 11.9 C 25 15.1, 28 15.7, 30.5 14.6 C 28.8 11.7, 25.8 10.9, 23 11.9 Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M32 9.6 C 34 12.8, 37 13.4, 39.5 12.3 C 37.8 9.4, 34.8 8.6, 32 9.6 Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Divisor da casa: dois raminhos a apontar para um losango central.
 * `<Ornament />` sozinho centra-se no contentor.
 */
export function Ornament({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex items-center justify-center gap-3 text-[var(--accent)]',
        className,
      )}
    >
      <Sprig className="scale-x-[-1]" />
      {/* Cheio, não em contorno: a 6px um losango vazado é um buraco no
          meio da linha — os dois raminhos apontam para nada. O `top`
          põe-no na linha do caule: as pontas que lhe apontam morrem a
          14/20 da caixa do raminho, não a meio dela. */}
      <span className="relative top-[4px] block h-1.5 w-1.5 rotate-45 bg-current" />
      <Sprig />
    </span>
  )
}

/**
 * Linha inteira com o ornamento ao centro — para separar secções.
 */
export function LeafRule({ className }: { className?: string }) {
  return (
    <div className={clsx('rule-leaf', className)} aria-hidden>
      <Ornament />
    </div>
  )
}

/**
 * Monograma tipográfico para avatares e estados vazios: as iniciais em
 * didone, ligeiramente sobrepostas como no logótipo.
 */
export function Monogram({
  initials = BRAND.monogram,
  className,
}: {
  initials?: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        'display inline-flex items-baseline leading-none tracking-[-0.08em]',
        className,
      )}
    >
      {initials}
    </span>
  )
}
