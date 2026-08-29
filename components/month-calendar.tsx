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
 * parecem uma folha de cálculo; os números em serifa, soltos no papel,
 * parecem um calendário impresso — que é o que a montra desta casa é.
 * O que está livre leva um ponto de ouro por baixo, o dia escolhido um
 * círculo de ouro cheio, e hoje um fio de ouro à volta.
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

  return (
    <div className="max-w-[23rem]">
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
        <p className="display shrink-0 text-[1.1875rem] whitespace-nowrap text-[var(--ink)] first-letter:uppercase">
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
            className="pb-2.5 text-center text-[0.5938rem] font-bold tracking-[0.14em] text-[var(--ink-faint)] uppercase"
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
                className="display flex aspect-square items-center justify-center text-[1.0625rem] text-[var(--ink)] opacity-20"
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
              {escolhido ? (
                <span
                  aria-hidden
                  className="absolute inset-1 rounded-full bg-[var(--accent)]"
                />
              ) : valor === today ? (
                <span
                  aria-hidden
                  className="absolute inset-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
                />
              ) : (
                <span
                  aria-hidden
                  className="absolute inset-1 rounded-full transition-colors group-hover:bg-[color-mix(in_srgb,var(--accent)_9%,transparent)]"
                />
              )}

              <span className="relative flex flex-col items-center gap-[0.3rem]">
                <span
                  className={clsx(
                    'display text-[1.0625rem] leading-none',
                    escolhido
                      ? 'text-[var(--accent-ink)]'
                      : 'text-[var(--ink)]',
                  )}
                >
                  {numero}
                </span>
                <span
                  aria-hidden
                  className={clsx(
                    'block h-[3px] w-[3px] rounded-full',
                    escolhido
                      ? 'bg-[color-mix(in_srgb,var(--accent-ink)_75%,transparent)]'
                      : 'bg-[var(--accent)]',
                  )}
                />
              </span>
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
      <p className="mt-5 text-[0.75rem] text-[var(--ink-faint)] italic">
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
