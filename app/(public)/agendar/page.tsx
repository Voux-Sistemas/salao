import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'
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
      title={dict.funnel.storeTitle}
      back={{ href: '/', label: dict.common.back }}
    >
      {units.length === 0 ? (
        <Empty title={dict.unit.noStores} hint={dict.unit.noStoresHint} />
      ) : (
        /*
          CARTÕES BAIXOS, COM A FOTOGRAFIA AO LADO.

          É a opção D do mockup «Loja no telemóvel», e a quarta tentativa
          deste ecrã. A linha com a etiqueta quadrada ficou pesada; os
          cartões com a fotografia em grande e o nome por cima ficaram
          enormes (e em Valongo o nome caía em cima do letreiro da loja); a
          lista com a foto num círculo ficou desproporcional — um círculo
          pequeno ao lado de três linhas de texto. Aqui a fotografia ocupa
          a altura toda do cartão, numa coluna à esquerda, sem nada escrito
          por cima, e o texto fica à direita.
        */
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
          {units.map((unit) => {
            const cover = covers.get(unit.id)
            // A cidade só se escreve quando não é o próprio nome da loja:
            // «Valongo» por cima de «…, Loja 07, Valongo» dizia-o duas vezes.
            const sameAsName =
              unit.city && unit.city.trim().toLowerCase() === unit.name.trim().toLowerCase()
            const address = [unit.address_line, sameAsName ? null : unit.city]
              .filter(Boolean)
              .join(', ')
            return (
              <Link
                key={unit.id}
                href={`/agendar/${unit.slug}`}
                className="group flex min-h-[104px] overflow-hidden rounded-[18px] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(34,29,23,0.03)] transition-[background-color,box-shadow] duration-200 outline-offset-2 hover:bg-[#FFFDF8] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:min-h-[120px] sm:rounded-[20px] sm:hover:shadow-[0_0_0_1px_rgba(142,111,65,0.24),0_8px_22px_-16px_rgba(34,29,23,0.28)]"
              >
                <span className="relative w-[104px] shrink-0 overflow-hidden bg-[#2A2420] sm:w-[140px]">
                  {cover ? (
                    <Photo
                      src={cover.url}
                      alt={cover.alt ?? unit.name}
                      className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <span className="absolute inset-0">
                      <PhotoFallback seed={unit.name} compact />
                    </span>
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-3 sm:px-5">
                  <span className="display block text-lg leading-[1.2] text-[var(--ink)] sm:text-xl">
                    {unit.name}
                  </span>
                  {address ? (
                    <span className="mt-0.5 line-clamp-2 text-[0.75rem] leading-4 text-[#8A7F6E] sm:text-[0.8125rem] sm:leading-[18px]">
                      {address}
                    </span>
                  ) : null}
                  <span className="mt-[5px] flex items-center justify-between gap-2 text-[#8A7F6E]">
                    <UnitStatusBadge unit={unit} dict={dict} language={language} variant="dot" />
                    <ChevronRight
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden
                      className="shrink-0 text-[#B3A68F] transition-colors group-hover:text-[var(--action-strong)]"
                    />
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </FunnelStage>
  )
}
