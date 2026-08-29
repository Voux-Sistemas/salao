import Link from 'next/link'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  formatMonthYear,
  formatWeekdayShort,
  type IsoDay,
} from '@/lib/time'

/**
 * O CALENDÁRIO DO MÊS — o passo do dia, na montra.
 *
 * Era uma fita de sete dias com setas, e a seta andava de SEMANA em
 * semana: para marcar daqui a dois meses eram oito toques, sem nunca se
 * ver um mês inteiro e sem se saber quantas vezes ainda faltava
 * carregar. Aqui vê-se o mês todo e a seta muda de mês.
 *
 * SEM CAIXAS NENHUMAS. Trinta rectângulos brancos numa página de papel
 * parecem uma folha de cálculo; os números soltos no papel parecem um
 * calendário impresso — que é o que a montra desta casa é. O que está
 * livre leva um ponto de ouro por baixo, o dia escolhido um círculo de
 * ouro cheio, e hoje um fio de ouro à volta.
 *
 * OS ALGARISMOS SÃO DA LETRA DO TEXTO, E DE LARGURA FIXA. A serifa da
 * casa foi desenhada para títulos: em corpo dezasseis, trinta e um
 * algarismos dela seguidos ficam irregulares — o «1» estreito, o «4»
 * aberto, o «7» com bandeira — e as colunas deixam de alinhar a prumo.
 * Num título isso é carácter; numa tabela de números é ruído. A serifa
 * fica no nome do mês, que é onde ela manda.
 *
 * OS DIAS SEM NINGUÉM NÃO SÃO BOTÕES. Ficam a um quinto de tinta — lêem-
 * se, mas não chamam — e não levam ligação nenhuma: a cliente vê onde há
 * vaga ANTES de tocar, em vez de descobrir a bater contra a porta. Um
 * dia fora do que a casa aceita é tratado da mesma maneira.
 *
 * NÃO ENTRA JAVASCRIPT NENHUM: cada dia é uma ligação, o mês vive no
 * endereço, e o retrocesso do navegador anda para trás nos meses.
 *
 * A COR É O `--accent`, E NÃO O `--house`. Esta peça vive na montra, e a
 * pele da montra não tem `--house` nenhum: escrito assim, o dia
 * escolhido ficava com fundo nenhum e letra branca, ou seja invisível.
 */
