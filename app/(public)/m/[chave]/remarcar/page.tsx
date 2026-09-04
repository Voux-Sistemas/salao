import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { availableSlots } from '@/lib/availability'
import { clientMayReschedule, marcacaoPelaChave } from '@/lib/booking'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { getUnitBySlug } from '@/lib/org'
import { serviceNamesFor } from '@/lib/catalog-names'
import {
  addDays,
  formatDayLong,
  formatMinutes,
  formatTime,
  isValidDay,
  isoDay,
  isoRange,
  today,
  type IsoDay,
} from '@/lib/time'
import { DayStrip } from '@/components/day-strip'
import { HorasParaRemarcar } from '@/components/manage-forms'
import { LeafRule, Monogram, Ornament } from '@/components/brand'

type Params = {
  params: Promise<{ chave: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.manage.rescheduleTitle,
    robots: { index: false, follow: false },
  }
}

/**
 * MUDAR DE HORA, PELA CHAVE.
 *
 * É um passo só, e é de propósito. O funil de marcar tem cinco — loja,
 * dia, profissional, serviços, hora — porque de lá não se sabe nada de
 * antemão. Aqui sabe-se tudo menos uma coisa: os serviços são os que ela
 * escolheu, a loja é a mesma, e a única pergunta que resta é «quando».
 * Repetir o funil inteiro para mudar uma hora era pedir-lhe que
 * remarcasse do princípio.
 *
 * A PROFISSIONAL NÃO SE PERGUNTA. Fica solta, e o motor reparte a visita
 * por quem estiver livre na hora nova. Insistir em quem fazia antes
 * fechava metade dos horários — e quem vem mudar de hora vem porque a
 * hora não dá, não porque a pessoa não serve.
 */
