import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronRight, MapPin } from 'lucide-react'
import { getOrg, listUnitCovers, listUnits } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { Empty } from '@/components/ui'
import { FunnelStage } from '@/components/funnel-stage'
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
    <FunnelStage
      step={1}
      dict={dict}
      eyebrow={dict.funnel.eyebrow}
      title={dict.funnel.storeTitle}
      back={{ href: '/', label: dict.common.back }}
    >
      {units.length === 0 ? (
        <Empty title={dict.unit.noStores} hint={dict.unit.noStoresHint} />
      ) : (
        /*
          UMA LOJA POR CARTÃO, NO DESENHO DO MOCKUP «LOJA · DELICADO».

          No telemóvel cada loja é uma linha — a fotografia pequena, o
          nome, a morada e se está aberta — e as lojas cabem todas no
          primeiro ecrã. No monitor são cartões lado a lado com a
          fotografia em cima: escolher uma loja é escolher um sítio, e um
          sítio reconhece-se pela cara antes da morada.
        */
        <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 sm:gap-4">
          {units.map((unit) => {
            const cover = covers.get(unit.id)
            const address = [unit.address_line, unit.city].filter(Boolean).join(', ')
            return (
              <Link
                key={unit.id}
                href={`/agendar/${unit.slug}`}
                className="group flex items-center gap-3 rounded-[18px] bg-[var(--surface-raised)] py-2 pr-3.5 pl-2 shadow-[0_1px_2px_rgba(34,29,23,0.03)] transition-[background-color,box-shadow] duration-200 outline-offset-2 hover:bg-[#FFFDF8] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-[22px] sm:p-2.5 sm:hover:shadow-[0_0_0_1px_rgba(142,111,65,0.24),0_14px_32px_-22px_rgba(34,29,23,0.35)]"
              >
                <div className="size-[76px] shrink-0 overflow-hidden rounded-xl bg-[var(--surface)] sm:aspect-[16/9] sm:size-auto sm:w-full sm:rounded-[14px]">
                  {cover ? (
                    <Photo
                      src={cover.url}
                      alt={cover.alt ?? unit.name}
                      className="transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <>
                      <span className="block h-full sm:hidden">
                        <PhotoFallback seed={unit.name} compact />
                      </span>
                      <span className="hidden h-full sm:block">
                        <PhotoFallback seed={unit.name} />
                      </span>
                    </>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col sm:px-3 sm:pt-4 sm:pb-2.5">
                  <h2 className="display order-1 text-lg leading-[1.2] text-[var(--ink)] sm:order-2 sm:mt-2.5 sm:text-2xl">
                    {unit.name}
                  </h2>
                  {address ? (
                    <p className="order-2 mt-0.5 flex min-w-0 items-start gap-1.5 text-[0.71875rem] leading-4 text-[#8A7F6E] sm:order-3 sm:mt-1.5 sm:text-[0.8125rem] sm:leading-[19px]">
                      <MapPin size={13} className="mt-0.5 hidden shrink-0 sm:block" aria-hidden />
                      <span className="truncate sm:whitespace-normal">{address}</span>
                    </p>
                  ) : null}
                  {/* `self-start`: numa coluna flex a etiqueta esticava-se de
                      margem a margem e deixava de parecer uma etiqueta. */}
                  <span className="order-3 mt-1.5 self-start sm:order-1 sm:mt-0">
                    <UnitStatusBadge unit={unit} dict={dict} language={language} />
                  </span>
                  <span className="order-4 mt-4 hidden items-center justify-between sm:flex">
                    <span className="text-[0.84375rem] font-semibold text-[var(--accent)]">
                      {dict.funnel.storeAction}
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-full bg-[rgba(142,111,65,0.10)] text-[var(--action-strong)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-ink)]">
                      <ChevronRight size={15} strokeWidth={2} aria-hidden />
                    </span>
                  </span>
                </div>

                <ChevronRight
                  size={15}
                  strokeWidth={2}
                  aria-hidden
                  className="shrink-0 text-[#B3A68F] sm:hidden"
                />
              </Link>
            )
          })}
        </div>
      )}
    </FunnelStage>
  )
}
