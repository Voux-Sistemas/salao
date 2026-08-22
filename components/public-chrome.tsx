import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { getOrg, listUnits, type Unit } from '@/lib/org'
import { weeklyHours, type Window } from '@/lib/hours'
import { formatMinutes } from '@/lib/time'
import { getDictionary, getLanguage, type Dictionary } from '@/lib/i18n'
import { getClientActor } from '@/lib/auth/client-actor'
import { BRAND } from '@/lib/branding'
import { LanguageSwitcher } from '@/components/language-switcher'
import { LogoSeal, Ornament } from '@/components/brand'
import { ButtonLink } from '@/components/ui'
import { formatPhone } from '@/lib/text'

/**
 * A moldura da superfície pública: um cabeçalho fixo e fino, em vidro
 * fumado sobre o herói escuro (ou em porcelana translúcida nas páginas
 * interiores), e um rodapé rico em banda escura com as duas casas.
 */

/** "Seg–Sex · 09:00–19:00" — o horário da semana condensado em 2–3 linhas. */
function weekDigest(
  hours: Map<number, Window[]>,
  shortNames: readonly string[],
  closedLabel: string,
): { days: string; hours: string }[] {
  const ORDER = [1, 2, 3, 4, 5, 6, 0]
  const label = (windows: Window[]) =>
    windows.length === 0
      ? closedLabel
      : windows
          .map((w) => `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`)
          .join(' · ')

  const rows: { days: string; hours: string }[] = []
  let start = 0
  while (start < ORDER.length) {
    const signature = label(hours.get(ORDER[start]!) ?? [])
    let end = start
    while (
      end + 1 < ORDER.length &&
      label(hours.get(ORDER[end + 1]!) ?? []) === signature
    ) {
      end++
    }
    const days =
      start === end
        ? shortNames[ORDER[start]!]!
        : `${shortNames[ORDER[start]!]}–${shortNames[ORDER[end]!]}`
    rows.push({ days, hours: signature })
    start = end + 1
  }
  return rows
}

function mapsUrl(unit: Unit) {
  const address = [unit.address_line, unit.postal_code, unit.city]
    .filter(Boolean)
    .join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(address || unit.name)}`
}

async function FooterHouse({
  unit,
  dict,
}: {
  unit: Unit
  dict: Dictionary
}) {
  const digest = weekDigest(
    await weeklyHours(unit.id),
    dict.common.weekdaysShort,
    dict.unit.closedNow,
  )

  return (
    <div>
      <p className="display text-lg text-[var(--ink)]">{unit.name}</p>
      <div className="mt-4 space-y-1.5 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
        {unit.address_line ? (
          <p>
            {unit.address_line}
            <br />
            {[unit.postal_code, unit.city].filter(Boolean).join(' ')}
          </p>
        ) : null}
        {unit.phone ? (
          <p>
            <a
              href={`tel:${unit.phone.replace(/\s/g, '')}`}
              className="tabular transition-colors hover:text-[var(--ink)]"
            >
              {formatPhone(unit.phone)}
            </a>
          </p>
        ) : null}
        <p>
          <a
            href={mapsUrl(unit)}
            target="_blank"
            rel="noreferrer"
            className="link-slide text-[var(--accent)]"
          >
            {dict.unit.directions}
          </a>
        </p>
      </div>
      <dl className="mt-5 space-y-1 border-t border-[var(--line-soft)] pt-4 text-[0.75rem]">
        {digest.map((row) => (
          <div key={row.days} className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--ink-faint)]">{row.days}</dt>
            <dd className="tabular text-[var(--ink-muted)]">{row.hours}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export async function PublicChrome({
  children,
  compact = false,
  hero = false,
}: {
  children: ReactNode
  compact?: boolean
  /** Página com herói escuro no topo: o cabeçalho vira vidro fumado. */
  hero?: boolean
}) {
  const [org, dict, language, client, units] = await Promise.all([
    getOrg(),
    getDictionary(),
    getLanguage(),
    getClientActor(),
    listUnits(),
  ])

  const name = org?.name ?? BRAND.fallbackName
  const whatsapp =
    org?.whatsapp_phone ?? units.find((u) => u.whatsapp_phone)?.whatsapp_phone ?? null
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(dict.footer.whatsappMessage)}`
    : null
  const year = new Date().getFullYear()

  return (
    <div className="skin-salon flex min-h-screen flex-col bg-[var(--surface)]">
      {/* ------------------------------------------------ cabeçalho --- */}
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-50 border-b border-[var(--line-soft)] backdrop-blur-md',
          hero && 'band-dark',
        )}
        style={{
          background: hero
            ? 'color-mix(in srgb, var(--surface) 74%, transparent)'
            : 'color-mix(in srgb, var(--surface) 85%, transparent)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <LogoSeal size="sm" />
            <span className="display hidden text-[0.8125rem] uppercase tracking-[0.18em] text-[var(--ink)] transition-colors group-hover:text-[var(--accent)] min-[480px]:block sm:text-[0.9375rem]">
              {name}
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-1 sm:gap-4">
            {!compact ? (
              <Link
                href="/loja"
                className="link-slide hidden text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] md:block"
              >
                {dict.nav.stores}
              </Link>
            ) : null}

            <Link
              href={client ? '/conta' : '/conta/entrar'}
              className="link-slide hidden text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] sm:block"
            >
              {client ? dict.nav.account : dict.nav.signIn}
            </Link>

            <Suspense fallback={null}>
              <LanguageSwitcher current={language} />
            </Suspense>

            <ButtonLink href="/agendar" size="sm" variant="outline" className="ml-1">
              {dict.nav.book}
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main className={clsx('flex-1', !hero && 'pt-16')}>{children}</main>

      {/* --------------------------------------------------- rodapé --- */}
      <footer className="band-dark border-t border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-16 pb-10 sm:pt-20">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2 lg:pr-16">
              <LogoSeal size="lg" />
              <p className="display mt-5 text-lg uppercase tracking-[0.18em] text-[var(--ink)]">
                {name}
              </p>
              <p className="mt-4 max-w-xs text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                {dict.footer.tagline}
              </p>
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="link-slide mt-6 inline-block text-[0.8125rem] text-[var(--accent)]"
                >
                  {dict.footer.whatsapp}
                </a>
              ) : null}
            </div>

            {units.slice(0, 2).map((unit) => (
              <FooterHouse key={unit.id} unit={unit} dict={dict} />
            ))}
          </div>

          <div className="mt-14 text-center">
            <Ornament className="opacity-60" />
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-[var(--line-soft)] pt-6 sm:flex-row sm:items-center">
            <p className="text-[0.75rem] text-[var(--ink-faint)]">
              © {year} {BRAND.legalName}
            </p>
            <div className="flex items-center gap-5">
              <Link
                href="/entrar"
                className="text-[0.75rem] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)]"
              >
                {dict.footer.staffAccess}
              </Link>
              <Suspense fallback={null}>
                <LanguageSwitcher current={language} />
              </Suspense>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
