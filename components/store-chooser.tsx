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
 *
 * NO TELEMÓVEL A FICHA DEITA-SE.
 *
 * A banda por cima é do ecrã largo, onde as duas casas ficam lado a
 * lado e sobra altura. No telemóvel elas empilham-se, e uma banda de
 * 152px mais o texto dava 264px por casa: com o cabeçalho, a segunda
 * casa nascia sempre cortada pela barra de baixo — a janela útil do
 * Safari são ~720px, não os 844 do aparelho.
 *
 * Então abaixo do `sm:` a fotografia passa para a esquerda, 118px de
 * largo pela altura do texto, e o fio de ouro fica DE PÉ entre as duas.
 * A ficha cai para menos de cem e as duas casas cabem no primeiro terço
 * do ecrã — e uma terceira ou quarta casa continuam a caber sem rolar.
 *
 * O `min-h` é para a Agenda: é o único seletor sem `line` nem `badge`,
 * e sem ele a ficha encolhia até à altura do nome, com a fotografia a
 * voltar a ser um selo.
 *
 * O «Ver o dia ›» também sai no telemóvel: a ficha inteira é tocável, e
 * uma fila só para ele dizia a mesma coisa duas vezes. Fica a seta
 * encostada ao nome; o texto por extenso volta a partir do `sm:`, onde
 * há espaço de sobra.
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
            className="group flex min-h-[5.5rem] overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(15,21,32,0.04)] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] sm:min-h-0 sm:flex-col"
          >
            {/* A FOTOGRAFIA. De lado no telemóvel, banda por cima no ecrã
                largo — e aí com altura fixa, não proporção: as duas fichas
                ficam à mesma altura venha a foto deitada ou ao alto, e a
                linha do nome cai sempre no mesmo sítio. */}
            <span className="relative block w-[7.375rem] shrink-0 self-stretch bg-[var(--surface-2)] sm:h-[9.5rem] sm:w-full">
              {store.photo ? (
                /* `eager`: são duas ou três fotografias, todas acima da
                   dobra, e são o ecrã inteiro — entrarem tarde era vê-las
                   aparecer depois de a mão já ir a caminho do cartão.

                   `absolute inset-0` porque deitada a foto não tem altura
                   própria: quem a dá é o texto ao lado. */
                <Photo
                  src={store.photo.url}
                  alt={store.photo.alt ?? store.name}
                  className="absolute inset-0"
                  eager
                />
              ) : (
                /* A casa sem fotografia não fica com um buraco cinzento:
                   fica com o monograma sobre papel. O `--gold` local é
                   porque o desenho do fundo é feito com essa variável, e
                   no balcão ela é o violeta da segunda série — aqui quem
                   assina é o ouro da casa. */
                <span
                  className="absolute inset-0"
                  style={{ ['--gold' as string]: 'var(--house, var(--accent))' }}
                >
                  <PhotoFallback seed={store.name} />
                </span>
              )}
              {/* O fio de ouro acompanha: de pé entre a foto e o texto no
                  telemóvel, deitado por baixo da banda no ecrã largo. */}
              <span
                aria-hidden
                className="absolute top-0 right-0 bottom-0 w-0.5 sm:top-auto sm:left-0 sm:h-0.5 sm:w-auto"
                style={{ background: 'var(--house, var(--accent))' }}
              />
            </span>

            <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2.5 sm:items-start sm:gap-3">
                <div className="min-w-0 flex-1">
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
                {/* A seta do telemóvel, no lugar do «Ver o dia ›». */}
                <ChevronRight
                  size={17}
                  strokeWidth={2.25}
                  className="shrink-0 text-[var(--accent)] sm:hidden"
                />
              </div>

              {store.line ? (
                <p className="mt-1.5 text-[0.78125rem] leading-relaxed text-[var(--ink-muted)] sm:mt-2.5 sm:text-[0.8125rem]">
                  {store.line}
                </p>
              ) : null}

              {/* `mt-auto` para o rodapé das duas fichas ficar à mesma
                  altura, tenha uma delas uma linha a mais ou a menos. */}
              <span className="mt-auto hidden items-center gap-1 self-start pt-3 text-[0.8125rem] font-semibold text-[var(--accent)] sm:inline-flex">
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
