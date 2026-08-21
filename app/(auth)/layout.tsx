import Link from 'next/link'
import { getOrg } from '@/lib/org'
import { BRAND } from '@/lib/branding'

export const dynamic = 'force-dynamic'

/**
 * A porta da equipa. Pele clara, sem enfeites: isto não é montra, é
 * ferramenta. A área da equipa não é traduzida.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getOrg()

  return (
    <div className="skin-desk flex min-h-screen flex-col bg-[var(--surface)]">
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="display block text-center text-sm uppercase tracking-[0.18em] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
          >
            {org?.name ?? BRAND.fallbackName}
          </Link>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </div>
  )
}
