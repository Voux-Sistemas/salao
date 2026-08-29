'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import {
  IconAgenda,
  IconBell,
  IconCash,
  IconClients,
  IconDay,
  IconManage,
} from '@/components/desk-icons'

const ICONS = {
  hoje: IconDay,
  agenda: IconAgenda,
  avisos: IconBell,
  caixa: IconCash,
  clientes: IconClients,
  gestao: IconManage,
} as const

export type NavIconName = keyof typeof ICONS

export type NavItem = {
  href: string
  label: string
  /** Glifo para as barras com ícone (rail e bottom). */
  icon?: NavIconName
  /** Rótulo curto para caber debaixo do ícone. */
  short?: string
  /**
   * Quantos estão à espera. Só a barra dos Avisos o usa, e só aparece
   * quando é mais do que zero: um zero num selo é ruído com forma de
   * aviso.
   */
  badge?: number
}

/**
 * O SELO DO QUE ESTÁ À ESPERA.
 *
 * Vermelho e pequeno, encostado ao canto do glifo. A partir de dez
 * escreve-se «9+»: o número exacto de uma fila grande não muda nada —
 * quem tem doze avisos e quem tem trinta faz a mesma coisa a seguir.
 */
function Selo({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="tabular absolute -top-0.5 right-2 flex h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-full bg-[var(--bad)] px-1 text-[0.625rem] font-extrabold text-white"
    >
      {n > 9 ? '9+' : n}
    </span>
  )
}

/**
 * A navegação da operação, em três encarnações:
 *
 *   bar     controlo segmentado (sub-navegação, ex.: Gestão)
 *   rail    a coluna estreita do balcão, ícone em cima do rótulo
 *   bottom  a barra fixa do fundo, no telemóvel
 *
 * ONDE SE ESTÁ MARCA-SE COM FORMA, NÃO SÓ COM COR. Antes era um fio de
 * dois píxeis ao lado do ícone e a palavra em versaletes espaçados —
 * lia-se como um índice de livro, e num ecrã a que se volta cinquenta
 * vezes por dia o sítio onde se está tem de saltar à vista sem procura.
 * Agora o item aceso é um bloco com fundo próprio: reconhece-se pela
 * mancha, antes de se ler seja o que for.
 *
 * NA BARRA DO TELEMÓVEL essa mancha é ouro cheio, e as portas fechadas
 * estão no cinzento de leitura, não no de legenda. A coluna do monitor
 * fica no azul: lá não há cinco azuis a competir com ela, e o item
 * aceso já tinha fundo próprio.
 *
 * A comparação é pelo primeiro segmento: `/agenda/chiado/...` continua
 * a ser Agenda.
 */
