import type { ReactNode } from 'react'
import Link from 'next/link'
import { getOrg } from '@/lib/org'
import { BRAND } from '@/lib/branding'
import { can, requireActor, type Actor } from '@/lib/auth/actor'
import { signOutAction } from '@/app/(auth)/entrar/actions'
import { initial } from '@/lib/text'
import { DeskNav, type NavItem } from '@/components/desk-nav'
import { NovasMarcacoes } from '@/components/novas-marcacoes'
import { countNotices } from '@/lib/notices'
import { ownStaffId } from '@/lib/auth/actor'
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

  /*
    O NÚMERO DO SINO.

    Corre em todas as páginas do balcão, e por isso vai dentro de um
    try/catch: um número decorativo não pode derrubar a agenda de quem
    está a trabalhar. Se a contagem falhar, o sino fica sem selo e mais
    nada acontece — a página dos Avisos continua lá, com as contas
    verdadeiras de cada fila.
  */
  let avisos = 0
  try {
    avisos = await countNotices({
      orgId: actor.orgId,
      unitIds: actor.orgScope ? null : actor.unitIds,
      staffId: ownStaffId(actor),
    })
  } catch (erro) {
    /*
      NÃO É SILÊNCIO, É UM NÚMERO QUE NÃO APARECE.

      A página não pode cair por causa de um selo, mas engolir o erro sem
      deixar rasto foi um erro meu: o selo não apareceu no telemóvel e
      não havia maneira de saber se a conta deu zero ou se rebentou.
      Fica registado — nos registos da Netlify vê-se qual dos dois é.
    */
    console.error('[avisos] a contagem do sino falhou:', erro)
    avisos = 0
  }

  const home = actor.role === 'professional' ? '/agenda' : '/'
  const houseName = org?.name ?? BRAND.fallbackName

  /*
    A DATA NÃO MORA NA MOLDURA — MORA NA PÁGINA.

    Esta barra mostrava sempre o dia de HOJE. Na agenda isso dava duas
    datas ao mesmo tempo, uma por cima da outra: a da moldura, presa a
    hoje, e a do título, que anda com as setas. Quem abrisse a semana
    que vem via a barra a jurar que ainda era segunda-feira. Ficou o
    nome da casa, que não muda de linha para linha, e a data ficou só
    onde é verdadeira.
  */

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
          <DeskNav items={navFor(actor, avisos)} variant="rail" />
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
            a barra ser opaca.

            E O VIDRO É BEGE, COMO A BARRA DE BAIXO. Uma página fica
            bem segura quando as duas pontas são da mesma cor: as duas
            dizem «isto é a casa», e o que está entre elas é o trabalho.
            Enquanto esta foi quase branca, era mais um cartão da lista
            — e a de baixo, essa, já parecia o chão.

            O que se trocou foi o TOM, não o material: o `color-mix` e o
            desfoque são os mesmos, e a lista continua a ver-se a passar
            por baixo. A percentagem sobe de 78 para 86, que é o que o
            bege precisa para pesar o mesmo que o branco pesava. */}
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-2)_86%,transparent)] backdrop-blur-md">
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
                {houseName}
              </p>
            </div>

            <AccountMenu actor={actor} />
          </div>
        </header>

        {/* Folga em baixo para a barra do telemóvel. Entra também a
            faixa do indicador do iPhone: a barra assenta no fundo do
            ecrã e cresce por cima dela, portanto tapa mais do que o
            corpo dela.

            A CONTA É A ALTURA A SÉRIO DA BARRA: 4,25rem de conteúdo mais
            o fio de cima. Estava escrita a 4,5rem — um número redondo à
            mão, que sobrava três píxeis aqui e faltava-os a quem se
            encostasse a ela. */}
        <main className="flex-1 pb-[calc(4.25rem+1px+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>

        {/* O aviso das marcações novas vive na moldura, não numa página:
            quem está ao balcão anda entre a agenda, a caixa e as fichas
            o dia inteiro, e o recado tem de o seguir. */}
        <NovasMarcacoes />
      </div>

      {/* A barra do fundo — só no telemóvel. ------------------------- */}
      <nav
        aria-label="Navegação principal"
        // Sem altura: quem a define é o DeskNav, que a soma à folga do
        // indicador do iPhone. Com `h-[4.5rem]` aqui, essa folga era
        // descontada aos ícones em vez de acrescentada por baixo.
        // O BEGE AFUNDADO, E NÃO O BRANCO DOS CARTÕES.
        //
        // A barra era do mesmo branco da lista que passa por cima dela,
        // separada por um fio quase invisível: não se via onde a página
        // acabava e onde começava o menu da casa. No bege afundado —
        // o mesmo do controlo de separadores — lê-se como chão.
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface-2)] shadow-[0_-8px_24px_-18px_rgba(15,21,32,0.28)] lg:hidden"
      >
        <DeskNav items={mobileNavFor(actor, avisos)} variant="bottom" />
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
function navFor(actor: Actor, avisos = 0): NavItem[] {
  if (actor.role === 'professional') {
    return [
      { href: '/agenda', label: 'A minha agenda', short: 'Agenda', icon: 'agenda' },
      {
        href: '/avisos',
        label: 'Os meus avisos',
        short: 'Avisos',
        icon: 'avisos',
        badge: avisos,
      },
    ]
  }

  const items: NavItem[] = [
    { href: '/', label: 'Hoje', icon: 'hoje' },
    { href: '/agenda', label: 'Agenda', icon: 'agenda' },
  ]
  if (can.seeNotices(actor)) {
    items.push({
      href: '/avisos',
      label: 'Avisos',
      icon: 'avisos',
      badge: avisos,
    })
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
function mobileNavFor(actor: Actor, avisos = 0): NavItem[] {
  const items = navFor(actor, avisos)
  if (items.length <= 5) return items
  return items.filter((item) => item.href !== '/avisos').slice(0, 5)
}

const ROLE_LABEL = {
  master: 'Sistema',
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
