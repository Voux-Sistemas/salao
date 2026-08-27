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
import { ButtonLink, Notice } from '@/components/ui'
import { FunnelShell } from '@/components/funnel-shell'
import { DayStrip } from '@/components/day-strip'

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

  // O pulso da semana visível: um dia sem ninguém fica apagado na tira
  // ANTES de a cliente lhe carregar em cima.
  const week = isoRange(day, 7).filter((d) => d <= lastDay)
  const pulse = await pulseOfDays(unit, week, 'online')
  const deadDays = new Set(week.filter((d) => pulse.get(d) !== 'ok'))
  const state = pulse.get(day) ?? 'ok'

  const here = `/agendar/${unit.slug}`
  const offset = daysBetween(firstDay, day)

  return (
    <FunnelShell
      step={2}
      dict={dict}
      hrefs={['/agendar', null, null, null, null, null]}
      eyebrow={unit.name}
      title={dict.funnel.dayTitle}
      subtitle={dict.funnel.daySubtitle}
    >
      <DayStrip
        day={day}
        firstDay={firstDay}
        lastDay={lastDay}
        timezone={unit.timezone}
        language={language}
        dict={dict}
        href={(value) => funnelHref(here, { day: value })}
        label={dict.funnel.steps.day}
        disabled={deadDays}
      />

      {/* A data por extenso, em serifa: confirma em palavras o que a
          tira acima diz em números. */}
      <div className="mt-8 flex items-baseline gap-4">
        <h2 className="display text-xl text-[var(--ink)] first-letter:uppercase">
          {formatDayLong(day, unit.timezone, language)}
        </h2>
        <span className="h-px flex-1 bg-[var(--line-soft)]" />
        {offset === 0 ? (
          <span className="shrink-0 text-[0.6875rem] tracking-[0.14em] text-[var(--ink-faint)] uppercase">
            {dict.funnel.today}
          </span>
        ) : null}
      </div>

      {state === 'ok' ? (
        <div className="mt-8">
          <ButtonLink
            href={funnelHref(`${here}/profissional`, { day })}
            size="lg"
            className="w-full sm:w-auto"
          >
            {dict.funnel.dayAction}
          </ButtonLink>
        </div>
      ) : (
        // Fechada é uma coisa, cheia é outra — e a tira acima já mostra
        // acesos os dias que servem, portanto a saída está à vista.
        <div className="mt-8">
          <Notice tone="warn">
            {state === 'closed' ? dict.unit.closedToday : dict.funnel.dayFull}
          </Notice>
        </div>
      )}
    </FunnelShell>
  )
}