export function DeskNav({
  items,
  variant = 'bar',
}: {
  items: NavItem[]
  variant?: 'bar' | 'rail' | 'bottom'
}) {
  const pathname = usePathname()

  /*
    O SEPARADOR ABERTO TEM DE ESTAR À VISTA.

    No telemóvel os cinco separadores não cabem nos 390 píxeis e a caixa
    rola de lado. Entrando pela Equipa, o separador aceso ficava cortado
    na margem direita: a página dizia «Gestão» e o controlo mostrava
    quatro portas fechadas, nenhuma aberta. Ao chegar, empurra-se a
    caixa até ele caber. `nearest` para não mexer quando já se vê, e
    `block: 'nearest'` para não arrastar a página inteira junto.
  */
  const aceso = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    aceso.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [pathname])

  /*
    O SEPARADOR RAIZ NÃO ACENDE NOS FILHOS DELE.

    A regra normal é por prefixo: `/agenda/valongo/comanda/7` continua a
    ser a Agenda. Num controlo segmentado isso avaria assim que um dos
    separadores é a raiz dos outros — em `/admin/equipe` acendiam dois
    ao mesmo tempo, «Painel» e «Equipa», e um controlo com duas escolhas
    feitas não diz onde se está: desmente-se a si próprio.

    Quem tem outro separador pendurado por baixo passa a exigir o
    endereço exacto. Não é uma excepção escrita à mão para o /admin:
    sai da própria lista, e vale para qualquer conjunto que um dia se
    arrume da mesma maneira.
  */
  const rootHrefs = new Set(
    items
      .filter((item) => items.some((other) => other.href.startsWith(`${item.href}/`)))
      .map((item) => item.href),
  )
  const lit = (href: string) =>
    rootHrefs.has(href) ? pathname === href : isActive(pathname, href)

  if (variant === 'rail') {
    return (
      <nav className="flex w-full flex-col gap-0.5 px-2">
        {items.map((item) => {
          const active = lit(item.href)
          const Icon = item.icon ? ICONS[item.icon] : IconDay
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative flex w-full flex-col items-center gap-1 rounded-[var(--radius-sm)] py-2.5 transition-colors',
                active
                  ? 'bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-[var(--accent)]'
                  : 'text-[var(--ink-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
              )}
            >
              {item.badge ? <Selo n={item.badge} /> : null}
              <Icon className="h-[1.3rem] w-[1.3rem]" />
              <span className="max-w-full truncate px-0.5 text-[0.625rem] font-semibold">
                {item.short ?? item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    )
  }

  if (variant === 'bottom') {
    return (
      // A folga do indicador do iPhone vai por fora da fila de ícones: a
      // barra cresce por baixo, em vez de espremer os rótulos.
      <nav style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/*
          COM POUCAS PORTAS, ELAS JUNTAM-SE AO CENTRO.

          A barra dividia-se sempre em partes iguais, o que é o certo com
          cinco. A profissional tem duas: cada ícone levava metade do
          ecrã e ficava a boiar no meio de cento e noventa píxeis de
          nada — a barra parecia ter perdido alguma coisa pelo caminho.

          A partir de três volta a dividir-se por igual, como sempre: aí
          são as portas que preenchem a barra, e não o vazio.
        */}
        <div
          className={clsx(
            'flex min-h-[4.25rem] items-stretch px-1',
            items.length > 2
              ? 'justify-around'
              : 'justify-center gap-2 [&>a]:w-32 [&>a]:flex-none',
          )}
        >
          {items.map((item) => {
            const active = lit(item.href)
            const Icon = item.icon ? ICONS[item.icon] : IconDay
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2.5 transition-colors',
                  active
                    ? 'text-[var(--house-deep)]'
                    : 'text-[var(--ink-muted)]',
                )}
              >
                {item.badge ? <Selo n={item.badge} /> : null}
                {/*
                  A PASTILHA É OURO CHEIO, NÃO É UM TOM POR CIMA DO FUNDO.

                  Era uma água de azul a treze por cento: em traço fino,
                  num ecrã que já tem cinco azuis — o botão do encaixe, o
                  dia aceso, a linha do agora, os traços das marcações,
                  as horas —, a barra ficava a ser o sexto, e o mais
                  fraco dos seis. Não se apagava por ser clara; apagava-se
                  por ser mais um.

                  O que salta à vista é a MANCHA, não o tom: uma pastilha
                  cheia com o glifo em branco vê-se do outro lado do
                  salão. E vai no ouro do logótipo, que neste ecrã só
                  aparece no monograma e em pontos de cinco píxeis — é a
                  única mancha quente da página, e por isso não compete
                  com nenhum azul: não é mais um, é outra coisa.

                  O azul fica onde tem trabalho — «carregar aqui». Onde
                  se está não é uma acção, é um estado.

                  Ocupa altura fixa esteja acesa ou não, para os rótulos
                  de todas as portas ficarem na mesma linha.
                */}
                <span
                  className={clsx(
                    'flex h-7 w-14 items-center justify-center rounded-full transition-colors',
                    active
                      ? 'bg-[var(--house)] text-white shadow-[0_4px_10px_-4px_color-mix(in_srgb,var(--house)_70%,transparent)]'
                      : 'bg-transparent',
                  )}
                >
                  <Icon className="h-[1.3rem] w-[1.3rem]" />
                </span>
                <span
                  className={clsx(
                    'max-w-full truncate px-1 text-[0.625rem]',
                    active ? 'font-bold' : 'font-semibold',
                  )}
                >
                  {item.short ?? item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  /*
   * O controlo segmentado. Os separadores vivem dentro de uma caixa
   * afundada e o que está aberto sobe ao branco — é o gesto que toda a
   * gente já conhece dos telemóveis, e diz «uma destas» sem precisar de
   * legenda. `w-max` porque a caixa tem de ser do tamanho dos
   * separadores, não da largura toda: esticada, o fundo afundado
   * atravessava a página como uma tarja.
   */
  return (
    <div className="-mx-1 overflow-x-auto px-1 py-0.5">
      <nav className="flex w-max items-center gap-1 rounded-[var(--radius)] bg-[var(--surface-2)] p-1">
        {items.map((item) => {
          const active = lit(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={active ? aceso : undefined}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-[0.8125rem] font-medium transition-all',
                active
                  ? 'bg-[var(--surface-raised)] text-[var(--ink)] shadow-[0_1px_2px_rgba(15,21,32,0.10)]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
