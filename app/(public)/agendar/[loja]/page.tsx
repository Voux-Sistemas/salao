import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getUnitBySlug } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { openWeekdaysFor } from '@/lib/hours'
import {
  addDays,
  daysBetween,
  formatDayLong,
  today,
  weekdayOf,
  type IsoDay,
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

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

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

  const [dict, language, abertura] = await Promise.all([
    getDictionary(),
    getLanguage(),
    openWeekdaysFor([unit.id]),
  ])

  const firstDay = today(unit.timezone)
  const lastDay = addDays(firstDay, unit.max_lead_days)
  const asked = first(query[DAY_PARAM])
  const day: IsoDay =
    asked && ISO_DAY.test(asked)
      ? asked < firstDay
        ? firstDay
        : asked > lastDay
          ? lastDay
          : asked
      : firstDay

  // Um dia em que a casa não abre não tem equipa nenhuma para mostrar,
  // e vale a pena dizê-lo aqui em vez de no passo seguinte, com o ecrã
  // já vazio.
  const openWeekdays = abertura.get(unit.id) ?? []
  const closed = !openWeekdays.includes(weekdayOf(day))

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

      {closed ? (
        <div className="mt-8">
          <Notice tone="warn">{dict.unit.closedToday}</Notice>
        </div>
      ) : (
        <div className="mt-8">
          <ButtonLink
            href={funnelHref(`${here}/profissional`, { day })}
            size="lg"
            className="w-full sm:w-auto"
          >
            {dict.funnel.dayAction}
          </ButtonLink>
        </div>
      )}
    </FunnelShell>
  )
}
