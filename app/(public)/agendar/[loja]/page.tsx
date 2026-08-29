import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getUnitBySlug } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { firstOpenDay, pulseOfDays } from '@/lib/availability'
import {
  addDays,
  daysBetween,
  formatDayLong,
  isoRange,
  today,
  type IsoDay,
  isValidDay,
} from '@/lib/time'
import { DAY_PARAM, first, funnelHref } from '@/lib/cart'
import { picksStaffOn } from '@/lib/sunday'
import { ButtonLink, Notice } from '@/components/ui'
import { FunnelShell } from '@/components/funnel-shell'
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

  const here = `/agendar/${unit.slug}`
  const offset = daysBetween(firstDay, day)

  return (
    <FunnelShell
      step={2}
      dict={dict}
      // O dia em foco na tira manda no rasto: quem está a olhar para um
      // domingo já vê cinco passos, e não seis com um deles a mentir.
      picksStaff={picksStaffOn(day)}
      hrefs={['/agendar', null, null, null, null, null]}
      eyebrow={unit.name}
      title={dict.funnel.dayTitle}
      subtitle={dict.funnel.daySubtitle}
    >
      {/*
        NO MONITOR, DUAS COLUNAS — MAS CENTRADAS COMO UM PAR.

        À primeira pus o calendário à esquerda e a decisão numa coluna de
        largura livre à direita, e ficou pior do que empilhado: a coluna
        da direita esticava-se até à margem da página, e o botão ficava a
        boiar em trinta centímetros de nada.

        O erro não era serem duas colunas — era deixá-las crescer. Aqui o
        par tem a largura das duas peças (`w-max`) e é o PAR que se
        centra na página: a grelha, um fio, e ao lado dele a data e o
        botão, à mesma altura dos olhos.

        No telemóvel volta a empilhar-se, ao eixo, que é a única coisa
        que lá cabe.
      */}
      <div className="mx-auto max-w-[21.5rem] lg:flex lg:w-max lg:max-w-none lg:items-start lg:gap-12">
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

      {/*
        A SEGUNDA PARTE: o que se escolheu, e o que se faz com isso.

        No telemóvel fica por baixo da grelha, ao eixo, entre dois fios.
        No monitor passa para o lado, encostada a um fio vertical — e
        ganha uma largura sua, para não se esticar até à margem.
      */}
      <div className="mt-7 lg:mt-1 lg:w-[16.5rem] lg:shrink-0 lg:border-l lg:border-[var(--line-soft)] lg:pl-12">
        <div className="flex items-center gap-3.5 lg:flex-col lg:items-start lg:gap-2">
          <span
            aria-hidden
            className="h-px flex-1 bg-[var(--line-soft)] lg:hidden"
          />
          <h2 className="display shrink-0 text-lg text-[var(--ink)] first-letter:uppercase lg:text-2xl lg:leading-tight lg:whitespace-normal">
            {formatDayLong(day, unit.timezone, language)}
          </h2>
          {offset === 0 ? (
            <span className="shrink-0 text-[0.625rem] tracking-[0.14em] text-[var(--ink-faint)] uppercase">
              {dict.funnel.today}
            </span>
          ) : null}
          <span
            aria-hidden
            className="h-px flex-1 bg-[var(--line-soft)] lg:hidden"
          />
        </div>

      {state === 'ok' ? (
        <div className="mt-5">
          {/* Ao domingo o passo da profissional não existe — e por isso
              o botão também não pode prometê-lo. Vai direito à ementa,
              e o aviso por baixo diz porquê antes de ela dar pela
              falta do passo. */}
          <ButtonLink
            href={
              picksStaffOn(day)
                ? funnelHref(`${here}/profissional`, { day })
                : funnelHref(`${here}/servicos`, { day })
            }
            size="lg"
            className="w-full"
          >
            {picksStaffOn(day) ? dict.funnel.dayAction : dict.funnel.chooseService}
          </ButtonLink>
          {!picksStaffOn(day) ? (
            <p className="mt-4 max-w-prose text-[0.8125rem] text-[var(--ink-muted)]">
              {dict.funnel.sundayNoStaff}
            </p>
          ) : null}
        </div>
      ) : (
        // Fechada é uma coisa, cheia é outra — e a grelha por cima já
        // mostra acesos os dias que servem, portanto a saída está à
        // vista.
        <div className="mt-5">
          <Notice tone="warn">
            {state === 'closed' ? dict.unit.closedToday : dict.funnel.dayFull}
          </Notice>
        </div>
      )}
      </div>
      </div>
    </FunnelShell>
  )
}
