import type { Metadata } from 'next'
import { CalendarPlus, ChevronDown, MapPin } from 'lucide-react'
import { pastBookings, upcomingBookings, type AccountBooking } from '@/lib/account'
import { requireClientActor } from '@/lib/auth/client-actor'
import { clientMayCancel } from '@/lib/booking'
import { getDictionary, getLanguage } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { formatCents } from '@/lib/money'
import { requireOrg } from '@/lib/org'
import { STATUS_TONE } from '@/lib/status'
import { formatPhone } from '@/lib/text'
import {
  formatDayLong,
  formatMonthShort,
  formatTime,
  formatWeekdayShort,
  isoDay,
} from '@/lib/time'
import { CancelBooking, DetailsForm, SignOut } from '@/components/account-forms'
import { Badge, ButtonLink, Eyebrow } from '@/components/ui'
import { Monogram, Ornament } from '@/components/brand'
import { Reveal } from '@/components/reveal'

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.tabs.account,
    robots: { index: false, follow: false },
  }
}

/**
 * O QUE É DELA.
 *
 * As marcações que tem pela frente, o que já passou — e o histórico
 * atravessa as lojas, porque a ficha é uma só na rede — e os dados da
 * própria ficha. Nada mais: as notas internas são da equipa.
 *
 * A tela abre com a mesma faixa escura do funil, para que a área de
 * conta não pareça outro sítio: é a mesma casa, do lado de dentro.
 */
