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
 * carregar. Quem quer marcar «para o mês que vem» não tinha por onde lá
 * chegar senão às cegas.
 *
 * Aqui vê-se o mês todo de uma vez e a seta muda de mês. Dois toques
 * para dois meses.
 *
 * OS DIAS SEM NINGUÉM NÃO SÃO BOTÕES. Ficam sem moldura, em cinzento
 * claro, e não levam ligação nenhuma: a cliente vê onde há vaga ANTES de
 * tocar, em vez de descobrir a bater contra a porta. Um dia fora do que
 * a casa aceita — antes de hoje, ou depois do horizonte — é tratado da
 * mesma maneira.
 *
 * NÃO ENTRA JAVASCRIPT NENHUM: cada dia é uma ligação, o mês vive no
 * endereço, e o retrocesso do navegador anda para trás nos meses.
 *
 * A COR É O `--accent`, E NÃO O `--house`. Esta peça vive na montra, e
 * a pele da montra não tem `--house` nenhum — escrito assim, o dia
 * escolhido ficava com fundo nenhum e letra branca, ou seja invisível.
 * O ouro da montra é o próprio `--accent`.
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
  labels: {
    previous: string
    next: string
    hasSlots: string
    noSlots: string
  }
}) {
  const [ano, mes] = month.split('-').map(Number) as [number, number]

  /*
    Ao meio-dia UTC de propósito: um «YYYY-MM-DD» lido à meia-noite cai
    do lado errado do dia em metade dos fusos, e um calendário que
    começa na coluna errada é pior do que não haver calendário.
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

  /* Os cabeçalhos saem de uma semana real — 2024-01-01 foi segunda —
     para virem na língua de quem está a ver, sem tabela escrita à mão. */
  const cabecalhos = Array.from({ length: 7 }, (_, i) =>
    formatWeekdayShort(addDays('2024-01-01' as IsoDay, i), timezone, language),
  )

  const mesAnterior = addDays(primeiro, -1)
  const mesSeguinte = addDays(primeiro, quantos)
  const podeRecuar = mesAnterior >= firstDay
  const podeAvancar = mesSeguinte <= lastDay

  /*
    UM CALENDÁRIO TEM A LARGURA DE UM CALENDÁRIO.

    Sem tecto, as sete colunas esticavam-se pela página toda: no monitor
    davam células de cento e trinta píxeis e um mês com setecentos de
    altura, com os números perdidos no meio de cada quadrado. Uma grelha
    de datas não cresce com o ecrã — cresce até caber, e depois pára.

    Vinte e três rem dão células de sessenta no monitor e de quarenta e
    seis num telemóvel de 390: o polegar chega às duas.
  */
  return (
    <div className="max-w-[23rem]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Seta
          href={podeRecuar ? monthHref(mesAnterior) : null}
          label={labels.previous}
        >
          <ChevronLeft className="h-4 w-4" />
        </Seta>

        <p className="display text-lg text-[var(--ink)] first-letter:uppercase sm:text-xl">
          {formatMonthYear(primeiro, timezone, language)}
        </p>

        <Seta
          href={podeAvancar ? monthHref(mesSeguinte) : null}
          label={labels.next}
        >
          <ChevronRight className="h-4 w-4" />
        </Seta>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {cabecalhos.map((nome, i) => (
          <span
            key={i}
            aria-hidden
            className="pb-1 text-center text-[0.625rem] font-bold tracking-[0.08em] text-[var(--ink-faint)] uppercase"
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
                title={labels.noSlots}
                className="display flex aspect-square items-center justify-center rounded-[var(--radius)] text-[0.9375rem] text-[var(--ink-faint)] opacity-55 sm:text-base"
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
              title={labels.hasSlots}
              className={clsx(
                'display flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius)] border text-[0.9375rem] transition-colors sm:text-base',
                escolhido
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                  : valor === today
                    ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--ink)] hover:bg-[var(--surface-2)]'
                    : 'border-[var(--line-soft)] bg-[var(--surface-raised)] text-[var(--ink)] hover:border-[var(--accent)]',
              )}
            >
              {numero}
              <span
                aria-hidden
                className={clsx(
                  'block h-1 w-1 rounded-full',
                  escolhido
                    ? 'bg-[color-mix(in_srgb,var(--accent-ink)_85%,transparent)]'
                    : 'bg-[var(--accent)]',
                )}
              />
            </Link>
          )
        })}
      </div>

      {/* A legenda diz o que a mancha já diz, para quem não a lê à
          primeira — e sobretudo para quem chega aqui com um leitor de
          ecrã, que não vê manchas nenhumas. */}
      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.75rem] text-[var(--ink-muted)]">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="block h-3.5 w-3.5 rounded-[4px] border border-[var(--line)] bg-[var(--surface-raised)]"
          />
          {labels.hasSlots}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="display block w-3.5 text-center text-[0.75rem] text-[var(--ink-faint)] opacity-55"
          >
            7
          </span>
          {labels.noSlots}
        </span>
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
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-muted)]'

  if (!href) {
    return (
      <span aria-hidden className={clsx(moldura, 'opacity-30')}>
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
        'transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)]',
      )}
    >
      {children}
    </Link>
  )
}
