import type { Metadata } from 'next'
import Link from 'next/link'
import { getOrg, listUnits } from '@/lib/org'
import { BRAND } from '@/lib/branding'
import { LogoMark, LogoSeal, Monogram, Ornament } from '@/components/brand'

export const dynamic = 'force-dynamic'

// A porta da equipa não se anuncia. Desce a tudo o que está por baixo.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * A porta da equipa. Metade esquerda: a casa — carvão quente, o
 * logótipo, uma frase. Metade direita: porcelana e o formulário, mais
 * nada. No telemóvel a casa encolhe para uma faixa de topo.
 * A área da equipa não é traduzida.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [org, units] = await Promise.all([getOrg(), listUnits()])
  const name = org?.name ?? BRAND.fallbackName
  const places = units.map((unit) => unit.name).join(' · ')

  return (
    <div className="skin-salon flex min-h-screen flex-col bg-[var(--surface)] lg:flex-row">
      {/* ----------------------------------------------------------------
          A banda escura: a casa apresenta-se.
          ---------------------------------------------------------------- */}
      <aside className="band-dark relative overflow-hidden lg:w-[46%]">
        {/* Monograma gigante a sair da moldura, como marca de água. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-14 hidden select-none lg:block"
        >
          <Monogram className="text-[16rem] text-[var(--accent)] opacity-[0.05]" />
        </span>

        {/* Telemóvel: faixa compacta. */}
        <div className="relative flex items-center justify-center gap-4 px-6 py-5 lg:hidden">
          <LogoSeal size="md" className="animate-bloom" />
          <div className="animate-fade min-w-0 text-left">
            <Link
              href="/"
              className="display block truncate text-lg leading-snug text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
            >
              {name}
            </Link>
            <p className="eyebrow eyebrow-gold mt-0.5">
              {BRAND.fallbackTagline}
            </p>
          </div>
        </div>

        {/* Ecrã largo: a casa inteira. */}
        <div className="relative hidden min-h-screen flex-col items-center justify-between px-10 py-12 text-center lg:flex">
          <Link
            href="/"
            className="eyebrow animate-fade transition-colors hover:text-[var(--accent)]"
          >
            Voltar à montra
          </Link>

          <div className="flex flex-col items-center">
            <LogoMark size="xl" className="animate-bloom" />
            <h2 className="display animate-rise delay-2 mt-12 max-w-md text-[2.75rem] leading-[1.1] text-[var(--ink)]">
              A casa começa{' '}
              <span className="display-italic text-[var(--accent)]">aqui</span>.
            </h2>
            <Ornament className="animate-fade delay-4 mt-10" />
          </div>

          <p className="eyebrow animate-fade delay-5">
            {places || BRAND.fallbackTagline}
          </p>
        </div>
      </aside>

      {/* ----------------------------------------------------------------
          A porcelana: só o formulário.
          ---------------------------------------------------------------- */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:py-16">
        <div className="animate-rise w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