export function MonthCalendar({
  month,
  day,
  today,
  firstDay,
  lastDay,
  timezone,
  language,
  href,
  monthHref,
  dead,
  labels,
}: {
  /** Um dia qualquer do mês a mostrar — vale o primeiro. */
  month: IsoDay
  /** O dia escolhido. */
  day: IsoDay
  today: IsoDay
  firstDay: IsoDay
  lastDay: IsoDay
  timezone: string
  language: string
  href: (day: IsoDay) => string
  monthHref: (month: IsoDay) => string
  /** Dias sem ninguém de serviço. */
  dead: Set<IsoDay>
  labels: { previous: string; next: string; noSlotsHint: string }
}) {
  const [ano, mes] = month.split('-').map(Number) as [number, number]

  /*
    Ao meio-dia UTC de propósito: um «YYYY-MM-DD» lido à meia-noite cai
    do lado errado do dia em metade dos fusos, e um calendário que começa
    na coluna errada é pior do que não haver calendário.
  */
  const primeiro = `${month.slice(0, 8)}01` as IsoDay
  const diaDaSemana = new Date(`${primeiro}T12:00:00Z`).getUTCDay()
  // A semana da casa começa à segunda: domingo (0) vai para o fim.
  const recuo = (diaDaSemana + 6) % 7
  const quantos = new Date(Date.UTC(ano, mes, 0)).getUTCDate()

  const dias: IsoDay[] = Array.from(
    { length: quantos },
    (_, i) => addDays(primeiro, i) as IsoDay,
  )

  /*
    TRÊS LETRAS, E NEM MAIS UMA.

    Os cabeçalhos saem de uma semana real — 2024-01-01 foi segunda — para
    virem na língua de quem está a ver. Mas o que o sistema chama de
    «curto» varia com a língua e com o motor: em português vinham nomes
    inteiros, e «SEGUNDA TERÇA QUARTA» em colunas de quarenta e sete
    píxeis vem tudo colado. Cortadas às três, «Seg» e «Sáb» leem-se em
    qualquer caso.
  */
  const cabecalhos = Array.from({ length: 7 }, (_, i) =>
    formatWeekdayShort(addDays('2024-01-01' as IsoDay, i), timezone, language)
      .replace(/\.$/, '')
      .slice(0, 3),
  )

  const mesAnterior = addDays(primeiro, -1)
  const mesSeguinte = addDays(primeiro, quantos)
  const podeRecuar = mesAnterior >= firstDay
  const podeAvancar = mesSeguinte <= lastDay

  /*
    TUDO NO MESMO EIXO.

    Estava encostado à esquerda, e a página ficava com um lado cheio e
    outro vazio. Ao centro, o olho desce a direito — do mês ao dia, e do
    dia ao passo seguinte — e a mesma peça serve o telemóvel sem ter de
    desfazer colunas nenhumas.
  */
  return (
    <div className="mx-auto max-w-[21.5rem] lg:max-w-[24rem]">
      {/*
        O mês entre dois fios que se desvanecem do ouro para nada — a
        mesma peça dos títulos de secção da casa — com as setas nas
        pontas. Sem caixa, sem fundo: é um cabeçalho, não um controlo.
      */}
      <div className="mb-5 flex items-center gap-3.5">
        <Seta
          href={podeRecuar ? monthHref(mesAnterior) : null}
          label={labels.previous}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Seta>
        <span
          aria-hidden
          className="h-px flex-1 bg-[linear-gradient(270deg,color-mix(in_srgb,var(--accent)_32%,transparent),transparent)]"
        />
        <p className="display shrink-0 text-[1.1875rem] whitespace-nowrap text-[var(--ink)] first-letter:uppercase lg:text-[1.3125rem]">
          {formatMonthYear(primeiro, timezone, language)}
        </p>
        <span
          aria-hidden
          className="h-px flex-1 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--accent)_32%,transparent),transparent)]"
        />
        <Seta
          href={podeAvancar ? monthHref(mesSeguinte) : null}
          label={labels.next}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Seta>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cabecalhos.map((nome, i) => (
          <span
            key={i}
            aria-hidden
            className="pb-3 text-center text-[0.5938rem] font-bold tracking-[0.16em] text-[var(--ink-faint)] uppercase lg:text-[0.625rem]"
          >
            {nome}
          </span>
        ))}

        {Array.from({ length: recuo }, (_, i) => (
          <span key={`vazio-${i}`} aria-hidden />
        ))}

        {dias.map((valor) => {
          const foraDoAlcance = valor < firstDay || valor > lastDay
          const semVaga = foraDoAlcance || dead.has(valor)
          const escolhido = valor === day
          const numero = Number(valor.slice(8))

          if (semVaga) {
            return (
              <span
                key={valor}
                aria-disabled="true"
                className="tabular flex aspect-square items-center justify-center text-[0.9375rem] font-medium text-[var(--ink)] opacity-20 lg:text-base"
              >
                {numero}
              </span>
            )
          }

          return (
            <Link
              key={valor}
              href={href(valor)}
              aria-current={escolhido ? 'date' : undefined}
              className="group relative flex aspect-square items-center justify-center"
            >
              {/*
                A BOLINHA SAI DE DENTRO DO NÚMERO.

                Estava empilhada com ele, os dois a dividir o meio da
                célula: o número subia para dar lugar ao ponto, e dentro
                do círculo cheio ficavam as duas coisas apertadas contra
                as paredes. E era redundante — um dia pintado de ouro já
                diz que está livre, e é o único que está escolhido.

                Agora o número fica no centro óptico da célula, sozinho,
                e o ponto desce para o pé dela, fora do caminho. No dia
                escolhido não há ponto nenhum: o círculo já o disse.
              */}
              {escolhido ? (
                <span
                  aria-hidden
                  className="absolute inset-[0.3rem] rounded-full bg-[var(--accent)]"
                />
              ) : valor === today ? (
                <span
                  aria-hidden
                  className="absolute inset-[0.3rem] rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
                />
              ) : (
                <span
                  aria-hidden
                  className="absolute inset-[0.3rem] rounded-full transition-colors group-hover:bg-[color-mix(in_srgb,var(--accent)_9%,transparent)]"
                />
              )}

              <span
                className={clsx(
                  'tabular relative text-[0.9375rem] leading-none font-medium lg:text-base',
                  escolhido ? 'text-[var(--accent-ink)]' : 'text-[var(--ink)]',
                )}
              >
                {numero}
              </span>

              {escolhido ? null : (
                <span
                  aria-hidden
                  className="absolute bottom-[0.45rem] block h-[3px] w-[3px] rounded-full bg-[var(--accent)]"
                />
              )}
            </Link>
          )
        })}
      </div>

      {/*
        A LEGENDA SAIU, E BEM.

        Era um quadrado branco sobre papel quase branco — invisível — e um
        algarismo de amostra que ficava a parecer um número perdido no
        meio da página. Uma legenda que precisa de desenhar amostras num
        calendário de trinta números está a competir com aquilo que devia
        explicar. Uma linha em itálico diz o mesmo e não desenha nada.
      */}
      <p className="mt-5 text-center text-[0.75rem] text-[var(--ink-faint)] italic">
        {labels.noSlotsHint}
      </p>
    </div>
  )
}

/** A seta do mês. Sem sítio para onde ir, não é ligação nenhuma. */
function Seta({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: React.ReactNode
}) {
  const moldura =
    'flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full border border-[var(--line-soft)] text-[var(--ink-muted)]'

  if (!href) {
    return (
      <span aria-hidden className={clsx(moldura, 'opacity-25')}>
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={clsx(
        moldura,
        'transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {children}
    </Link>
  )
}
