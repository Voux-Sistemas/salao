import Link from 'next/link'
import clsx from 'clsx'
import { ChevronDown, Store } from 'lucide-react'
import type { Unit } from '@/lib/org'

/**
 * Nas secções que são por loja, a loja está na barra de endereços e há
 * este seletor em cima: um comutador segmentado, com um losango dourado
 * a assinalar a casa activa. Quem só tem uma loja não vê seletor nenhum.
 *
 * DUAS FORMAS, PORQUE HÁ DOIS PESOS.
 *
 * O segmentado mostra as casas todas ao mesmo tempo e gasta um bloco
 * permanente no canto — paga-se bem onde a troca é frequente. Na agenda
 * do dia não é: escolhe-se a casa de manhã e fica-se lá, e aquele bloco
 * estava a competir em peso com o «Encaixe», que se carrega dez vezes
 * por dia. Aí entra a forma `inline`: o nome da casa com um ⌄, dentro
 * da linha que já diz quantas marcações ela tem.
 */
export function UnitSwitcher({
  units,
  current,
  base,
  allLabel = 'Todas',
  showAll = true,
  suffix = '',
  variant = 'segmented',
}: {
  units: Unit[]
  /** slug da loja escolhida, ou null quando se está em «Todas». */
  current: string | null
  /** prefixo do endereço, por exemplo `/caixa`. */
  base: string
  allLabel?: string
  showAll?: boolean
  /** o que vem a seguir à loja, por exemplo `/encaixe`. */
  suffix?: string
  /**
   * `inline` é o nome com um ⌄, para viver dentro de uma linha de texto;
   * `chip` é a pastilha, para viver numa fila de filtros.
   */
  variant?: 'segmented' | 'inline' | 'chip'
}) {
  if (units.length < 2) return null

  /*
    A PASTILHA DA CASA — a forma do telemóvel.

    Lá a linha dos números saiu, e com ela saiu o sítio onde a casa
    vivia. Passa a ser uma pastilha ao pé da das profissionais: as duas
    fazem a mesma pergunta — o que se vê — e a mesma pergunta deve ter
    a mesma forma.

    A PASTILHA DIZ O NOME DA CASA, E NÃO «LOJAS». Com a linha dos
    números fora, este é o único sítio do ecrã onde a palavra «Valongo»
    aparece — e num sistema com duas casas, saber em qual se está antes
    de fechar uma comanda não é enfeite. A palavra «lojas» fica onde
    ela é uma legenda e não uma resposta: no cimo do menu que se abre.
  */
  if (variant === 'chip') {
    const atual = units.find((unit) => unit.slug === current)
    return (
      <details key={current ?? 'todas'} className="relative">
        <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-3 text-[0.75rem] font-semibold whitespace-nowrap text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden">
          <Store
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
          />
          {atual?.name ?? allLabel}
          <ChevronDown aria-hidden className="h-3 w-3 shrink-0" />
        </summary>
        {/*
          O PAINEL ABRE PARA DENTRO, NÃO PARA FORA.

          Estava agarrado à esquerda da pastilha e crescia para a
          direita. Esta pastilha vive no canto direito da faixa — no
          telemóvel o painel saía pelo lado de fora do ecrã e tapava a
          caixa do lado. Agarrado à direita, cresce para onde há
          página. */}
        <div className="absolute top-full right-0 z-30 mt-1.5 min-w-[10rem] overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] pb-1 shadow-[var(--shadow-soft)]">
          <p className="px-3.5 pt-2 pb-1 text-[0.625rem] font-bold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
            Lojas
          </p>
          {showAll ? (
            <InlineItem href={base} active={current === null}>
              {allLabel}
            </InlineItem>
          ) : null}
          {units.map((unit) => (
            <InlineItem
              key={unit.id}
              href={`${base}/${unit.slug}${suffix}`}
              active={current === unit.slug}
            >
              {unit.name}
            </InlineItem>
          ))}
        </div>
      </details>
    )
  }

  if (variant === 'inline') {
    const atual = units.find((unit) => unit.slug === current)
    return (
      /*
        `<details>` e não um menu de cliente: isto abre uma vez por dia
        e não vale um componente com estado. A `key` fecha-o sozinho ao
        trocar de casa — sem ela o React reaproveita o mesmo elemento e
        o `open` do DOM ficava por lá depois de se escolher.
      */
      <details key={current ?? 'todas'} className="relative inline-block">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden">
          {atual?.name ?? allLabel}
          <ChevronDown aria-hidden className="h-2.5 w-2.5 shrink-0" />
        </summary>
        <div className="absolute top-full left-0 z-30 mt-1.5 min-w-[10rem] overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-soft)]">
          {showAll ? (
            <InlineItem href={base} active={current === null}>
              {allLabel}
            </InlineItem>
          ) : null}
          {units.map((unit) => (
            <InlineItem
              key={unit.id}
              href={`${base}/${unit.slug}${suffix}`}
              active={current === unit.slug}
            >
              {unit.name}
            </InlineItem>
          ))}
        </div>
      </details>
    )
  }

  return (
    <div className="inline-flex items-center gap-[3px] rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] p-[3px]">
      {showAll ? (
        <Tab href={base} active={current === null}>
          {allLabel}
        </Tab>
      ) : null}
      {units.map((unit) => (
        <Tab
          key={unit.id}
          href={`${base}/${unit.slug}${suffix}`}
          active={current === unit.slug}
        >
          {unit.name}
        </Tab>
      ))}
    </div>
  )
}

function InlineItem({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'block px-3.5 py-2 text-[0.8125rem] whitespace-nowrap transition-colors',
        active
          ? 'font-semibold text-[var(--ink)]'
          : 'text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
      )}
    >
      {children}
    </Link>
  )
}

function Tab({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'inline-flex items-center rounded-[1px] px-3 py-1.5 text-[0.8125rem] transition-colors',
        active
          ? 'bg-[var(--surface-raised)] text-[var(--ink)] shadow-[0_1px_3px_rgba(28,25,23,0.1)]'
          : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="mr-1.5 inline-block h-1 w-1 rotate-45 bg-[var(--gold)]"
        />
      ) : null}
      {children}
    </Link>
  )
}