export default async function ContaPage() {
  const client = await requireClientActor()
  const [org, dict, language] = await Promise.all([
    requireOrg(),
    getDictionary(),
    getLanguage(),
  ])

  const [upcoming, past] = await Promise.all([
    upcomingBookings(client.id, language),
    pastBookings(client.id, language),
  ])

  const now = new Date()

  /* As últimas seis ficam à vista; o resto dobra-se. */
  const recentPast = past.slice(0, 6)
  const olderPast = past.slice(6)

  return (
    <div className="flex min-h-[78vh] flex-col">
      {/* ------------------------------------------------- a chegada --- */}
      <header className="band-dark relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[44rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--gold) 34%, transparent), transparent 70%)',
          }}
        />
        <div className="relative mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-6 px-5 pt-12 pb-10 sm:px-8 sm:pt-16 sm:pb-12">
          <div className="min-w-0">
            <p className="eyebrow eyebrow-gold">{dict.account.title}</p>
            <h1 className="display animate-rise mt-3 text-[1.9rem] leading-[1.12] sm:text-[2.5rem]">
              {client.name}
            </h1>
            <p className="tabular animate-fade delay-1 mt-2 text-[0.875rem] text-[var(--ink-muted)]">
              {formatPhone(client.phone)}
            </p>
          </div>
          <SignOut label={dict.nav.signOut} />
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          {/* --- o que está pela frente ------------------------------- */}
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Eyebrow>{dict.account.upcoming}</Eyebrow>
                <span className="h-px flex-1 bg-[var(--line-soft)]" />
              </div>
              <ButtonLink href="/agendar" size="sm">
                {dict.account.bookNow}
              </ButtonLink>
            </div>

            {upcoming.length === 0 ? (
              <div className="border border-[var(--line-soft)] bg-[var(--surface-raised)] px-6 py-12 text-center">
                <div className="flex justify-center text-[var(--line)]">
                  <Monogram className="text-5xl" />
                </div>
                <p className="display mt-5 text-lg text-[var(--ink)]">
                  {dict.account.noUpcoming}
                </p>
                <div className="mt-6 flex justify-center">
                  <ButtonLink href="/agendar">
                    <CalendarPlus size={15} />
                    {dict.account.bookNow}
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {upcoming.map((booking, index) => (
                  <Reveal key={booking.id} delay={index * 70}>
                    <article className="lift border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
                      <div className="flex gap-5 px-5 py-5 sm:px-6">
                        <DayBlock booking={booking} language={language} />

                        <div className="min-w-0 flex-1">
                          <p className="tabular text-[var(--accent)]">
                            {formatTime(
                              booking.starts_at,
                              booking.timezone,
                              language,
                            )}
                            {' – '}
                            {formatTime(booking.ends_at, booking.timezone, language)}
                          </p>
                          <p className="display mt-1 text-lg leading-snug text-[var(--ink)]">
                            {booking.services ?? '—'}
                          </p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-[var(--ink-muted)]">
                            <MapPin size={13} className="shrink-0" />
                            {booking.unit_name}
                            {booking.staff_names ? (
                              <span className="text-[var(--ink-faint)]">
                                · {dict.common.with} {booking.staff_names}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] px-5 py-3.5 sm:px-6">
                        <span className="tabular display text-lg text-[var(--ink)]">
                          {formatCents(booking.total_cents, org.currency, language)}
                        </span>

                        {clientMayCancel(
                          booking,
                          { cancel_window_minutes: booking.cancel_window_minutes },
                          now,
                        ) ? (
                          <CancelBooking
                            appointmentId={booking.id}
                            labels={{
                              cancel: dict.account.cancelBooking,
                              confirm: dict.account.cancelConfirm,
                              back: dict.common.close,
                            }}
                          />
                        ) : (
                          <p className="text-[0.75rem] text-[var(--ink-faint)]">
                            {dict.account.cancelTooLate}
                          </p>
                        )}
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            )}
          </section>

          {/* --- o que já passou -------------------------------------- */}
          <section className="mt-14">
            <div className="mb-5 flex items-center gap-3">
              <Eyebrow>{dict.account.past}</Eyebrow>
              <span className="h-px flex-1 bg-[var(--line-soft)]" />
              {past.length > 0 ? (
                <span className="tabular shrink-0 text-[0.6875rem] text-[var(--ink-faint)]">
                  {past.length}
                </span>
              ) : null}
            </div>

            {past.length === 0 ? (
              <p className="text-[0.875rem] text-[var(--ink-faint)]">
                {dict.account.noPast}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
                  {recentPast.map((booking) => (
                    <PastLine
                      key={booking.id}
                      booking={booking}
                      currency={org.currency}
                      language={language}
                      label={dict.account.statusLabel[booking.status]}
                    />
                  ))}
                </ul>

                {/* Quem cá vem há anos traz uma lista comprida: o resto
                    fica dobrado atrás de um <details>, sem uma linha de
                    JavaScript. */}
                {olderPast.length > 0 ? (
                  <details className="group">
                    <summary className="link-slide inline-flex cursor-pointer list-none items-center gap-2 py-3.5 text-[0.8125rem] text-[var(--ink-muted)] marker:content-none">
                      <ChevronDown
                        size={14}
                        className="transition-transform group-open:rotate-180"
                      />
                      {dict.account.olderPast} ({olderPast.length})
                    </summary>
                    <ul className="divide-y divide-[var(--line-soft)] border-t border-[var(--line-soft)]">
                      {olderPast.map((booking) => (
                        <PastLine
                          key={booking.id}
                          booking={booking}
                          currency={org.currency}
                          language={language}
                          label={dict.account.statusLabel[booking.status]}
                        />
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            )}
          </section>

          {/* --- os dados --------------------------------------------- */}
          <section className="mt-14">
            <div className="mb-5 flex items-center gap-3">
              <Eyebrow>{dict.account.details}</Eyebrow>
              <span className="h-px flex-1 bg-[var(--line-soft)]" />
            </div>

            <div className="border border-[var(--line-soft)] bg-[var(--surface-raised)] px-5 py-6 sm:px-6">
              <DetailsForm
                client={{
                  name: client.name,
                  email: client.email,
                  phone: client.phone,
                  language: client.language,
                }}
                labels={{
                  name: dict.funnel.nameLabel,
                  email: dict.account.emailLabel,
                  optional: dict.common.optional,
                  phone: dict.account.phoneLabel,
                  phoneFixed: dict.account.phoneFixed,
                  language: dict.nav.language,
                  save: dict.common.save,
                }}
              />
            </div>
          </section>

          <div className="mt-14 flex justify-center text-[var(--line)]">
            <Ornament />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Uma linha do que já passou: dia, serviço, valor e como acabou. */
function PastLine({
  booking,
  currency,
  language,
  label,
}: {
  booking: AccountBooking
  currency: string
  language: Language
  label: string
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3.5">
      <span className="tabular w-full shrink-0 text-[0.75rem] text-[var(--ink-faint)] sm:w-44">
        {formatDayLong(
          isoDay(booking.starts_at, booking.timezone),
          booking.timezone,
          language,
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.875rem] text-[var(--ink)]">
        {booking.services ?? '—'}
      </span>
      <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink-muted)]">
        {formatCents(booking.total_cents, currency, language)}
      </span>
      <Badge tone={STATUS_TONE[booking.status]}>{label}</Badge>
    </li>
  )
}

/** O bloco de calendário à esquerda de cada marcação. */
function DayBlock({
  booking,
  language,
}: {
  booking: AccountBooking
  language: Language
}) {
  const day = isoDay(booking.starts_at, booking.timezone)
  return (
    <div className="w-[3.75rem] shrink-0 border-r border-[var(--line-soft)] pr-4 text-center">
      <p className="text-[0.5625rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        {formatWeekdayShort(day, booking.timezone, language)}
      </p>
      <p className="display mt-1 text-[1.75rem] leading-none text-[var(--ink)]">
        {day.slice(8, 10)}
      </p>
      <p className="mt-1 text-[0.5625rem] uppercase tracking-[0.14em] text-[var(--accent)]">
        {formatMonthShort(day, booking.timezone, language)}
      </p>
    </div>
  )
}
