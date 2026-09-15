import Link from 'next/link'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  formatMonthLong,
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
 * NUM CARTÃO CLARO. Chegou a viver solto no papel, sem caixa nenhuma,
 * e com células quadradas: no telemóvel, com a faixa escura em cima,
 * empurrava a data e o botão para baixo da dobra. Agora é um cartão
 * compacto (ver o desenho em baixo). O dia escolhido é um disco de ouro
 * cheio, e hoje um fio de ouro à volta.
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
    UM CARTÃO CLARO, COMPACTO.

    Sem caixa nenhuma, com o mês em corpo vinte e três e células
    quadradas, o calendário e a faixa escura enchiam o telemóvel: a data
    escolhida e o botão ficavam abaixo da dobra, e a casa dizia que o
    ecrã ficava «comido». No mockup «Dia · delicado» o mês vai num cartão
    de papel mais claro, com linhas de quarenta píxeis, e tudo o que
    decide cabe no primeiro ecrã.

    A largura é da página: no telemóvel ocupa a coluna, no monitor pára
    nos 420 píxeis e fica encostada à margem do título.
  */
  return (
    <div className="rounded-[18px] bg-[var(--surface-raised)] p-3.5 shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:rounded-[22px] sm:p-[22px] lg:w-[26.25rem]">
      <div className="flex items-center justify-between">
        <Seta
          href={podeRecuar ? monthHref(mesAnterior) : null}
          label={labels.previous}
        >
          <ChevronLeft size={13} strokeWidth={2} aria-hidden />
        </Seta>
        <p className="display text-[1.0625rem] leading-[1.2] whitespace-nowrap text-[var(--ink)] sm:text-xl">
          <span className="capitalize">{formatMonthLong(primeiro, timezone, language)}</span>{' '}
          <span className="text-[#8A7F6E]">{ano}</span>
        </p>
        <Seta
          href={podeAvancar ? monthHref(mesSeguinte) : null}
          label={labels.next}
        >
          <ChevronRight size={13} strokeWidth={2} aria-hidden />
        </Seta>
      </div>

      <div className="mt-3.5 grid grid-cols-7">
        {cabecalhos.map((nome, i) => (
          <span
            key={i}
            aria-hidden
            className="text-center text-[0.5625rem] leading-3 font-medium tracking-[0.1em] text-[#8A7F6E] uppercase sm:text-[0.625rem]"
          >
            {nome}
          </span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7">
        {Array.from({ length: recuo }, (_, i) => (
          <span key={`vazio-${i}`} aria-hidden />
        ))}

        {dias.map((valor) => {
          const foraDoAlcance = valor < firstDay || valor > lastDay
          const semVaga = foraDoAlcance || dead.has(valor)
          const escolhido = valor === day
          const numero = Number(valor.slice(8))

          /* Os dias sem ninguém não são botões: ficam a um quarto de
             tinta, lêem-se mas não chamam, e não levam ligação. */
          if (semVaga) {
            return (
              <span
                key={valor}
                aria-disabled="true"
                className="tabular flex h-10 items-center justify-center text-[0.875rem] text-[var(--ink)] opacity-25 sm:h-12 sm:text-[0.9375rem]"
              >
                {numero}
              </span>
            )
          }

          return (
            <Link
              key={valor}
              href={href(valor)}
              // Sem pré-carregamento: são trinta ligações à vista, e cada uma
              // pedia a página ao servidor (e à base) só por aparecer no ecrã.
              prefetch={false}
              aria-current={escolhido ? 'date' : undefined}
              className="group flex h-10 items-center justify-center outline-none sm:h-12"
            >
              {/* O dia escolhido é um disco cheio; hoje, um fio à volta.
                  O número fica sozinho ao centro do disco. */}
              <span
                className={clsx(
                  'tabular flex size-[34px] items-center justify-center rounded-full text-[0.875rem] leading-none transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--accent)] sm:size-[42px] sm:text-[0.9375rem]',
                  escolhido
                    ? 'bg-[var(--accent)] font-semibold text-[var(--accent-ink)]'
                    : clsx(
                        'font-medium text-[var(--ink)] group-hover:bg-[color-mix(in_srgb,var(--accent)_9%,transparent)]',
                        valor === today &&
                          'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]',
                      ),
                )}
              >
                {numero}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Uma linha em itálico diz porque há dias apagados, sem desenhar
          legenda nenhuma. */}
      <p className="mt-2 text-center text-[0.71875rem] leading-4 text-[#8A7F6E] italic sm:mt-3">
        {labels.noSlotsHint}
      </p>
    </div>
  )
}

/**
 * A seta do mês: um círculo só com fio, como as da semana na faixa.
 * Sem sítio para onde ir, não é ligação nenhuma e fica apagada.
 */
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
    'flex size-7 shrink-0 items-center justify-center rounded-full sm:size-[30px]'

  if (!href) {
    return (
      <span
        aria-hidden
        className={clsx(
          moldura,
          'text-[#C9BEAC] shadow-[inset_0_0_0_1px_rgba(34,29,23,0.07)]',
        )}
      >
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-label={label}
      prefetch={false}
      className={clsx(
        moldura,
        'text-[var(--action-strong)] shadow-[inset_0_0_0_1px_rgba(34,29,23,0.14)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
      )}
    >
      {children}
    </Link>
  )
}
