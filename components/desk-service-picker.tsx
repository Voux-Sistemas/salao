'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import clsx from 'clsx'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { Badge, Input } from '@/components/ui'
import { searchKey } from '@/lib/text'

/**
 * O CATÁLOGO DO BALCÃO, COM UMA PENEIRA.
 *
 * São umas dezenas de serviços em sete categorias. Quem marca uma
 * visita de cada vez desce a lista e encontra; quem está a passar o
 * livro de papel todo para o sistema faz isto centenas de vezes num
 * dia, e cada descida da lista é um punhado de segundos que se
 * multiplica.
 *
 * Por isso a peneira é aqui, no navegador, e não uma pergunta à base de
 * dados: entre esta página e a base há um oceano, e uma resposta que
 * demora um décimo de segundo por cada letra escrita não é uma peneira,
 * é uma espera. As linhas já vêm todas — umas dezenas cabem numa
 * página sem se dar por elas.
 *
 * Não esconde nada para sempre: apagar o que se escreveu devolve a
 * lista inteira, e o botão de juntar continua a ser uma LIGAÇÃO — o
 * endereço vem já feito do servidor, com o carrinho lá dentro, e o
 * retrocesso do navegador continua a funcionar como no resto da casa.
 *
 * O texto procura-se sem acentos e sem maiúsculas, porque ninguém
 * escreve «Coloração» com o cedilha certo quando tem o telefone na
 * outra mão. A categoria também conta: escrever «barbearia» traz a
 * categoria inteira.
 */

export type PickerService = {
  id: string
  name: string
  /** "45 min", já composto do lado do servidor. */
  duration: string
  /** "25,00 €", idem. Separado do tempo para o preço poder alinhar-se
      à direita com os outros, em algarismos de largura fixa. */
  price: string
  onlyDesk: boolean
  /**
   * O que a linha faz ao ser tocada: juntar à visita, ou — se já lá
   * estiver — tirá-la de lá. Nulo só quando a visita está cheia e este
   * serviço não é nenhum dos que lá estão.
   */
  href: string | null
  state: 'free' | 'chosen' | 'full'
}

export type PickerCategory = { id: string; name: string; services: PickerService[] }

/** Quantas categorias ficam à vista antes do menu. */
const ATALHOS = 4

