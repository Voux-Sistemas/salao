import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Phone } from 'lucide-react'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { chaveDa, getAppointment } from '@/lib/booking'
import { formatCents } from '@/lib/money'
import { formatDayLong, formatDuration, formatTime, isoDay } from '@/lib/time'
import { LogoStamp } from '@/components/brand'
import { BAND_GROUND } from '@/components/funnel-stage'
import { GuardarNoTelemovel } from '@/components/remarcar-forms'
import { formatPhone } from '@/lib/text'
import { serviceNamesFor } from '@/lib/catalog-names'
import { picksStaffOn } from '@/lib/sunday'
import { isUuid } from '@/lib/id'

type Params = { params: Promise<{ loja: string; id: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    // Este endereço tem o número de uma marcação de uma pessoa. É o único
    // do sítio público que aponta para alguém em concreto — fora do índice.
    title: dict.tabs.done,
    robots: { index: false, follow: false },
  }
}


/**
 * O recibo. É a última tela do funil e leva o caminho para a área de
 * conta — a partir daqui a cliente vê e cancela as suas marcações.
 *
 * No desenho do mockup «Marcação feita · delicado»: a faixa escura em
 * painel de cantos redondos, com o carimbo em pequeno, e por baixo um
 * bilhete claro com tudo o que ela precisa de saber para aparecer à
 * hora certa, no sítio certo. Os raminhos decorativos saíram.
 */
