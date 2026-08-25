import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { getOrg, listUnits, type Unit } from '@/lib/org'
import { allWeeklyHours, weeklyHours, type Window } from '@/lib/hours'
import { formatMinutes } from '@/lib/time'
import {
  getDictionary,
  getLanguage,
  LANGUAGE_TAG,
  type Dictionary,
} from '@/lib/i18n'
import { getClientActor } from '@/lib/auth/client-actor'
import { BRAND } from '@/lib/branding'
import { LanguageSwitcher } from '@/components/language-switcher'
import { LogoSeal } from '@/components/brand'
import { ButtonLink } from '@/components/ui'
import { formatPhone } from '@/lib/text'

/**
 * A moldura da superfície pública: um cabeçalho fixo e fino, em vidro
 * fumado sobre o herói escuro (ou em porcelana translúcida nas páginas
 * interiores), e um rodapé rico em banda escura com as duas casas.
 */

/** "Seg–Sex · 09:00–19:00" — o horário da semana condensado em 2–3 linhas. */
function weekDigest(
  hours: Map<number, Window[]>,
  shortNames: readonly string[],
  closedLabel: string,
): { days: string; hours: string }[] {
  const ORDER = [1, 2, 3, 4, 5, 6, 0]
  const label = (windows: Window[]) =>
    windows.length === 0
      ? closedLabel
      : windows
          .map((w) => `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`)
          .join(' · ')

  const rows: { days: string; hours: string }[] = []
  let start = 0
  while (start < ORDER.length) {
    const signature = label(hours.get(ORDER[start]!) ?? [])
    let end = start
    while (
      end + 1 < ORDER.length &&
      label(hours.get(ORDER[end + 1]!) ?? []) === signature
    ) {
      end++
    }
    const days =
      start === end
        ? shortNames[ORDER[start]!]!
        : `${shortNames[ORDER[start]!]}–${shortNames[ORDER[end]!]}`
    rows.push({ days, hours: signature })
    start = end + 1
  }
  return rows
}

