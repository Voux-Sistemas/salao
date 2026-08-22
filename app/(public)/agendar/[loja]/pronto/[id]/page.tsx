import { notFound } from 'next/navigation'
import { Check, MapPin, Phone } from 'lucide-react'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { getAppointment } from '@/lib/booking'
import { formatCents } from '@/lib/money'
import { formatDayLong, formatDuration, formatTime, isoDay } from '@/lib/time'
import { ButtonLink, Eyebrow } from '@/components/ui'
import { LeafRule, Ornament } from '@/components/brand'
import { formatPhone } from '@/lib/text'

type Params = { params: Promise<{ loja: string; id: string }> }

export const metadata = {
  // Este endereço tem o número de uma marcação de uma pessoa. É o único
  // do sítio público que aponta para alguém em concreto — fora do índice.
  title: 'Marcação feita',
  robots: { index: false, follow: false },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * O recibo. É a última tela do funil e leva o caminho para a área de
 * conta — a partir daqui a cliente vê e cancela as suas marcações.
 *
 * A tela é deliberadamente celebratória: faixa escura em cima com o
 * carimbo dourado, e por baixo um bilhete em porcelana com tudo o que
 * ela precisa de saber para aparecer à hora certa, no sítio certo.
 */
export default async function DonePage({ params }: Params) {
  const { loja, id } = await params
  if (!UUID.test(id)) notFound()

  const [org, appointment, unit] = await Promise.all([
    requireOrg(),
    getAppointment(id),
    getUnitBySlug(loja),
  ])
  if (!appointment || appointment.unit_slug !== loja) notFound()

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

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

  return (
    <div className="flex min-h-[78vh] flex-col">
      {/* ------------------------------------------------- o carimbo --- */}
      <header className="band-dark relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[46rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--gold) 38%, transparent), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <span className="animate-bloom mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_0_0_10px_color-mix(in_srgb,var(--gold)_12%,transparent)]">
            <Check size={26} strokeWidth={1.75} />
          </span>
          <h1 className="display display-italic animate-rise delay-1 mt-7 text-[2.1rem] leading-[1.1] sm:text-[2.75rem]">
            {dict.funnel.doneTitle}
          </h1>
          <p className="animate-fade delay-2 mt-4 text-[0.9375rem] text-[var(--ink-muted)]">
            {dict.funnel.doneSubtitle}
          </p>
          <div className="animate-fade delay-3 mt-8 flex justify-center text-[var(--gold)] opacity-60">
            <Ornament />
          </div>
        </div>
      </header>

      {/* -------------------------------------------------- o bilhete --- */}
      <div className="flex-1">
        <div className="mx-auto max-w-xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-warm)]">
            <div className="h-1 bg-[var(--accent)]" />

            <Row label={dict.funnel.whenLabel}>
              <span className="display block text-lg leading-snug text-[var(--ink)] first-letter:uppercase">
                {formatDayLong(day, timezone, language)}
              </span>
              <span className="tabular mt-1 block text-[var(--accent)]">
                {formatTime(appointment.starts_at, timezone, language)}
                {' · '}
                {formatDuration(minutes, language)}
              </span>
            </Row>

            <Row label={dict.funnel.whereLabel}>
              <span className="display block text-lg text-[var(--ink)]">
                {appointment.unit_name}
              </span>
              {address ? (
                <p className="mt-1.5 flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {maps ? (
                    <a
                      href={maps}
                      target="_blank"
                      rel="noreferrer"
                      className="link-slide"
                    >
                      {address}
                    </a>
                  ) : (
                    <span>{address}</span>
                  )}
                </p>
              ) : null}
              {unit?.phone ? (
                <p className="mt-1 flex items-center gap-2 text-[0.8125rem] text-[var(--ink-muted)]">
                  <Phone size={14} className="shrink-0" />
                  <a
                    href={`tel:${unit.phone.replace(/\s/g, '')}`}
                    className="tabular link-slide"
                  >
                    {formatPhone(unit.phone)}
                  </a>
                </p>
              ) : null}
            </Row>

            <Row label={dict.funnel.whatLabel}>
              <ul className="space-y-3">
                {appointment.items.map((item) => (
                  <li key={item.id}>
                    <div className="flex items-baseline gap-3">
                      <span className="text-[0.9375rem] text-[var(--ink)]">
                        {item.service_name}
                      </span>
                      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-[var(--line)]" />
                      <span className="tabular shrink-0 text-[0.875rem] text-[var(--ink)]">
                        {formatCents(item.price_cents, org.currency, language)}
                      </span>
                    </div>
                    <p className="tabular mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
                      {formatTime(item.starts_at, timezone, language)}
                      {' · '}
                      {dict.common.with} {item.staff_name}
                    </p>
                  </li>
                ))}
              </ul>
            </Row>

            <div className="flex items-baseline justify-between px-6 py-5">
              <Eyebrow>{dict.common.total}</Eyebrow>
              <span className="tabular display text-2xl text-[var(--ink)]">
                {formatCents(appointment.total_cents, org.currency, language)}
              </span>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/conta/entrar" size="lg">
              {dict.funnel.goToAccount}
            </ButtonLink>
            <ButtonLink href="/agendar" size="lg" variant="outline">
              {dict.funnel.bookAnother}
            </ButtonLink>
          </div>

          <div className="mt-12 flex justify-center text-[var(--line)]">
            <LeafRule className="w-40" />
          </div>
        </div>
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
