import Link from 'next/link'
import { getDictionary } from '@/lib/i18n'
import { getOrg, listUnits } from '@/lib/org'
import { formatPhone } from '@/lib/text'

/**
 * A BARRA QUE NÃO SAI DO ECRÃ.
 *
 * Num telemóvel a decisão de marcar toma-se A MEIO da página — a olhar
 * para uma fotografia, a ver que a loja abre até às nove. Nesse momento
 * o botão do herói já saiu por cima e o do fim ainda vem longe, e quem
 * decidiu tem de ir procurá-lo. Uma decisão que exige procura é uma
 * decisão que se adia.
 *
 * SÓ NO TELEMÓVEL. No monitor a página inteira cabe à vista e uma barra
 * agarrada ao fundo seria uma tarja de publicidade em cima do trabalho.
 *
 * Ao lado, o telefone. Nem toda a gente quer marcar por ecrã: há quem
 * tenha uma pergunta primeiro, e essa pessoa ou liga ou fecha a página.
 */
export async function BookingBar() {
  const [dict, org, units] = await Promise.all([
    getDictionary(),
    getOrg(),
    listUnits(),
  ])

  // O telefone da casa: o da rede, ou o da primeira loja que tiver um.
  const phone =
    org?.whatsapp_phone ?? units.find((unit) => unit.phone)?.phone ?? null

  return (
    <div
      className="sticky bottom-0 z-40 border-t border-[var(--line-soft)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
      style={{
        background:
          'linear-gradient(to top, var(--surface) 72%, color-mix(in srgb, var(--surface) 80%, transparent))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-3">
        <Link
          href="/agendar"
          className="toque flex h-12 flex-1 items-center justify-center rounded-full bg-[var(--accent)] text-[0.9375rem] font-semibold text-[var(--accent-ink)]"
        >
          {dict.home.cta}
        </Link>

        {phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, '')}`}
            aria-label={`${dict.unit.phoneLabel} ${formatPhone(phone)}`}
            className="toque grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--accent)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="h-[1.15rem] w-[1.15rem]"
            >
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
            </svg>
          </a>
        ) : null}
      </div>
    </div>
  )
}