function mapsUrl(unit: Unit) {
  const address = [unit.address_line, unit.postal_code, unit.city]
    .filter(Boolean)
    .join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(address || unit.name)}`
}

async function FooterHouse({
  unit,
  dict,
  /* Falso quando o número é o mesmo nas duas casas: nesse caso sobe uma
     vez para junto da marca, em vez de se repetir por baixo de cada loja
     como se fossem contactos diferentes. */
  withPhone,
}: {
  unit: Unit
  dict: Dictionary
  withPhone: boolean
}) {
  const digest = weekDigest(
    await weeklyHours(unit.id),
    dict.common.weekdaysShort,
    dict.unit.closedNow,
  )

  /*
   * O HORÁRIO É UMA FRASE, NÃO UMA TABELA.
   *
   * O `weekDigest` já junta os dias com as mesmas horas; o que estava
   * mal era imprimi-los como uma lista de definições, com o dia à
   * esquerda e as horas à direita. Num rodapé isso lê-se como uma
   * grelha de aeroporto para dizer, afinal, «de segunda a sábado».
   * Os dias fechados descem de tom em vez de ocuparem uma linha igual
   * às outras: o que interessa é quando está aberto.
   */
  const open = digest.filter((row) => row.hours !== dict.unit.closedNow)
  const shut = digest.filter((row) => row.hours === dict.unit.closedNow)

  return (
    <div>
      <p className="display text-lg text-[var(--ink)]">{unit.name}</p>

      {unit.address_line ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          {unit.address_line}
          <br />
          {[unit.postal_code, unit.city].filter(Boolean).join(' ')}
        </p>
      ) : null}

      <p className="tabular mt-3 text-[0.8125rem] leading-relaxed">
        {open.map((row) => (
          <span key={row.days} className="block text-[var(--ink-muted)]">
            <span className="text-[var(--ink)]">{row.days}</span> · {row.hours}
          </span>
        ))}
        {shut.length > 0 ? (
          <span className="block text-[var(--ink-faint)]">
            {shut.map((row) => row.days).join(', ')}{' '}
            {dict.unit.closedNow.toLowerCase()}
          </span>
        ) : null}
      </p>

      {withPhone && unit.phone ? (
        <p className="mt-3">
          <a
            href={`tel:${unit.phone.replace(/\s/g, '')}`}
            className="toque tabular text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            {formatPhone(unit.phone)}
          </a>
        </p>
      ) : null}

      <a
        href={mapsUrl(unit)}
        target="_blank"
        rel="noreferrer"
        className="link-slide toque mt-3 inline-block text-[0.8125rem] text-[var(--accent)]"
      >
        {dict.unit.directions}
      </a>
    </div>
  )
}

export async function PublicChrome({
  children,
  compact = false,
  hero = false,
}: {
  children: ReactNode
  compact?: boolean
  /** Página com herói escuro no topo: o cabeçalho vira vidro fumado. */
  hero?: boolean
}) {
  /*
    * O horário vai junto de propósito, mesmo que a moldura não o use.
    *
    * Quem o usa é o rodapé, que só é desenhado depois desta função
    * responder — e então pediria à base numa altura em que já ninguém
    * mais está a pedir nada, sozinho, a pagar a travessia inteira só
    * para ele. Pedido aqui, viaja no mesmo comboio que o resto e chega
    * ao rodapé já em memória.
    */
  const [org, dict, language, client, units] = await Promise.all([
    getOrg(),
    getDictionary(),
    getLanguage(),
    getClientActor(),
    listUnits(),
    allWeeklyHours(),
  ])

  const name = org?.name ?? BRAND.fallbackName
  const whatsapp =
    org?.whatsapp_phone ?? units.find((u) => u.whatsapp_phone)?.whatsapp_phone ?? null
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(dict.footer.whatsappMessage)}`
    : null
  const year = new Date().getFullYear()

  /*
   * UM NÚMERO, OU UM POR LOJA — E É A BASE QUE DECIDE.
   *
   * Hoje as duas casas atendem no mesmo telefone. Isso não é uma regra
   * do salão, é o estado de agora: no dia em que a Maia tiver linha
   * própria, esta comparação passa a falhar sozinha e cada número volta
   * para baixo da sua loja, sem ninguém ter de vir aqui mudar nada.
   */
  const houses = units.slice(0, 2)
  const digits = houses.map((unit) => (unit.phone ?? '').replace(/\D/g, ''))
  const housePhone =
    houses.length > 0 &&
    digits.every((d) => d !== '' && d === digits[0])
      ? houses[0]!.phone
      : null

  return (
    /*
      O `lang` VIVE AQUI, E NÃO NO <html>.

      O <html> da raiz diz `pt-PT` e fica quieto: é a língua da área da
      equipa, que não se traduz, e mudá-lo obrigava a raiz inteira a ler
      o cookie. A montra, essa, muda de língua — e um leitor de ecrã que
      apanhe texto inglês declarado como português pronuncia-o com
      fonemas portugueses, que é o mesmo que não o ler. O atributo vale
      para a sub-árvore onde é posto; posto aqui, cobre a superfície
      pública inteira e não toca no balcão.
    */
    <div
      lang={LANGUAGE_TAG[language]}
      className="skin-salon flex min-h-screen flex-col bg-[var(--surface)]"
    >
      {/* ------------------------------------------------ cabeçalho --- */}
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-50 border-b border-[var(--line-soft)] backdrop-blur-md',
          hero && 'band-dark',
        )}
        style={{
          background: hero
            ? 'color-mix(in srgb, var(--surface) 74%, transparent)'
            : 'color-mix(in srgb, var(--surface) 85%, transparent)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <LogoSeal size="sm" />
            <span className="display hidden text-[0.8125rem] uppercase tracking-[0.18em] text-[var(--ink)] transition-colors group-hover:text-[var(--accent)] min-[480px]:block sm:text-[0.9375rem]">
              {name}
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-1 sm:gap-4">
            {!compact ? (
              <Link
                href="/loja"
                className="link-slide hidden text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] md:block"
              >
                {dict.nav.stores}
              </Link>
            ) : null}

            <Link
              href={client ? '/conta' : '/conta/entrar'}
              className="link-slide hidden text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] sm:block"
            >
              {client ? dict.nav.account : dict.nav.signIn}
            </Link>

            <Suspense fallback={null}>
              <LanguageSwitcher current={language} />
            </Suspense>

            {/* O botão continua com o mesmo ar; só o dedo é que ganha
                mais oito pixéis de altura onde não há rato. */}
            <ButtonLink
              href="/agendar"
              size="sm"
              variant="outline"
              className="ml-1 min-h-11 sm:min-h-0"
            >
              {dict.nav.book}
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main className={clsx('flex-1', !hero && 'pt-16')}>{children}</main>

      {/* --------------------------------------------------- rodapé --- */}
      <footer className="band-dark border-t border-[var(--line-soft)]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-16 pb-10 sm:pt-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-20">
            <div>
              <LogoSeal size="lg" />
              <p className="display mt-5 text-lg uppercase tracking-[0.18em] text-[var(--ink)]">
                {name}
              </p>
              <p className="mt-4 max-w-xs text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                {dict.footer.tagline}
              </p>

              {/*
                O TELEFONE DA CASA.

                Quando as duas lojas atendem no mesmo número, repeti-lo
                por baixo de cada uma fazia-o parecer dois contactos
                diferentes — e obrigava a lê-los aos dois para perceber
                que eram iguais. Aqui é uma coisa só, do tamanho de uma
                coisa em que se toca. Se um dia a Maia tiver linha
                própria, cada número volta para a sua loja sozinho.
              */}
              {housePhone ? (
                <a
                  href={`tel:${housePhone.replace(/\s/g, '')}`}
                  className="display toque tabular mt-6 block text-[1.375rem] text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                >
                  {formatPhone(housePhone)}
                </a>
              ) : null}

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className={clsx(
                    'link-slide toque inline-block text-[0.8125rem] text-[var(--accent)]',
                    housePhone ? 'mt-3' : 'mt-6',
                  )}
                >
                  {dict.footer.whatsapp}
                </a>
              ) : null}
            </div>

            <div className="grid gap-10 sm:grid-cols-2 sm:gap-12">
              {houses.map((unit) => (
                <FooterHouse
                  key={unit.id}
                  unit={unit}
                  dict={dict}
                  withPhone={housePhone === null}
                />
              ))}
            </div>
          </div>

          {/*
            UM FIO A FECHAR, E NÃO TRÊS FAIXAS.

            Havia aqui um ornamento sozinho numa faixa, a separar duas
            coisas que o fio já separava — e o selector de língua, que
            está no cabeçalho e se repetia em baixo. Ficou o que fecha:
            quem assina, e a porta de quem trabalha cá dentro.
          */}
          <div className="mt-14 flex flex-col items-start justify-between gap-5 border-t border-[var(--line-soft)] pt-6 sm:flex-row sm:items-center">
            <p className="text-[0.75rem] text-[var(--ink-faint)]">
              © {year} {BRAND.legalName}
            </p>

            {/*
              A PORTA DA EQUIPA VÊ-SE.

              O «Entrar» do cabeçalho é a área da cliente; esta é outra
              porta, e é a que se abre mais vezes por dia — estava em
              cinzento de letra miudinha, ao lado do ano. Continua no
              rodapé, onde uma porta de serviço pertence, mas com
              contorno e um cadeado a dizer de quem é. Em cima, ao lado
              do outro «entrar», eram duas portas parecidas a levar a
              sítios diferentes.
            */}
            <Link
              href="/entrar"
              className="toque inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-2 text-[0.75rem] font-medium text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
                className="h-3.5 w-3.5 shrink-0"
              >
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              {dict.footer.staffAccess}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
