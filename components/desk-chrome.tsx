import type { ReactNode } from 'react'
import Link from 'next/link'
import { getOrg } from '@/lib/org'
import { BRAND } from '@/lib/branding'
import { can, requireActor, type Actor } from '@/lib/auth/actor'
import { signOutAction } from '@/app/(auth)/entrar/actions'
import { formatDayLong, today } from '@/lib/time'
import { initial } from '@/lib/text'
import { DeskNav, type NavItem } from '@/components/desk-nav'
import { Monogram } from '@/components/brand'
import { IconSignOut } from '@/components/desk-icons'

/**
 * A MOLDURA DA OPERAÇÃO — o ecrã onde a equipa vive o dia inteiro.
 *
 * No ecrã largo: uma coluna estreita à esquerda com o monograma e os
 * ícones da casa; em cima, uma fita fina com o dia por extenso, o nome
 * da casa e quem está ligado. No telemóvel: barra fixa no fundo, com
 * quatro ou cinco portas.
 *
 * A área da equipa NÃO é traduzida — fala pt-PT.
 */
export async function DeskChrome({ children }: { children: ReactNode }) {
  const actor = await requireActor()
  const org = await getOrg()

  const home = actor.role === 'professional' ? '/agenda' : '/'
  const houseName = org?.name ?? BRAND.fallbackName
  const tz = org?.timezone ?? 'Europe/Lisbon'
  const dayLabel = capitalise(formatDayLong(today(tz), tz))

  return (
    <div className="skin-desk min-h-dvh bg-[var(--surface)] text-[var(--ink)]">
      {/* A coluna da casa — só no ecrã largo. ------------------------ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[4.5rem] flex-col border-r border-[var(--line-soft)] bg-[var(--surface-raised)] lg:flex">
        {/* O monograma é a única coisa aqui pintada com o ouro do
            logótipo. Tudo o resto na coluna é ferramenta e vai a azul;
            este é a assinatura da casa, e é o que faz a coluna do
            balcão pertencer ao mesmo sítio que a montra. */}
        <Link
          href={home}
          title={houseName}
          className="flex h-14 w-full shrink-0 items-center justify-center border-b border-[var(--line-soft)] text-[var(--house)] transition-colors hover:text-[var(--accent)]"
        >
          <Monogram className="text-xl text-current" />
        </Link>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <DeskNav items={navFor(actor)} variant="rail" />
        </div>

        <form action={signOutAction} className="w-full shrink-0">
          <button
            type="submit"
            className="flex w-full flex-col items-center gap-1.5 border-t border-[var(--line-soft)] py-4 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
          >
            <IconSignOut className="h-5 w-5" />
            <span className="text-[0.625rem] font-semibold">Sair</span>
          </button>
        </form>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-[4.5rem]">
        {/* A fita de cima: o dia, a casa, a pessoa. ------------------ */}
        {/* Vidro fosco em vez de branco chapado: a lista passa por
            baixo e vê-se que passa. Numa agenda que se rola o dia
            inteiro, saber que ainda há conteúdo acima vale mais do que
            a barra ser opaca. */}
        <header className="sticky top-0 z-30 border-b border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--surface-raised)_78%,transparent)] backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:gap-5 sm:px-6">
            <Link
              href={home}
              aria-label={houseName}
              className="shrink-0 text-[var(--house)] transition-colors hover:text-[var(--accent)] lg:hidden"
            >
              <Monogram className="text-xl text-current" />
            </Link>

            <div className="min-w-0 flex-1 leading-tight">
              <p className="display truncate text-[0.9375rem] text-[var(--ink)]">
                {dayLabel}
              </p>
              <p className="hidden truncate text-[0.75rem] text-[var(--ink-faint)] sm:block">
                {houseName}
              </p>
            </div>

            <AccountMenu actor={actor} />
          </div>
        </header>

        {/* Folga em baixo para a barra do telemóvel. Entra também a
            faixa do indicador do iPhone: a barra assenta no fundo do
            ecrã e cresce por cima dela, portanto tapa mais do que os
            4,5rem do seu corpo. */}
        <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>

      {/* A barra do fundo — só no telemóvel. ------------------------- */}
      <nav
        aria-label="Navegação principal"
        // Sem altura: quem a define é o DeskNav, que a soma à folga do
        // indicador do iPhone. Com `h-[4.5rem]` aqui, essa folga era
        // descontada aos ícones em vez de acrescentada por baixo.
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[0_-8px_24px_-18px_rgba(15,21,32,0.28)] lg:hidden"
      >
        <DeskNav items={mobileNavFor(actor)} variant="bottom" />
      </nav>
    </div>
  )
}

/**
 * Hoje · Agenda · Avisos · Caixa · Clientes · Gestão.
 *
 * A profissional vê duas portas: a agenda dela e os avisos das clientes
 * que marcaram com ela. Sem caixa, sem clientes, sem gestão — e é este
 * par que a barra do telemóvel mostra inteiro.
 */
export function navFor(actor: Actor): NavItem[] {
  if (actor.role === 'professional') {
    return [
      { href: '/agenda', label: 'A minha agenda', short: 'Agenda', icon: 'agenda' },
      { href: '/avisos', label: 'Os meus avisos', short: 'Avisos', icon: 'avisos' },
    ]
  }

  const items: NavItem[] = [
    { href: '/', label: 'Hoje', icon: 'hoje' },
    { href: '/agenda', label: 'Agenda', icon: 'agenda' },
  ]
  if (can.seeNotices(actor)) {
    items.push({ href: '/avisos', label: 'Avisos', icon: 'avisos' })
  }
  if (can.seeCash(actor)) {
    items.push({ href: '/caixa', label: 'Caixa', icon: 'caixa' })
  }
  if (can.seeClients(actor)) {
    items.push({ href: '/clientes', label: 'Clientes', icon: 'clientes' })
  }
  items.push({ href: '/admin', label: 'Gestão', icon: 'gestao' })
  return items
}

/**
 * No fundo do telemóvel cabem cinco portas. Quando são mais, os Avisos
 * são os primeiros a sair — quem gere está ao balcão, num ecrã largo.
 *
 * Quando são menos, ficam todas: a profissional trabalha do telemóvel e
 * é lá que ela avisa as clientes. Cortar-lhe os avisos era tirar-lhe
 * metade do trabalho.
 */
function mobileNavFor(actor: Actor): NavItem[] {
  const items = navFor(actor)
  if (items.length <= 5) return items
  return items.filter((item) => item.href !== '/avisos').slice(0, 5)
}

const ROLE_LABEL = {
  owner: 'Dona',
  manager: 'Gerente',
  professional: 'Profissional',
} as const

function AccountMenu({ actor }: { actor: Actor }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-[0.8125rem] text-[var(--ink)]">{actor.name}</p>
        <p className="text-[0.75rem] text-[var(--ink-faint)]">
          {ROLE_LABEL[actor.role]}
        </p>
      </div>

      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
      >
        <Monogram
          initials={initial(actor.name)}
          className="text-[0.875rem] text-[var(--accent)]"
        />
      </span>

      {/* No ecrã largo o Sair vive na coluna; aqui só no telemóvel. */}
      <form action={signOutAction} className="lg:hidden">
        <button
          type="submit"
          aria-label="Sair"
          title="Sair"
          className="flex h-9 w-9 items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
        >
          <IconSignOut className="h-5 w-5" />
        </button>
      </form>
    </div>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
