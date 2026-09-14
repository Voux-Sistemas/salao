import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getUnitBySlug } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { firstOpenDay, pulseOfDays, staffForDay } from '@/lib/availability'
import { openingWindows } from '@/lib/hours'
import {
  addDays,
  daysBetween,
  formatDayLong,
  formatMinutes,
  isoRange,
  today,
  type IsoDay,
  isValidDay,
} from '@/lib/time'
import { DAY_PARAM, first, funnelHref } from '@/lib/cart'
import { picksStaffOn } from '@/lib/sunday'
import { Notice } from '@/components/ui'
import { FunnelStage } from '@/components/funnel-stage'
import { MonthCalendar } from '@/components/month-calendar'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/*
 * O outro endereço que se cola numa conversa — e o mais usado dos dois,
 * porque é o que responde a «quero marcar».
 *
 * Aqui há duas audiências no mesmo sítio, e não levam o mesmo texto. O
 * separador do browser é dela e segue o cookie da língua. A
 * pré-visualização que o WhatsApp desenha é lida por um robô sem cookie
 * nenhum, e essa fica em português — como a do layout.
 *
 * Os passos seguintes já são pessoais e ficam fora do índice — ver o
 * `robots` de cada um.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { loja } = await params
  const [unit, dict] = await Promise.all([getUnitBySlug(loja), getDictionary()])
  if (!unit) return { title: dict.tabs.book }

  const title = `${dict.tabs.book} · ${unit.name}`
  const shared = `Marcar · ${unit.name}`
  const description = unit.city
    ? `Escolha o dia, a profissional e o serviço em ${unit.city}. Confirmação imediata.`
    : 'Escolha o dia, a profissional e o serviço. Confirmação imediata.'

  return {
    title,
    description,
    alternates: { canonical: `/agendar/${unit.slug}` },
    openGraph: {
      type: 'website',
      title: shared,
      description,
      url: `/agendar/${unit.slug}`,
    },
    twitter: { card: 'summary_large_image', title: shared, description },
  }
}

/**
 * Passo 2 — escolher o dia.
 *
 * O funil começava pelo serviço e acabava na profissional, e a
 * profissional acabava por ser atribuída pela casa: quem chegava ao fim
 * já tinha alguém escolhido sem nunca ter escolhido. A ordem é agora a
 * que a cliente faz na cabeça — «quinta-feira, com a Ana» — e por isso
 * o dia vem primeiro: sem ele não se sabe quem está de serviço, e
 * mostrar a equipa toda como se estivesse disponível seria a mesma
 * promessa vazia.
 *
 * Tudo o que se escolhe entra no endereço: nada disto precisa de sessão
 * nem de JavaScript.
 */
/** O mês visível do calendário. Só existe neste passo. */
const MONTH_PARAM = 'm'

