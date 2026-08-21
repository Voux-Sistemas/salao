import { notFound } from 'next/navigation'
import { Check } from 'lucide-react'
import { requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { getAppointment } from '@/lib/booking'
import { formatCents } from '@/lib/money'
import { formatDayLong, formatDuration, formatTime, isoDay } from '@/lib/time'
import { ButtonLink, Eyebrow } from '@/components/ui'

type Params = { params: Promise<{ loja: string; id: string }> }

export const metadata = { title: 'Marcação feita' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * O recibo. É a última tela do funil e leva o caminho para a área de
 * conta — a partir daqui a cliente vê e cancela as suas marcações.
 */
export default async function DonePage({ params }: Params) {
  const { loja, id } = await params
  if (!UUID.test(id)) notFound()

  const [org, appointment] = await Promise.all([requireOrg(), getAppointment(id)])
  if (!appointment || appointment.unit_slug !== loja) notFound()

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  const timezone = appointment.unit_timezone
  const day = isoDay(appointment.starts_at, timezone)
  const minutes = Math.round(
    (appointment.ends_at.getTime() - appointment.starts_at.getTime()) / 60_000,
  )

  return (
    <div className="mx-auto max-w-xl px-5 sm:px-8 py-20 sm:py-28">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
          <Check size={18} />
        </span>
        <h1 className="display text-3xl">{dict.funnel.doneTitle}</h1>
      </div>
      <p className="mt-3 text-[0.9375rem] text-[var(--ink-muted)]">
        {dict.funnel.doneSubtitle}
      </p>

      <div className="mt-10 border border-[var(--line-soft)] bg-[var(--surface-raised)]">
        <Row label={dict.funnel.whenLabel}>
          <span className="display text-lg text-[var(--ink)]">
            {formatDayLong(day, timezone, language)}
          </span>
          <span className="tabular block text-[var(--accent)]">
            {formatTime(appointment.starts_at, timezone, language)}
            {' · '}
            {formatDuration(minutes, language)}
          </span>
        </Row>

        <Row label={dict.funnel.whereLabel}>
          <span className="text-[0.9375rem] text-[var(--ink)]">
            {appointment.unit_name}
          </span>
        </Row>

        <Row label={dict.funnel.whatLabel}>
          <ul className="space-y-2">
            {appointment.items.map((item) => (
              <li key={item.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.9375rem] text-[var(--ink)]">
                    {item.service_name}
                  </span>
                  <span className="tabular text-[0.875rem] text-[var(--ink-muted)]">
                    {formatCents(item.price_cents, org.currency, language)}
                  </span>
                </div>
                <p className="tabular text-[0.75rem] text-[var(--ink-faint)]">
                  {formatTime(item.starts_at, timezone, language)}
                  {' · '}
                  {dict.common.with} {item.staff_name}
                </p>
              </li>
            ))}
          </ul>
        </Row>

        <div className="flex items-baseline justify-between px-6 py-5">
          <span className="text-[0.8125rem] text-[var(--ink-muted)]">
            {dict.common.total}
          </span>
          <span className="tabular display text-xl text-[var(--ink)]">
            {formatCents(appointment.total_cents, org.currency, language)}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/conta/entrar" size="lg">
          {dict.funnel.goToAccount}
        </ButtonLink>
        <ButtonLink href="/agendar" size="lg" variant="outline">
          {dict.funnel.bookAnother}
        </ButtonLink>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--line-soft)] px-6 py-5">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </div>
  )
}
