import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, MapPin } from 'lucide-react'
import { getOrg, listUnits } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { Empty } from '@/components/ui'
import { FunnelShell } from '@/components/funnel-shell'
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
    <FunnelShell
      step={1}
      dict={dict}
      title={dict.funnel.storeTitle}
      subtitle={dict.funnel.storeSubtitle}
    >
      {units.length === 0 ? (
        <Empty title={dict.unit.noStores} hint={dict.unit.noStoresHint} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {units.map((unit) => (
            <Link
              key={unit.id}
              href={`/agendar/${unit.slug}`}
              className="lift group flex flex-col border border-[var(--line)] bg-[var(--surface-raised)] px-7 py-7"
            >
              {/* `self-start`: numa coluna flex a etiqueta esticava-se de
                  margem a margem e deixava de parecer uma etiqueta. */}
              <span className="self-start">
                <UnitStatusBadge unit={unit} dict={dict} language={language} />
              </span>
              <h2 className="display mt-4 text-2xl transition-colors group-hover:text-[var(--accent)]">
                {unit.name}
              </h2>
              {unit.address_line ? (
                <p className="mt-3 flex items-start gap-2 text-[0.875rem] leading-relaxed text-[var(--ink-muted)]">
                  <MapPin size={14} className="mt-1 shrink-0 text-[var(--ink-faint)]" />
                  <span>
                    {unit.address_line}
                    {unit.city ? `, ${unit.city}` : ''}
                  </span>
                </p>
              ) : null}
              <span className="link-slide mt-6 inline-flex items-center gap-1.5 self-start text-[0.8125rem] tracking-[0.06em] text-[var(--accent)] uppercase">
                {dict.funnel.storeAction}
                <ChevronRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </FunnelShell>
  )
}
