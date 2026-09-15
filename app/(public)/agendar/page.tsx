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
          UMA LOJA POR CARTÃO, COM A FOTOGRAFIA EM GRANDE.

          É a opção B do mockup «Loja no telemóvel». A primeira versão era
          uma linha com a foto pequena, uma etiqueta quadrada «ABRE ÀS
          09:00» em maiúsculas e a morada cortada com reticências — e no
          telemóvel a casa achou-a grotesca. Aqui a fotografia do salão
          ocupa o cartão, com o nome e o horário por cima, e a morada
          inteira por baixo. Escolher uma loja é escolher um sítio, e um
          sítio reconhece-se pela cara antes da morada.

          O véu escuro no fundo da fotografia é o que deixa ler o nome em
          branco sobre qualquer foto, clara ou escura.
        */
        <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 sm:gap-4">
          {units.map((unit) => {
            const cover = covers.get(unit.id)
            const address = [unit.address_line, unit.city].filter(Boolean).join(', ')
            return (
              <Link
                key={unit.id}
                href={`/agendar/${unit.slug}`}
                className="group overflow-hidden rounded-[20px] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgba(34,29,23,0.03)] transition-shadow duration-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:rounded-[22px] sm:hover:shadow-[0_0_0_1px_rgba(142,111,65,0.24),0_14px_32px_-22px_rgba(34,29,23,0.35)]"
              >
                <div className="relative h-[150px] overflow-hidden bg-[#2A2420] sm:aspect-[16/9] sm:h-auto">
                  {cover ? (
                    <Photo
                      src={cover.url}
                      alt={cover.alt ?? unit.name}
                      className="transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <PhotoFallback seed={unit.name} />
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,16,9,0)_35%,rgba(20,16,9,0.78)_100%)]"
                  />
                  <div className="absolute inset-x-3.5 bottom-3 flex items-end justify-between gap-3 sm:inset-x-5 sm:bottom-4">
                    <h2 className="display min-w-0 text-[1.375rem] leading-[1.1] text-[#F7F2E8] sm:text-[1.75rem]">
                      {unit.name}
                    </h2>
                    <span className="shrink-0 pb-0.5 text-[#EDE6D8]">
                      <UnitStatusBadge unit={unit} dict={dict} language={language} variant="dot" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 px-3.5 pt-2.5 pb-3 sm:px-5 sm:py-3.5">
                  <p className="min-w-0 flex-1 text-[0.75rem] leading-4 text-[#8A7F6E] sm:text-[0.8125rem] sm:leading-[19px]">
                    {address}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[0.78125rem] font-semibold text-[var(--accent)] transition-colors group-hover:text-[var(--action-strong)] sm:text-[0.84375rem]">
                    {dict.funnel.storeAction}
                    <ChevronRight size={14} strokeWidth={2} aria-hidden />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </FunnelStage>
  )
}