export default async function ChooseDayPage({ params, searchParams }: Params) {
  const { loja } = await params
  const query = await searchParams
  const unit = await getUnitBySlug(loja)
  if (!unit) notFound()

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  const firstDay = today(unit.timezone)
  const lastDay = addDays(firstDay, unit.max_lead_days)
  const asked = first(query[DAY_PARAM])
  const askedDay: IsoDay | null =
    asked && isValidDay(asked)
      ? asked < firstDay
        ? firstDay
        : asked > lastDay
          ? lastDay
          : (asked as IsoDay)
      : null

  // Sem dia pedido, o funil abre no primeiro dia em que alguém tem
  // vaga — aterrar em «hoje» com o dia cheio era começar por um beco.
  // Quem pede um dia concreto é respeitado, mesmo que ele esteja morto:
  // a resposta é a explicação, com os dias vivos acesos na tira.
  const day: IsoDay =
    askedDay ?? (await firstOpenDay(unit, firstDay, lastDay, 'online')) ?? firstDay

  /*
    O MÊS VISÍVEL VIVE NO ENDEREÇO, como tudo o resto deste funil.

    Sem `m`, mostra-se o mês do dia escolhido. Com `m`, mostra-se esse —
    e é assim que a seta do mês funciona sem uma linha de JavaScript.
    Fora do que a casa aceita, cai para o mês de hoje.
  */
  const askedMonth = first(query[MONTH_PARAM])
  const mesPedido =
    askedMonth && isValidDay(askedMonth) ? (askedMonth as IsoDay) : null
  const mesBase = mesPedido ?? day
  const mes = `${mesBase.slice(0, 8)}01` as IsoDay

  /*
    O PULSO DO MÊS INTEIRO: um dia sem ninguém fica apagado ANTES de a
    cliente lhe carregar em cima.

    E É AQUI QUE SE OLHA SE A PÁGINA FICAR LENTA. O `pulseOfDays` faz
    duas idas à base por dia; eram catorze para a fita de sete, passam a
    ser umas sessenta para um mês. Correm todas ao mesmo tempo e a casa é
    pequena, mas o número está escrito para não ser preciso descobri-lo.
    Se doer, a saída é uma consulta só que responda pelos trinta dias de
    uma vez — não é tirar o calendário.
  */
  const diasDoMes = isoRange(mes, 31)
    .filter((d) => d.slice(0, 7) === mes.slice(0, 7))
    .filter((d) => d >= firstDay && d <= lastDay)
  const pulse = await pulseOfDays(unit, diasDoMes, 'online')
  const deadDays = new Set(diasDoMes.filter((d) => pulse.get(d) !== 'ok'))
  const state = pulse.get(day) ?? 'ok'

  /*
    OS TRÊS FACTOS DO DIA ESCOLHIDO.

    A coluna ao lado do calendário tinha uma data, uma palavra e um
    botão — três linhas de texto ao lado de uma grelha de seis, e por
    isso o ecrã lia-se sempre torto. Mas o problema não era de arrumação:
    era de substância.

    Estes são os factos que a cliente quer ANTES de carregar em «ver quem
    está» — a loja, as horas a que abre nesse dia, e quantas estão de
    serviço — e que até aqui só descobria no passo seguinte, já depois de
    ter escolhido. Equilibra-se a página a resolver, e não a arrumar.

    CUSTAM DUAS IDAS À BASE, e são só para o dia escolhido: somam-se às
    do pulso do mês. Ver o comentário do `pulseOfDays` acima.
  */
  const [janelas, equipa] = await Promise.all([
    openingWindows(unit.id, day),
    staffForDay(unit, day, 'online'),
  ])
  const aoServico = equipa.filter((p) => p.available).length
  const horario =
    janelas.length > 0
      ? janelas
          .map((w) => `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`)
          .join(' · ')
      : null

  const here = `/agendar/${unit.slug}`
  const offset = daysBetween(firstDay, day)
  const withStaff = picksStaffOn(day)

  /*
    A LINHA DO DIA: «Hoje · Abre 09:00–21:00 · 2 de serviço».

    Eram três pares de rótulo e resposta — loja, abre, equipa — por baixo
    da data. A loja já está na faixa, e três linhas empurravam o botão
    para baixo da dobra no telemóvel. Numa linha só dizem o mesmo.
  */
  const dayLine = [
    offset === 0 ? dict.funnel.today : null,
    horario ? `${dict.funnel.dayOpens} ${horario}` : null,
    aoServico > 0
      ? aoServico === 1
        ? dict.funnel.dayTeamOne
        : dict.funnel.dayTeamCount.replace('{n}', String(aoServico))
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <FunnelStage
      step={2}
      dict={dict}
      // O dia em foco manda no rasto: quem está a olhar para um domingo
      // já vê cinco passos, e não seis com um deles a mentir.
      picksStaff={withStaff}
      hrefs={['/agendar', null, null, null, null, null]}
      eyebrow={unit.name}
      title={dict.funnel.dayTitle}
      back={{ href: '/agendar', label: dict.common.back }}
    >
      {/*
        NO TELEMÓVEL, TUDO NO PRIMEIRO ECRÃ: o cartão do mês, a data e o
        botão, empilhados.

        NO MONITOR, UM PAR ENCOSTADO À MARGEM DO TÍTULO: o cartão do mês
        à esquerda, um fio que nasce e morre em nada, e à direita a data e
        o botão, à altura do meio do mês.
      */}
      <div className="lg:flex lg:items-center lg:gap-12">
        <MonthCalendar
          month={mes}
          day={day}
          today={firstDay}
          firstDay={firstDay}
          lastDay={lastDay}
          timezone={unit.timezone}
          language={language}
          href={(value) => funnelHref(here, { day: value })}
          monthHref={(value) => `${here}?${MONTH_PARAM}=${value}`}
          dead={deadDays}
          labels={{
            previous: dict.funnel.monthPrevious,
            next: dict.funnel.monthNext,
            noSlotsHint: dict.funnel.dayNoSlotsHint,
          }}
        />

        <span
          aria-hidden
          className="hidden w-px self-stretch bg-[linear-gradient(180deg,transparent,rgba(34,29,23,0.12)_16%,rgba(34,29,23,0.12)_84%,transparent)] lg:block"
        />

        <div className="mt-4 px-1 lg:mt-0 lg:w-[18.75rem] lg:shrink-0 lg:px-0">
          <p className="hidden text-[0.6875rem] leading-[14px] font-medium tracking-[0.18em] text-[var(--accent)] uppercase lg:block">
            {dict.funnel.dayChosen}
          </p>
          <h2 className="display text-[1.0625rem] leading-[1.25] text-[var(--ink)] first-letter:uppercase lg:mt-2 lg:text-2xl lg:leading-[1.2]">
            {formatDayLong(day, unit.timezone, language)}
          </h2>
          {dayLine ? (
            <p className="mt-[3px] text-[0.78125rem] leading-[18px] text-[var(--ink-muted)] lg:mt-2 lg:text-[0.8125rem] lg:leading-5">
              {dayLine}
            </p>
          ) : null}

          {state === 'ok' ? (
            <>
              {/* Ao domingo o passo da profissional não existe — e por
                  isso o botão também não o pode prometer. Vai direito
                  aos serviços, e o aviso por baixo diz porquê. */}
              <Link
                href={
                  withStaff
                    ? funnelHref(`${here}/profissional`, { day })
                    : funnelHref(`${here}/servicos`, { day })
                }
                className="botao sheen mt-3 flex h-[46px] w-full items-center justify-center gap-1.5 rounded-full bg-[var(--action)] text-[0.90625rem] font-semibold tracking-[0.01em] text-[var(--action-ink)] shadow-[0_10px_22px_-14px_rgba(111,85,47,0.7)] transition-all duration-300 select-none hover:-translate-y-0.5 hover:bg-[var(--action-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px lg:mt-5 lg:h-12 lg:text-[0.9375rem]"
              >
                {withStaff ? dict.funnel.dayAction : dict.funnel.dayActionServices}
                <ChevronRight size={15} strokeWidth={2} aria-hidden />
              </Link>
              {!withStaff ? (
                <p className="mt-3 max-w-prose text-[0.78125rem] leading-[18px] text-[var(--ink-muted)] lg:text-[0.8125rem] lg:leading-5">
                  {dict.funnel.sundayNoStaff}
                </p>
              ) : null}
            </>
          ) : (
            // Fechada é uma coisa, cheia é outra — e o calendário por
            // cima já mostra acesos os dias que servem.
            <div className="mt-3 lg:mt-5">
              <Notice tone="warn">
                {state === 'closed' ? dict.unit.closedToday : dict.funnel.dayFull}
              </Notice>
            </div>
          )}
        </div>
      </div>
    </FunnelStage>
  )
}