export default async function DonePage({ params }: Params) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()

  const [org, appointment, unit] = await Promise.all([
    requireOrg(),
    getAppointment(id),
    getUnitBySlug(loja),
  ])
  if (!appointment || appointment.unit_slug !== loja) notFound()

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  // O nome do serviço ficou congelado em português quando ela marcou —
  // é o que o balcão vai ler. Aqui manda-se vir o de fora: este bilhete
  // é dela.
  const names = await serviceNamesFor(
    appointment.items.map((item) => item.service_id),
    language,
  )

  const timezone = appointment.unit_timezone
  const day = isoDay(appointment.starts_at, timezone)
  const minutes = Math.round(
    (appointment.ends_at.getTime() - appointment.starts_at.getTime()) / 60_000,
  )

  const address = [unit?.address_line, unit?.postal_code, unit?.city]
    .filter(Boolean)
    .join(', ')
  const maps = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${appointment.unit_name}, ${address}`,
      )}`
    : null

  /*
    A chave vem numa pergunta à parte e não com a marcação: só esta
    página a usa, e enfiá-la no `getAppointment` fazia todas as outras
    do balcão pagarem por ela.
  */
  const chave = await chaveDa(appointment.id)

  /* Os prazos são da loja e a dona muda-os no Admin; a frase diz os que
     estão em vigor, e junta-os numa só quando são iguais. */
  const prazo = unit
    ? unit.reschedule_window_minutes === unit.cancel_window_minutes
      ? dict.funnel.changeUntil.replace(
          '{tempo}',
          formatDuration(unit.cancel_window_minutes, language),
        )
      : dict.funnel.changeUntilSplit
          .replace('{mudar}', formatDuration(unit.reschedule_window_minutes, language))
          .replace('{desmarcar}', formatDuration(unit.cancel_window_minutes, language))
    : null

  return (
    <div className="tabular flex min-h-[78vh] flex-col">
      {/* ------------------------------------------------- o carimbo --- */}
      <div className="mx-auto w-full max-w-[74.5rem] px-3 pt-2.5 sm:px-5 sm:pt-4">
        <header
          className="band-dark relative overflow-hidden rounded-[20px] px-[18px] py-5 text-center shadow-[inset_0_0_0_1px_rgba(211,184,126,0.14)] sm:rounded-[24px] sm:px-8 sm:pt-8 sm:pb-[34px]"
          style={{ background: BAND_GROUND }}
        >
          <LogoStamp className="mx-auto h-14 w-14 sm:h-[72px] sm:w-[72px]" />
          <h1 className="display display-italic animate-rise mt-3 text-[1.5625rem] leading-[1.1] sm:mt-[18px] sm:text-[2.25rem]">
            {dict.funnel.doneTitle}
          </h1>
          {/*
            A CONFIRMAÇÃO DIZ ONDE E QUANDO, E MAIS NADA.

            Viveu aqui uns dias uma saudação com emojis — «Olá, TESTE! 😊 …
            registada com sucesso ✨» — que gritava o nome em maiúsculas
            quando a ficha vinha assim e soava a sistema. A dona pediu uma
            confirmação a sério: está confirmado, onde, e a que horas.

            «No salão Maia» e não «na Maia»: a preposição muda de terra
            para terra («em Valongo», «na Maia»), e a frase tem de servir
            às lojas todas sem se enganar em nenhuma.
          */}
          <p className="animate-fade mx-auto mt-2 max-w-md text-[0.78125rem] leading-[18px] text-[var(--ink-muted)] sm:mt-2.5 sm:text-[0.875rem] sm:leading-5">
            {dict.funnel.doneSubtitle
              .replace('{loja}', appointment.unit_name)
              .replace('{dia}', formatDayLong(day, timezone, language))
              .replace('{hora}', formatTime(appointment.starts_at, timezone, language))}
          </p>
        </header>
      </div>

      {/* -------------------------------------------------- o bilhete --- */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-[35rem] px-3 pt-3 pb-12 sm:px-5 sm:pt-7 sm:pb-16">
          <div className="overflow-hidden rounded-[18px] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(34,29,23,0.03),0_14px_32px_-24px_rgba(34,29,23,0.28)] sm:rounded-[22px]">
            <Row label={dict.funnel.whenLabel}>
              <span className="display block text-[1.0625rem] leading-[1.2] text-[var(--ink)] first-letter:uppercase sm:text-xl">
                {formatDayLong(day, timezone, language)}
              </span>
              <span className="mt-[3px] block text-[0.875rem] font-semibold text-[var(--accent)]">
                {formatTime(appointment.starts_at, timezone, language)}
                <span className="font-normal text-[#8A7F6E]">
                  {' · '}
                  {formatDuration(minutes, language)}
                </span>
              </span>
            </Row>

            <Row label={dict.funnel.whereLabel}>
              <span className="display block text-[1.0625rem] leading-[1.2] text-[var(--ink)] sm:text-xl">
                {appointment.unit_name}
              </span>
              {address ? (
                <p className="mt-1 flex items-start gap-1.5 text-[0.78125rem] leading-[18px] text-[var(--ink-muted)]">
                  <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden />
                  {maps ? (
                    <a
                      href={maps}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-[rgba(142,111,65,0.35)] underline-offset-[3px] transition-colors hover:text-[var(--accent)]"
                    >
                      {address}
                    </a>
                  ) : (
                    <span>{address}</span>
                  )}
                </p>
              ) : null}
              {unit?.phone ? (
                <p className="mt-[3px] flex items-center gap-1.5 text-[0.78125rem] text-[var(--ink-muted)]">
                  <Phone size={13} className="shrink-0" aria-hidden />
                  <a
                    href={`tel:${unit.phone.replace(/\s/g, '')}`}
                    className="transition-colors hover:text-[var(--accent)]"
                  >
                    {formatPhone(unit.phone)}
                  </a>
                </p>
              ) : null}
            </Row>

            <Row label={dict.funnel.whatLabel}>
              <ul className="space-y-1.5">
                {appointment.items.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.875rem] leading-5 text-[var(--ink)]">
                        {names.get(item.service_id) ?? item.service_name}
                      </p>
                      <p className="text-[0.75rem] leading-[17px] text-[#8A7F6E]">
                        {formatTime(item.starts_at, timezone, language)}
                        {/* Ao domingo nao se diz «com quem»: a cliente nao
                            escolheu ninguem, e o nome que o motor arrumou
                            por dentro nao e uma promessa. */}
                        {picksStaffOn(day) ? (
                          <>
                            {' · '}
                            {dict.common.with} {item.staff_public_name}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className="shrink-0 text-[0.875rem] text-[var(--ink)]">
                      {formatCents(item.price_cents, org.currency, language)}
                    </span>
                  </li>
                ))}
              </ul>
            </Row>

            <div className="flex items-baseline justify-between bg-[rgba(198,169,107,0.07)] px-4 py-3 sm:px-6 sm:py-4">
              <span className="text-[0.8125rem] text-[var(--ink-muted)]">{dict.common.total}</span>
              <span className="text-lg font-semibold tracking-[-0.01em] text-[var(--ink)] sm:text-xl">
                {formatCents(appointment.total_cents, org.currency, language)}
              </span>
            </div>
          </div>

          {/*
            MUDAR OU DESMARCAR, SEM CÓDIGO.

            O botão principal levava a «Ver as minhas marcações», que dava
            na porta do código — e o código não tinha quem o enviasse. Agora
            abre a própria marcação, pela chave dela.

            O bloco «Guarde este link» saiu: a cliente já não precisa de o
            guardar. Este telemóvel lembra-se da marcação sozinho (é o
            `GuardarNoTelemovel`), e noutro telemóvel encontra-a pelo
            telemóvel e pelo primeiro nome, no botão «Remarcar».
          */}
          <GuardarNoTelemovel chave={chave} />
          <div className="mt-3 flex flex-col gap-2 sm:mt-[18px] sm:flex-row sm:gap-3">
            <Link
              href={chave ? `/m/${chave}` : '/remarcar'}
              className="botao sheen flex h-[46px] items-center justify-center rounded-full bg-[var(--action)] text-[0.90625rem] font-semibold tracking-[0.01em] text-[var(--action-ink)] shadow-[0_10px_22px_-14px_rgba(111,85,47,0.7)] transition-all duration-300 select-none hover:-translate-y-0.5 hover:bg-[var(--action-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px sm:h-12 sm:flex-1 sm:text-[0.9375rem]"
            >
              {dict.funnel.changeOrCancel}
            </Link>
            <Link
              href="/agendar"
              className="botao flex h-[46px] items-center justify-center rounded-full text-[0.90625rem] font-medium text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(111,85,47,0.3)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:h-12 sm:flex-1 sm:text-[0.9375rem]"
            >
              {dict.funnel.bookAnother}
            </Link>
          </div>

          {prazo ? (
            <p className="mt-2.5 text-center text-[0.75rem] leading-[17px] text-[#8A7F6E] sm:mt-3.5">
              {prazo}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Uma linha do bilhete: o rótulo em versaletes finos, e o que diz. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[rgba(34,29,23,0.06)] px-4 py-3 sm:px-6 sm:py-4">
      <p className="text-[0.625rem] leading-[13px] font-medium tracking-[0.18em] text-[var(--accent)] uppercase sm:text-[0.65625rem]">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
