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
          AS LOJAS COMO AS PROFISSIONAIS: UMA LISTA SÓ.

          É a opção C do mockup «Loja no telemóvel». Passou por duas antes:
          uma linha com etiqueta quadrada em maiúsculas e a morada cortada,
          e cartões com a fotografia em grande e o nome por cima — que
          ficavam enormes, e em Valongo o nome caía em cima do próprio
          letreiro da loja. Aqui é o desenho do passo seguinte: no
          telemóvel um painel com um fio entre as lojas, e a fotografia
          num círculo pequeno; no monitor um cartão por loja, lado a lado.
        */
        <>
          <div className="flex items-center gap-2.5 px-1 sm:gap-3.5 sm:px-0">
            <h2 className="text-[0.625rem] leading-3 font-medium tracking-[0.18em] whitespace-nowrap text-[var(--accent)] uppercase sm:text-[0.6875rem] sm:leading-[14px]">
              {dict.funnel.storeList}
            </h2>
            <span
              aria-hidden
              className="h-px flex-1"
              style={{
                background: 'linear-gradient(90deg, rgba(198,169,107,0.4), rgba(198,169,107,0))',
              }}
            />
          </div>

          <ul className="mt-2.5 overflow-hidden rounded-[18px] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:mt-3.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:rounded-none sm:bg-transparent sm:shadow-none">
            {units.map((unit, index) => {
              const cover = covers.get(unit.id)
              const address = [unit.address_line, unit.city].filter(Boolean).join(', ')
              return (
                <li key={unit.id}>
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className="ml-[72px] block h-px bg-[rgba(34,29,23,0.06)] sm:hidden"
                    />
                  ) : null}
                  <Link
                    href={`/agendar/${unit.slug}`}
                    className="group flex items-center gap-3 py-3 pr-4 pl-3 transition-[background-color,box-shadow] duration-200 outline-offset-2 hover:bg-[#FFFDF8] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:gap-3.5 sm:rounded-[18px] sm:bg-[var(--surface-raised)] sm:py-3.5 sm:pr-[18px] sm:pl-3.5 sm:hover:shadow-[0_0_0_1px_rgba(142,111,65,0.24),0_8px_22px_-16px_rgba(34,29,23,0.28)]"
                  >
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-[#F3EBDA] sm:size-14">
                      {cover ? (
                        <Photo src={cover.url} alt={cover.alt ?? unit.name} />
                      ) : (
                        <PhotoFallback seed={unit.name} compact />
                      )}
                      {/* O fio dourado vai por cima da fotografia, e escurece no hover. */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(198,169,107,0.45)] transition-shadow group-hover:shadow-[inset_0_0_0_1px_#A88A57]"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="display block text-[1.0625rem] leading-[1.2] text-[var(--ink)] sm:text-lg">
                        {unit.name}
                      </span>
                      {address ? (
                        <span className="mt-px block text-[0.75rem] leading-4 text-[#8A7F6E]">
                          {address}
                        </span>
                      ) : null}
                      <span className="mt-[3px] block text-[#8A7F6E]">
                        <UnitStatusBadge unit={unit} dict={dict} language={language} variant="dot" />
                      </span>
                    </span>

                    <ChevronRight
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden
                      className="shrink-0 text-[#B3A68F] transition-colors group-hover:text-[var(--action-strong)]"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </FunnelStage>
  )
}