export function DeskServicePicker({
  categories,
  total,
  destaque = [],
  ordem = [],
}: {
  categories: PickerCategory[]
  total: number
  /** Os serviços que esta casa mais marcou nos últimos noventa dias. */
  destaque?: PickerService[]
  /** Ids das categorias, das que mais pesam para as que menos. */
  ordem?: string[]
}) {
  const router = useRouter()
  const [term, setTerm] = useState('')
  /*
    A OUTRA PENEIRA: A CATEGORIA, A UM TOQUE.

    Escrever é óptimo com um teclado à frente; ao balcão, com o telefone
    numa mão, um toque em «Cabeleireiro» vale por sete letras. As
    pastilhas compõem-se com o texto — pode tocar-se na categoria e
    escrever dentro dela. Vive em memória do componente, não no
    endereço: é um jeito de olhar para a lista, não uma escolha da
    visita.
  */
  const [catId, setCatId] = useState<string | null>(null)
  const box = useRef<HTMLInputElement>(null)

  /*
    QUATRO ATALHOS, E O RESTO NUM MENU.

    A fita de pastilhas tinha um limite que não se via enquanto a casa
    era pequena: ela CRESCE PARA BAIXO. Com as sete categorias desta
    loja é uma linha; numa casa de cinquenta são cinco ou seis filas de
    pastilhas antes do primeiro serviço — o muro que a peneira existe
    para evitar, de volta e por outro caminho.

    Ficam à vista as quatro que esta casa mais marca, que são as que se
    tocam todos os dias, e as outras num menu que não cresce com elas.
    A ordem vem do servidor, contada da agenda; sem história nenhuma
    vem a ordem que a dona deu na Gestão.
  */
  const ordenadas = useMemo(() => {
    if (ordem.length === 0) return categories
    const posicao = new Map(ordem.map((id, i) => [id, i]))
    return [...categories].sort(
      (a, b) =>
        (posicao.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (posicao.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }, [categories, ordem])

  const atalhos = ordenadas.slice(0, ATALHOS)
  const noMenu = ordenadas.slice(ATALHOS)
  /*
    NO TELEMÓVEL NÃO HÁ ATALHOS — HÁ UMA LINHA SÓ.

    Os quatro atalhos foram desenhados para o monitor, onde a fita tem
    setecentos píxeis. Em trezentos e noventa, «Os que mais marca» mais
    «Todas» mais quatro nomes mais o menu davam TRÊS FILAS de pastilhas
    antes do primeiro serviço — o muro que a peneira existe para evitar.

    Lá ficam três: os mais marcados, todas, e o menu com as categorias
    todas lá dentro. Nada se perde: o menu já as tinha todas.

    É `max-sm:hidden`, e não `hidden sm:inline-flex`: nesta versão do
    Tailwind o `.inline-flex` é escrito DEPOIS do `.hidden` na folha de
    estilo, e por isso um `hidden` posto ao lado do `inline-flex` da
    pastilha não esconde coisa nenhuma. Quem manda é a ordem no
    ficheiro, não a ordem no atributo — e as regras dentro de um
    `@media` vêm sempre depois de todas as outras.
  */
  const atalhoEscolhido = atalhos.find((c) => c.id === catId) ?? null
  /** A escolhida entrou no menu? Então sobe, para se ver onde se está. */
  const escolhidaNoMenu = noMenu.find((c) => c.id === catId) ?? null

  /*
    «Os que mais marca» é uma vista, não uma categoria: não filtra por
    nada, mostra uma lista curta. Só existe quando há história, e sai do
    caminho assim que se escreve ou se escolhe uma categoria.
  */
  const [soDestaque, setSoDestaque] = useState(destaque.length > 0)

  const chave = searchKey(term.trim())
  const emDestaque = soDestaque && !chave && catId === null

  const visible = useMemo(() => {
    const pool =
      catId === null
        ? categories
        : categories.filter((category) => category.id === catId)
    if (!chave) return pool
    return pool
      .map((category) => {
        // Uma categoria que dá o nome fica inteira: quem escreve
        // «barbearia» quer ver a barbearia toda, não um corte dela.
        if (searchKey(category.name).includes(chave)) return category
        const services = category.services.filter((service) =>
          searchKey(service.name).includes(chave),
        )
        return services.length > 0 ? { ...category, services } : null
      })
      .filter((category): category is PickerCategory => category !== null)
  }, [categories, catId, chave])

  /*
    A vista dos mais marcados é uma secção como as outras — a mesma
    lista, o mesmo cartão, o mesmo botão de juntar. Só o conteúdo é que
    vem de outro sítio, e por isso não precisa de desenho próprio.
  */
  const seccoes = emDestaque
    ? [{ id: '__destaque', name: 'Os que mais marca', services: destaque }]
    : visible

  /*
    O TÍTULO DA SECÇÃO SAI QUANDO A PASTILHA JÁ O DIZ.

    «OS QUE MAIS MARCA ——— 10» a dois dedos de uma pastilha azul que diz
    «Os que mais marca» é a mesma frase duas vezes, e custa quarenta
    píxeis no telemóvel. O mesmo vale para uma categoria escolhida: a
    pastilha acesa tem o nome dela.

    Quando a lista tem várias secções — a vista de todas, ou uma procura
    que apanha três categorias — os títulos ficam: aí são eles que a
    separam, e nenhuma pastilha os diz.
  */
  const nomeJaDito = emDestaque || catId !== null

  const shown = seccoes.reduce((sum, c) => sum + c.services.length, 0)

  // Com um só à vista, o Enter junta-o. É o atalho de quem já sabe o
  // nome do serviço e escreve três letras para lá chegar.
  const only = shown === 1 ? seccoes[0]?.services[0] : undefined

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Input
            ref={box}
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setTerm('')
                return
              }
              if (event.key === 'Enter' && only?.href) {
                event.preventDefault()
                setTerm('')
                router.push(only.href, { scroll: false })
              }
            }}
            placeholder="Procurar serviço"
            aria-label="Procurar serviço"
            autoComplete="off"
            className="pr-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {term ? (
            <button
              type="button"
              aria-label="Limpar a procura"
              onClick={() => {
                setTerm('')
                box.current?.focus()
              }}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--accent)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <p className="tabular shrink-0 text-[0.75rem] text-[var(--ink-faint)]">
          {chave || catId || emDestaque ? `${shown} de ${total}` : `${total} serviços`}
        </p>
      </div>

      {categories.length > 1 ? (
        <div className="-mx-1 mb-4 flex flex-wrap items-center gap-1.5 px-1">
          {destaque.length > 0 ? (
            <CategoryChip
              active={emDestaque}
              onClick={() => {
                setSoDestaque(true)
                setCatId(null)
                setTerm('')
              }}
            >
              Os que mais marca
            </CategoryChip>
          ) : null}
          <CategoryChip
            active={catId === null && !emDestaque}
            onClick={() => {
              setSoDestaque(false)
              setCatId(null)
            }}
          >
            Todas
          </CategoryChip>
          {atalhos.map((category) => (
            <CategoryChip
              key={category.id}
              className="max-sm:hidden"
              active={catId === category.id}
              onClick={() => {
                setSoDestaque(false)
                setCatId(catId === category.id ? null : category.id)
              }}
            >
              {category.name}
            </CategoryChip>
          ))}

          {/* Com os atalhos escondidos, a escolhida ficaria sem sítio
              nenhum no telemóvel: quem filtrou por «Cabelo» tem de ver
              que filtrou. Volta, sozinha, no lugar dos quatro. */}
          {atalhoEscolhido ? (
            <CategoryChip
              active
              className="sm:hidden"
              onClick={() => setCatId(null)}
            >
              {atalhoEscolhido.name}
            </CategoryChip>
          ) : null}

          {/* A categoria escolhida sobe do menu para a fita: sem isso,
              quem filtra por «Podologia» fica sem ver onde está. */}
          {escolhidaNoMenu ? (
            <CategoryChip active onClick={() => setCatId(null)}>
              {escolhidaNoMenu.name}
            </CategoryChip>
          ) : null}

          {/* No monitor o menu só aparece quando sobram categorias; no
              telemóvel é a única porta para elas, e aparece sempre. */}
          {categories.length > 0 ? (
            <details
              key={catId ?? 'todas'}
              className={clsx('relative', noMenu.length === 0 && 'sm:hidden')}
            >
              <summary
                className={clsx(
                  'inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border border-dashed px-3 text-[0.75rem] font-semibold whitespace-nowrap transition-colors [&::-webkit-details-marker]:hidden',
                  'border-[var(--line)] text-[var(--ink-muted)] hover:text-[var(--ink)]',
                )}
              >
                <span className="sm:hidden">Categorias</span>
                <span className="hidden sm:inline">Todas as categorias</span>
                <ChevronDown aria-hidden className="h-3 w-3 shrink-0" />
              </summary>
              <div className="absolute top-full left-0 z-30 mt-1.5 max-h-72 min-w-[12rem] overflow-y-auto rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-soft)]">
                {ordenadas.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setSoDestaque(false)
                      setCatId(category.id)
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between gap-4 px-3.5 py-2 text-left text-[0.8125rem] whitespace-nowrap transition-colors',
                      category.id === catId
                        ? 'font-semibold text-[var(--ink)]'
                        : 'text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
                    )}
                  >
                    {category.name}
                    <span className="tabular text-[0.6875rem] text-[var(--ink-faint)]">
                      {category.services.length}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {seccoes.length === 0 ? (
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">
          Nenhum serviço com isso. Apague para ver a lista toda.
        </p>
      ) : (
        <div className="space-y-8">
          {seccoes.map((category) => (
            <div key={category.id}>
              {/*
                O NOME DA CATEGORIA É ARRUMAÇÃO, NÃO É UM DADO.

                Vai no ouro da casa, em versaletes, como os títulos de
                secção da gestão — e o fio que o acompanha desvanece-se
                do ouro para nada. É a mesma peça em toda a área de
                trabalho, e é o que faz esta lista de sessenta e sete
                serviços parecer o catálogo desta casa e não a tabela de
                qualquer sistema.
              */}
              <div
                className={clsx(
                  'flex items-center gap-3',
                  nomeJaDito && 'hidden',
                )}
              >
                <h3 className="titulo-seccao shrink-0">{category.name}</h3>
                <span
                  aria-hidden
                  className="h-px flex-1 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--house)_38%,transparent),color-mix(in_srgb,var(--line)_100%,transparent))]"
                />
                <span className="tabular shrink-0 text-[0.6875rem] text-[var(--ink-faint)]">
                  {category.services.length}
                </span>
              </div>
              {/*
                O `grid-cols-1` NÃO É DECORAÇÃO — É O QUE IMPEDE A
                PÁGINA DE ANDAR PARA O LADO NO TELEMÓVEL.

                Sem ele a única coluna é `auto`, e uma coluna `auto`
                mede-se pelo conteúdo mínimo das linhas. O nome do
                serviço leva `truncate`, que é `nowrap`, e o mínimo de
                uma linha que não quebra é a linha inteira: o catálogo
                passava a ser medido por «Madeixas + Brushing · cabelo
                comprido» e empurrava o corpo da página para 484px num
                ecrã de 390. O `grid-cols-1` do Tailwind é
                `minmax(0,1fr)` — o chão desce a zero e o corte volta a
                ser trabalho do `truncate`, que é quem o deve fazer.
              */}
              {/*
                NO TELEMÓVEL ISTO É UMA LISTA, NÃO SÃO SESSENTA E OITO
                CARTÕES.

                Numa coluna só, cada serviço tinha a sua moldura, o seu
                canto redondo e oito píxeis de ar em volta: sessenta e
                oito rectângulos brancos em fila, todos iguais — o
                desenho de um cartão aplicado a uma coisa que é uma
                lista. Passa a haver um painel por secção e um fio entre
                linhas, como na agenda do dia.

                A conta: a linha era sessenta e oito píxeis com o
                intervalo, passa a cinquenta e cinco com o fio. Num
                telemóvel de 375 são cerca de seis serviços à vista em
                vez de quatro e meio.

                A DURAÇÃO FICA POR BAIXO DO NOME. Subi-la para a linha
                do preço poupava outro tanto, mas obrigava o nome a
                cortar com reticências — e num catálogo que há-de
                crescer, um nome cortado a meio custa mais do que dois
                serviços a mais no ecrã.

                No monitor não muda nada: a partir de `sm` são duas
                colunas, e uma grelha de duas colunas com fios entre
                linhas não é uma lista, é uma tabela. Lá ficam os
                cartões, com o ar que a coluna tem para dar.
              */}
              <ul
                className={clsx(
                  'grid grid-cols-1 sm:grid-cols-2 sm:gap-2',
                  'max-sm:overflow-hidden max-sm:rounded-[var(--radius)] max-sm:border max-sm:border-[var(--line-soft)] max-sm:bg-[var(--surface-raised)]',
                  nomeJaDito ? null : 'mt-3',
                )}
              >
                {category.services.map((service) => (
                  <li
                    key={service.id}
                    className="max-sm:border-t max-sm:border-[var(--line-soft)] max-sm:first:border-t-0"
                  >
                    <ServiceRow service={service} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Uma pastilha de categoria: botão, não ligação — não muda o endereço. */
function CategoryChip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[0.75rem] transition-colors',
        active
          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
          : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * UMA LINHA DO CATÁLOGO — E A LINHA INTEIRA É O BOTÃO.
 *
 * Era um rectângulo com um quadrado de mais-mais no canto: sessenta e
 * sete deles em fila, todos iguais, com um alvo de trinta e dois píxeis
 * para acertar de cada vez. Quem está a passar o livro de papel faz isto
 * centenas de vezes num dia — o alvo passa a ser a linha toda, e o
 * mais-mais fica a dizer o que acontece se lá se tocar, em vez de ser o
 * único sítio onde se pode tocar.
 *
 * O canto redondo e a sombra que aparece ao passar por cima são o resto
 * da queixa: sem eles isto é uma grelha de caixas, não é um catálogo.
 *
 * NO TELEMÓVEL A MOLDURA SAI. Lá as linhas vivem dentro de um painel,
 * separadas por um fio, e uma moldura dentro de outra moldura é ruído —
 * a mesma razão por que uma linha da agenda do dia também não tem
 * caixa. O que fica é a cor de fundo, que é a única coisa que ali
 * distingue um serviço já escolhido dos outros.
 */
function ServiceRow({ service }: { service: PickerService }) {
  const nome = (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm text-[var(--ink)]">
        {service.name}
        {service.onlyDesk ? (
          <span className="ml-2 align-middle">
            <Badge>Só ao balcão</Badge>
          </span>
        ) : null}
      </span>
      <span className="tabular mt-0.5 block text-[0.75rem] text-[var(--ink-faint)]">
        {service.duration}
      </span>
    </span>
  )

  const preco = (
    <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink-muted)]">
      {service.price}
    </span>
  )

  const moldura =
    'flex w-full items-center gap-3 rounded-[var(--radius)] border px-3.5 py-2.5 text-left max-sm:rounded-none max-sm:border-0 max-sm:py-2'

  /*
    JÁ ESTÁ NA VISITA — E TOCAR OUTRA VEZ TIRA-O DE LÁ.

    Era um pedaço de texto com uma marca de visto, e o desfazer estava
    no passo seguinte, no xis do cartão da visita. Quem se engana na
    linha de baixo procura o desfazer onde acabou de tocar, e não noutro
    ecrã — ainda por cima quando a linha ao lado continua a responder ao
    toque.

    A marca de visto vira um xis ao passar por cima, no vermelho de
    desfazer: é o que a linha vai fazer, não o que ela é. No telemóvel
    não há «passar por cima» — lá o que ensina é o toque, que devolve a
    linha ao estado anterior à vista de toda a gente.
  */
  if (service.state === 'chosen') {
    const escolhida = clsx(
      moldura,
      'group border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-raised))]',
    )
    const marca = (
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-colors group-hover:bg-[var(--bad)]"
      >
        <Check className="h-3.5 w-3.5 group-hover:hidden" />
        <X className="hidden h-3.5 w-3.5 group-hover:block" />
      </span>
    )
    if (service.href === null) {
      return (
        <span className={escolhida}>
          {nome}
          {preco}
          {marca}
        </span>
      )
    }
    return (
      <Link
        href={service.href}
        scroll={false}
        aria-label={`Tirar ${service.name} da visita`}
        className={clsx(
          escolhida,
          'transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none',
        )}
      >
        {nome}
        {preco}
        {marca}
      </Link>
    )
  }

  if (service.href === null) {
    return (
      <span
        className={clsx(
          moldura,
          'border-[var(--line-soft)] bg-[var(--surface-raised)] opacity-60',
        )}
      >
        {nome}
        {preco}
        <span className="shrink-0 text-[0.625rem] uppercase tracking-[0.08em] text-[var(--ink-faint)]">
          Cheio
        </span>
      </span>
    )
  }

  return (
    <Link
      href={service.href}
      scroll={false}
      aria-label={`Juntar ${service.name} à visita`}
      className={clsx(
        moldura,
        'group border-[var(--line-soft)] bg-[var(--surface-raised)] transition-all duration-150',
        'hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] hover:shadow-[0_1px_2px_rgba(46,38,28,0.05),0_8px_18px_-12px_rgba(46,38,28,0.4)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
      )}
    >
      {nome}
      {preco}
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-faint)] transition-colors group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}
