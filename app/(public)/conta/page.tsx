import type { Metadata } from 'next'
import { pastBookings, upcomingBookings, type AccountBooking } from '@/lib/account'
import { requireClientActor } from '@/lib/auth/client-actor'
import { clientMayCancel } from '@/lib/booking'
import { getDictionary, getLanguage } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { formatCents } from '@/lib/money'
import { requireOrg } from '@/lib/org'
import { STATUS_TONE } from '@/lib/status'
import { formatDayLong, formatTime, isoDay } from '@/lib/time'
import { CancelBooking, DetailsForm, SignOut } from '@/components/account-forms'
import { Badge, ButtonLink, Divider, Empty, Eyebrow } from '@/components/ui'

export const metadata: Metadata = { title: 'A minha conta' }

/**
 * O QUE É DELA.
 *
 * As marcações que tem pela frente, o que já passou — e o histórico
 * atravessa as lojas, porque a ficha é uma só na rede — e os dados da
 * própria ficha. Nada mais: as notas internas são da equipa.
 */
export default async function ContaPage() {
  const client = await requireClientActor()
  const [org, dict, language] = await Promise.all([
    requireOrg(),
    getDictionary(),
    getLanguage(),
  ])

  const [upcoming, past] = await Promise.all([
    upcomingBookings(client.id),
    pastBookings(client.id),
  ])

  const now = new Date()

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="display text-3xl text-[var(--ink)]">
            {dict.account.title}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-[var(--ink-muted)]">
            {client.name}
          </p>
        </div>
        <SignOut label={dict.nav.signOut} />
      </header>

      {/* --- o que está pela frente ---------------------------------- */}
      <section className="mt-14">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>{dict.account.upcoming}</Eyebrow>
          <ButtonLink href="/agendar" size="sm" variant="outline">
            {dict.account.bookNow}
          </ButtonLink>
        </div>

        {upcoming.length === 0 ? (
          <div className="border border-[var(--line-soft)]">
            <Empty title={dict.account.noUpcoming} />
          </div>
        ) : (
          <div className="space-y-4">
            {upcoming.map((booking) => (
              <article
                key={booking.id}
                className="border border-[var(--line-soft)] bg-[var(--surface-raised)] px-5 py-5 sm:px-6"
              >
                <When booking={booking} language={language} />

                <p className="mt-3 text-[0.9375rem] text-[var(--ink)]">
                  {booking.services ?? '—'}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-[var(--ink-muted)]">
                  {booking.unit_name}
                  {booking.staff_names
                    ? ` · ${dict.common.with} ${booking.staff_names}`
                    : ''}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="tabular display text-lg text-[var(--ink)]">
                    {formatCents(booking.total_cents, org.currency, language)}
                  </span>

                  {clientMayCancel(
                    booking,
                    { cancel_window_hours: booking.cancel_window_hours },
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
            ))}
          </div>
        )}
      </section>

      {/* --- o que já passou ----------------------------------------- */}
      <section className="mt-14">
        <Eyebrow>{dict.account.past}</Eyebrow>

        {past.length === 0 ? (
          <p className="mt-3 text-[0.875rem] text-[var(--ink-faint)]">
            {dict.account.noPast}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
            {past.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
              >
                <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink-muted)]">
                  {formatDayLong(
                    isoDay(booking.starts_at, booking.timezone),
                    booking.timezone,
                    language,
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.875rem] text-[var(--ink)]">
                  {booking.services ?? '—'}
                </span>
                <Badge tone={STATUS_TONE[booking.status]}>
                  {dict.account.statusLabel[booking.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Divider className="mt-14" />

      {/* --- os dados ------------------------------------------------ */}
      <section className="mt-10">
        <Eyebrow>{dict.account.details}</Eyebrow>
        <div className="mt-4">
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
    </div>
  )
}

function When({
  booking,
  language,
}: {
  booking: AccountBooking
  language: Language
}) {
  const day = isoDay(booking.starts_at, booking.timezone)
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <span className="display text-lg text-[var(--ink)]">
        {formatDayLong(day, booking.timezone, language)}
      </span>
      <span className="tabular text-[var(--accent)]">
        {formatTime(booking.starts_at, booking.timezone, language)}
      </span>
    </div>
  )
}
