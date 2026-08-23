import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronRight, MapPin } from 'lucide-react'
import { getOrg, listUnitCovers, listUnits } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { Empty } from '@/components/ui'
import { FunnelShell } from '@/components/funnel-shell'
import { UnitStatusBadge } from '@/components/unit-status-badge'
import { Photo, PhotoFallback } from '@/components/photo'

/*
 * O separador do browser é o único pedaço de ecrã que sobra quando ela
 * tem sete abas abertas. Segue o cookie da língua, como tudo o resto
 * daqui para dentro.
 *
 * As duas páginas que se colam numa conversa — a da loja e a de marcar
 * numa loja — não seguem: quem lê a pré-visualização é um robô sem
 * cookie, e essas ficam em português de propósito.
 */
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return { title: dict.tabs.book }
}

/**
 * Passo 1 — escolher a loja.
 *
 * A tela sem loja é um seletor, não uma tela vazia. Quem só tem uma
 * loja não devia ter de escolher nada: segue directo.
 */
export default async function ChooseStorePage() {
  const org = await getOrg()
  if (!org) redirect('/comecar')

  const [dict, language, units, covers] = await Promise.all([
    getDictionary(),
    getLanguage(),
    listUnits(),
    listUnitCovers(),
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
          {units.map((unit) => {
            const cover = covers.get(unit.id)
            return (
              <Link
                key={unit.id}
                href={`/agendar/${unit.slug}`}
                className="lift group flex flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface-raised)]"
              >
                {/* Escolher entre duas lojas é escolher um sítio, e um
                    sítio reconhece-se pela cara — não pela morada. A foto
                    vem antes de tudo o resto por isso mesmo. */}
                <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--surface)]">
                  {cover ? (
                    <Photo
                      src={cover.url}
                      alt={cover.alt ?? unit.name}
                      className="transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <PhotoFallback seed={unit.name} />
                  )}
                </div>

                <div className="flex flex-1 flex-col px-7 py-7">
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
                      <MapPin
                        size={14}
                        className="mt-1 shrink-0 text-[var(--ink-faint)]"
                      />
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
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </FunnelShell>
  )
}