export default async function RemarcarPelaChavePage({
  params,
  searchParams,
}: Params) {
  const { chave } = await params
  const query = await searchParams

  const appointment = await marcacaoPelaChave(chave)
  if (!appointment) notFound()

  const unit = await getUnitBySlug(appointment.unit_slug)
  if (!unit) notFound()

  /*
    Fora da janela, esta página não existe — e a resposta é a página da
    marcação, que diz porquê e dá o telefone da loja. Um ecrã de horas
    que não se pode usar era pior do que não haver ecrã nenhum.
  */
  if (!clientMayReschedule(appointment, unit)) {
    redirect(`/m/${chave}`)
  }

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  const firstDay = today(unit.timezone)
  const lastDay = addDays(firstDay, unit.max_lead_days)
  const pedido = query.d
  const escolhido =
    typeof pedido === 'string' && isValidDay(pedido) ? (pedido as IsoDay) : null
  const day =
    escolhido && escolhido >= firstDay && escolhido <= lastDay
      ? escolhido
      : firstDay

  /*
    OS SERVIÇOS SÃO OS DA MARCAÇÃO, e vêm de dentro — nunca do endereço.
    Mudar de hora não é mudar de visita: deixar o carrinho viajar no
    endereço era deixar trocar um corte por uma coloração pelo caminho.
  */
  const cart = appointment.items.map((item) => ({
    serviceId: item.service_id,
    staffId: null,
  }))

  /*
    A MARCAÇÃO ANTIGA NÃO SE ESTORVA A SI MESMA. Sem este `exclude`, os
    blocos que ela já ocupa apareciam como ocupados — e a única hora que
    a cliente de certeza não podia escolher era a que ela já tem. Pior
    ainda: nos dias cheios, as horas à volta da dela também caíam.
  */
  const semana = isoRange(day, 7).filter((d) => d <= lastDay)
  const porDia = await Promise.all(
    semana.map((d) =>
      availableSlots(unit, d, cart, 'online', new Date(), {
        excludeAppointmentId: appointment.id,
      }),
    ),
  )
  const mapa = new Map(semana.map((d, i) => [d, porDia[i]!]))
  const { slots } = mapa.get(day)!
  const mortos = new Set(
    semana.filter((d) => (mapa.get(d)?.slots.length ?? 0) === 0),
  )

  const grupos = [
    {
      label: dict.funnel.morning,
      horas: slots.filter((s) => s.minutesOfDay < 12 * 60),
    },
    {
      label: dict.funnel.afternoon,
      horas: slots.filter(
        (s) => s.minutesOfDay >= 12 * 60 && s.minutesOfDay < 18 * 60,
      ),
    },
    {
      label: dict.funnel.evening,
      horas: slots.filter((s) => s.minutesOfDay >= 18 * 60),
    },
  ].map((grupo) => ({
    label: grupo.label,
    horas: grupo.horas.map((s) => ({
      iso: s.startsAt.toISOString(),
      label: formatMinutes(s.minutesOfDay),
    })),
  }))

  const nomes = await serviceNamesFor(
    appointment.items.map((item) => item.service_id),
    language,
  )
  const servicos = appointment.items
    .map((item) => nomes.get(item.service_id) ?? item.service_name)
    .join(' · ')

  return (
    <div className="flex min-h-[78vh] flex-col">
      <header className="band-dark relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[40rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--gold) 34%, transparent), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-2xl px-5 py-10 text-center sm:px-8 sm:py-12">
          <Monogram className="text-4xl text-[var(--gold)] opacity-80" />
          <div className="mt-5 flex justify-center text-[var(--gold)] opacity-50">
            <Ornament />
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-14">
          {/* A saída sem mudar nada. Vem primeiro, em cima e à esquerda,
              onde se procura a porta de trás — e diz o que faz: fica
              como está. */}
          <Link
            href={`/m/${chave}`}
            className="link-slide inline-flex items-center gap-2 text-[0.8125rem] text-[var(--ink-muted)]"
          >
            <ArrowLeft size={14} />
            {dict.manage.keep}
          </Link>

          <div className="mt-5 mb-7">
            <p className="eyebrow eyebrow-gold">{unit.name}</p>
            <h1 className="display animate-rise mt-3 text-[1.75rem] leading-[1.15] sm:text-[2.25rem]">
              {dict.manage.rescheduleTitle}
            </h1>
            <p className="animate-fade delay-1 mt-2 text-[0.875rem] text-[var(--ink-muted)]">
              {dict.manage.rescheduleSubtitle}
            </p>
          </div>

          {/* O QUE ELA TEM HOJE, e que está prestes a trocar. Sem isto, a
              grelha de horas não diz de que marcação está a falar — e
              quem tem duas marcações não sabia qual ia mudar. */}
          <div className="border border-[var(--line-soft)] bg-[var(--surface-raised)] px-5 py-4">
            <p className="eyebrow text-[var(--ink-faint)]">
              {dict.funnel.yourVisit}
            </p>
            <p className="mt-2 text-[0.9375rem] text-[var(--ink)]">{servicos}</p>
            <p className="tabular mt-1 text-[0.8125rem] text-[var(--ink-muted)] first-letter:uppercase">
              {formatDayLong(
                isoDay(appointment.starts_at, unit.timezone),
                unit.timezone,
                language,
              )}
              {' · '}
              {formatTime(appointment.starts_at, unit.timezone, language)}
            </p>
          </div>

          <div className="mt-8">
            <DayStrip
              day={day}
              firstDay={firstDay}
              lastDay={lastDay}
              timezone={unit.timezone}
              language={language}
              dict={dict}
              href={(value) => `/m/${chave}/remarcar?d=${value}`}
              label={dict.funnel.steps.day}
              disabled={mortos}
            />
          </div>

          <div className="mt-8 flex items-baseline gap-4">
            <h2 className="display text-xl text-[var(--ink)] first-letter:uppercase">
              {formatDayLong(day, unit.timezone, language)}
            </h2>
            <span className="h-px flex-1 bg-[var(--line-soft)]" />
            {slots.length > 0 ? (
              <span className="tabular shrink-0 text-[0.6875rem] text-[var(--ink-faint)]">
                {slots.length} {dict.funnel.slotsAvailable}
              </span>
            ) : null}
          </div>

          <HorasParaRemarcar
            chave={chave}
            grupos={grupos}
            aviso={dict.manage.noSlots}
          />

          <div className="mt-10 flex justify-center text-[var(--line)]">
            <LeafRule className="w-40" />
          </div>
        </div>
      </div>
    </div>
  )
}
