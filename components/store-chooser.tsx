import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui'
import { Photo, PhotoFallback } from '@/components/photo'
import { sameWord } from '@/lib/text'

/**
 * O SELETOR DE LOJA.
 *
 * Agenda, Caixa e Avisos partilham a mesma porta: sem loja no endereço,
 * o ecrã pergunta em que casa se está. Quem só tem uma loja nunca chega
 * a ver isto — as páginas reencaminham antes.
 *
 * ISTO É UMA PASSAGEM, NÃO UMA CAPA. Estava desenhado como um cartaz:
 * tudo centrado a meio da altura, o título grande e um ramo desenhado
 * por baixo — bonito da primeira vez, uma paragem à quinquagésima. Quem
 * abre o caixa de manhã quer o botão onde ele estava ontem, em cima e à
 * esquerda, sem esperar por nada. Agora é isso: um cabeçalho curto e
 * duas fichas com o que interessa saber antes de entrar.
 *
 * A FOTOGRAFIA DA CASA É QUE DISTINGUE AS DUAS.
 *
 * Aqui esteve um quadrado de 36px com o glifo de loja — igual nas duas
 * fichas, portanto não distinguia nada; e antes dele um avatar com a
 * inicial, que dava o mesmo C a «Chiado» e a «Cascais». A foto da casa
 * resolve o que nenhum dos dois resolvia: reconhece-se a sala antes de
 * se ler o nome.
 *
 * Mas só resolve com TAMANHO. Numa miniatura de 44px uma sala lê-se
 * como uma mancha castanha ao lado de uma mancha branca — paga-se a
 * fotografia e não se vê a casa. Por isso a foto é uma banda inteira em
 * cima da ficha, e o nome fica por baixo, em tinta escura sobre branco:
 * uma fotografia escura, tremida ou tirada à pressa ao balcão estraga a
 * imagem, mas nunca estraga o cartão. E as fotografias de uma loja
 * mudam — com as obras, com a época, com quem as tira.
 *
 * O fio de ouro entre a foto e o nome é o mesmo que está debaixo do
 * título da página: é a assinatura da casa, e é o que impede a banda de
 * parecer um banner colado.
 */

export type ChooserStore = {
  href: string
  name: string
  /** Cidade ou morada — a linha pequena por baixo do nome. */
  meta?: string | null
  /** O estado da casa, à direita do nome. */
  badge?: {
    label: string
    tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'bad'
  } | null
  /** Uma frase sobre o que lá espera: o esperado na gaveta, a fila. */
  line?: string | null
  /** A capa da casa — a primeira foto de `unit_photo`. Pode não haver. */
  photo?: { url: string; alt?: string | null } | null
}

export function StoreChooser({
  title,
  hint,
  cta = 'Abrir',
  stores,
}: {
  title: string
  hint?: string
  cta?: string
  stores: ChooserStore[]
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="surge mb-5">
        <h1 className="display text-[1.75rem] leading-none text-[var(--ink)]">
          {title}
        </h1>
        <span aria-hidden className="fio-casa mt-3" />
        {hint ? (
          <p className="mt-3 max-w-lg text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
            {hint}
          </p>
        ) : null}
      </header>

      <div className="surge surge-1 grid gap-3 sm:grid-cols-2">
        {stores.map((store) => (
          <Link
            key={store.href}
            href={store.href}
            className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(15,21,32,0.04)] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
          >
            {/* A BANDA DA CASA. Altura fixa, e não proporção: as duas
                fichas ficam à mesma altura venha a fotografia deitada ou
                ao alto, e a linha do nome cai sempre no mesmo sítio. */}
            <span className="relative block h-[9.5rem] shrink-0 bg-[var(--surface-2)]">
              {store.photo ? (
                /* `eager`: são duas ou três fotografias, todas acima da
                   dobra, e são o ecrã inteiro — entrarem tarde era vê-las
                   aparecer depois de a mão já ir a caminho do cartão. */
                <Photo
                  src={store.photo.url}
                  alt={store.photo.alt ?? store.name}
                  eager
                />
              ) : (
                /* A casa sem fotografia não fica com um buraco cinzento:
                   fica com o monograma sobre papel. O `--gold` local é
                   porque o desenho do fundo é feito com essa variável, e
                   no balcão ela é o violeta da segunda série — aqui quem
                   assina é o ouro da casa. */
                <span
                  className="block h-full w-full"
                  style={{ ['--gold' as string]: 'var(--house, var(--accent))' }}
                >
                  <PhotoFallback seed={store.name} />
                </span>
              )}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5"
                style={{ background: 'var(--house, var(--accent))' }}
              />
            </span>

            <div className="flex flex-1 flex-col px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="display truncate text-lg leading-tight text-[var(--ink)]">
                    {store.name}
                  </p>
                  {/* A cidade só entra se disser algo que o nome não diga:
                      a casa de Cascais chama-se Cascais e ficava a ler-se
                      «Cascais / Cascais», uma linha a repetir a de cima. */}
                  {store.meta && !sameWord(store.meta, store.name) ? (
                    <p className="truncate text-[0.75rem] text-[var(--ink-faint)]">
                      {store.meta}
                    </p>
                  ) : null}
                </div>
                {store.badge ? (
                  <span className="shrink-0">
                    <Badge tone={store.badge.tone ?? 'neutral'}>
                      {store.badge.label}
                    </Badge>
                  </span>
                ) : null}
              </div>

              {store.line ? (
                <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                  {store.line}
                </p>
              ) : null}

              {/* `mt-auto` para o rodapé das duas fichas ficar à mesma
                  altura, tenha uma delas uma linha a mais ou a menos. */}
              <span className="mt-auto inline-flex items-center gap-1 self-start pt-3 text-[0.8125rem] font-semibold text-[var(--accent)]">
                {cta}
                <ChevronRight
                  size={15}
                  strokeWidth={2.25}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
