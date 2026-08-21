import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, MapPin } from 'lucide-react'
import { getOrg, listUnits } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { Empty, Eyebrow } from '@/components/ui'
import { FunnelSteps } from '@/components/funnel-steps'
import { UnitStatusBadge } from '@/components/unit-status-badge'

export const metadata = { title: 'Marcar' }

/**
 * Passo 1 — escolher a loja.
 *
 * A tela sem loja é um seletor, não uma tela vazia. Quem só tem uma
 * loja não devia ter de escolher nada: segue directo.
 */
export default async function ChooseStorePage() {
  const org = await getOrg()
  if (!org) redirect('/comecar')

  const [dict, language, units] = await Promise.all([
    getDictionary(),
    getLanguage(),
    listUnits(),
  ])

  const only = units.length === 1 ? units[0] : undefined
  if (only) redirect(`/agendar/${only.slug}`)

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-14 sm:py-20">
      <FunnelSteps current={1} dict={dict} />

      <h1 className="display mt-8 text-3xl sm:text-4xl">{dict.funnel.storeTitle}</h1>
      <p className="mt-3 text-[0.9375rem] text-[var(--ink-muted)]">
        {dict.funnel.storeSubtitle}
      </p>

      {units.length === 0 ? (
        <Empty title={dict.unit.noStores} hint={dict.unit.noStoresHint} />
      ) : (
        <div className="mt-10 divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
          {units.map((unit) => (
            <Link
              key={unit.id}
              href={`/agendar/${unit.slug}`}
              className="group flex items-center gap-5 py-6 transition-colors hover:bg-[var(--surface-raised)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="display text-xl group-hover:text-[var(--accent)] transition-colors">
                    {unit.name}
                  </h2>
                  <UnitStatusBadge unit={unit} dict={dict} language={language} />
                </div>
                {unit.address_line ? (
                  <p className="mt-2 flex items-start gap-2 text-[0.8125rem] text-[var(--ink-muted)]">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    <span>
                      {unit.address_line}
                      {unit.city ? `, ${unit.city}` : ''}
                    </span>
                  </p>
                ) : null}
              </div>
              <ChevronRight
                size={18}
                className="shrink-0 text-[var(--ink-faint)] transition-colors group-hover:text-[var(--accent)]"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
