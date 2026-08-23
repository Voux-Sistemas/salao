import clsx from 'clsx'
import { Monogram, Sprig } from '@/components/brand'

/**
 * AS FOTOGRAFIAS DA CASA.
 *
 * Há nove: seis de Valongo, três da Maia. São o que distingue este site
 * de um catálogo — e por isso passam pelo mesmo sítio, para terem todas
 * o mesmo recorte, o mesmo carregamento preguiçoso e o mesmo fundo por
 * baixo enquanto não chegam.
 *
 * O `<img>` é de propósito. O `next/image` corta e serve tamanhos, mas
 * exige um servidor de imagens que o Netlify factura à parte; nove
 * ficheiros de 1,6 MB no total servem-se estáticos e chegam antes.
 */

export function Photo({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string
  alt: string
  className?: string
  /** Só para a fotografia que abre a página — as outras entram tarde. */
  eager?: boolean
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      // `fetchPriority` diz ao navegador o que descarregar primeiro: a
      // fotografia do herói vale mais do que as seis que estão em baixo.
      fetchPriority={eager ? 'high' : 'auto'}
      className={clsx('h-full w-full object-cover', className)}
    />
  )
}

/**
 * O QUE FICA NO LUGAR DE UMA FOTOGRAFIA QUE NÃO EXISTE.
 *
 * Um quadrado cinzento diz "faltou aqui alguma coisa". Isto diz "é
 * assim mesmo": iniciais sobre um fundo em papel, com um raminho por
 * baixo. O tom varia com a semente — três serviços seguidos sem foto
 * não ficam três rectângulos iguais — mas varia sempre da mesma
 * maneira para o mesmo nome, senão mudava a cada recarregamento.
 *
 * As iniciais são o `label`, quando há. Numa loja não se passa nada e
 * sai o monograma da casa, que é quem ela é. Numa lista de sessenta e
 * sete serviços o monograma da casa repetido sessenta e sete vezes era
 * papel de parede: aí passa-se o nome do serviço e cada linha fica com
 * as suas duas letras.
 */
export function PhotoFallback({
  seed = '',
  label,
  className,
  compact = false,
}: {
  seed?: string
  /** Nome de onde saem as iniciais. Sem ele, o monograma da casa. */
  label?: string
  className?: string
  /** Num quadrado de 48px o raminho vira borrão: fica só o monograma. */
  compact?: boolean
}) {
  const tone = TONES[hash(seed || label || '') % TONES.length]!
  const initials = label ? initialsOf(label) : undefined

  // A cor vive no contentor e desce por herança: o monograma não tem cor
  // própria e o raminho é todo desenhado a `currentColor`.
  return (
    <div
      aria-hidden
      className={clsx(
        'flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden',
        className,
      )}
      style={{ background: tone.background, color: tone.ink }}
    >
      <Monogram
        initials={initials}
        className={compact ? 'text-[1.0625rem]' : 'text-[1.75rem]'}
      />
      {compact ? null : <Sprig size={30} className="opacity-55" />}
    </div>
  )
}

/**
 * AS DUAS LETRAS DE UM NOME DE SERVIÇO.
 *
 * "Manicure normal" dá MN, "Corte senhora (s/ brushing)" dá CS. Fora
 * ficam os separadores que os preçários usam — hífen, ponto, barra,
 * mais — e as palavrinhas de ligação, que não distinguem nada: com
 * elas, "Pedicure completa + verniz" e "Pedicure completa" saíam as
 * duas PC. Um nome de uma palavra fica com uma letra, e está bem.
 */
function initialsOf(name: string): string {
  const menores = new Set(['de', 'da', 'do', 'e', 'com', 'sem', 'a', 'o', 'em'])
  const palavras = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 1 && !menores.has(w.toLowerCase()))
  const escolhidas = palavras.length > 0 ? palavras : [name.trim()]
  return escolhidas
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Soma simples das letras. Não precisa de ser boa a espalhar — precisa
 * de dar sempre o mesmo número para o mesmo nome, no servidor e no
 * navegador, senão o React reclama que a página mudou sozinha.
 */
function hash(text: string): number {
  let total = 0
  for (let i = 0; i < text.length; i++) total = (total + text.charCodeAt(i) * (i + 1)) % 9973
  return total
}

/** Quatro papéis da mesma família. Nenhum grita. */
const TONES = [
  {
    background:
      'linear-gradient(150deg, color-mix(in srgb, var(--gold) 12%, var(--surface)), var(--surface-raised))',
    ink: 'color-mix(in srgb, var(--gold) 62%, var(--ink-faint))',
  },
  {
    background:
      'linear-gradient(150deg, var(--surface-raised), color-mix(in srgb, var(--ink) 7%, var(--surface)))',
    ink: 'var(--ink-faint)',
  },
  {
    background:
      'linear-gradient(210deg, color-mix(in srgb, var(--gold) 8%, var(--surface-raised)), var(--surface))',
    ink: 'color-mix(in srgb, var(--gold) 48%, var(--ink-faint))',
  },
  {
    background:
      'linear-gradient(120deg, var(--surface), color-mix(in srgb, var(--gold) 15%, var(--surface-raised)))',
    ink: 'color-mix(in srgb, var(--gold) 55%, var(--ink-muted))',
  },
]
