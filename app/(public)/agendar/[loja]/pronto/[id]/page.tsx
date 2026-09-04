import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MapPin, Phone } from 'lucide-react'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { chaveDa, getAppointment } from '@/lib/booking'
import { formatCents } from '@/lib/money'
import { formatDayLong, formatDuration, formatTime, isoDay } from '@/lib/time'
import { ButtonLink, Eyebrow } from '@/components/ui'
import { LeafRule, LogoStamp, Ornament } from '@/components/brand'
import { GuardarLink } from '@/components/guardar-link'
import { formatPhone } from '@/lib/text'
import { serviceNamesFor } from '@/lib/catalog-names'
import { preencherSaudacao } from '@/lib/notify'
import { picksStaffOn } from '@/lib/sunday'
import { isUuid } from '@/lib/id'

type Params = { params: Promise<{ loja: string; id: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    // Este endereço tem o número de uma marcação de uma pessoa. É o único
    // do sítio público que aponta para alguém em concreto — fora do índice.
    title: dict.tabs.done,
    robots: { index: false, follow: false },
  }
}


/**
 * O recibo. É a última tela do funil e leva o caminho para a área de
 * conta — a partir daqui a cliente vê e cancela as suas marcações.
 *
 * A tela é deliberadamente celebratória: faixa escura em cima com o
 * carimbo dourado, e por baixo um bilhete em porcelana com tudo o que
 * ela precisa de saber para aparecer à hora certa, no sítio certo.
 */
export default async function DonePage({ params }: Params) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()

  const [org, appointment, unit] = await Promise.all([
    requireOrg(),
    getAppointment(id),
    getUnitBySlug(loja),
  ])
  if (!appointment || appointment.unit_slug !== loja) notFound()

  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  // O nome do serviço ficou congelado em português quando ela marcou —
  // é o que o balcão vai ler. Aqui manda-se vir o de fora: este bilhete
  // é dela.
  const names = await serviceNamesFor(
    appointment.items.map((item) => item.service_id),
    language,
  )

  const timezone = appointment.unit_timezone
  const day = isoDay(appointment.starts_at, timezone)
  const minutes = Math.round(
    (appointment.ends_at.getTime() - appointment.starts_at.getTime()) / 60_000,
  )

  const address = [unit?.address_line, unit?.postal_code, unit?.city]
    .filter(Boolean)
    .join(', ')
  const maps = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${appointment.unit_name}, ${address}`,
      )}`
    : null

  /*
    A chave vem numa pergunta à parte e não com a marcação: só esta
    página a usa, e enfiá-la no `getAppointment` fazia todas as outras
    do balcão pagarem por ela.
  */
  const chave = await chaveDa(appointment.id)

  return (
    <div className="flex min-h-[78vh] flex-col">
      {/* ------------------------------------------------- o carimbo --- */}
      <header className="band-dark relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[46rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--gold) 38%, transparent), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <LogoStamp className="mx-auto h-32 w-32 sm:h-40 sm:w-40" />
          <h1 className="display display-italic animate-rise delay-3 mt-7 text-[2.1rem] leading-[1.1] sm:text-[2.75rem]">
            {dict.funnel.doneTitle}
          </h1>
          {/* A mensagem de boas-vindas é da casa e fala com a cliente
              pelo nome — os {marcadores} enchem-se aqui, não no modelo.
              O `pre-line` respeita a linha vazia entre as duas frases. */}
          <p className="animate-fade delay-4 mt-4 whitespace-pre-line text-[0.9375rem] text-[var(--ink-muted)]">
            {preencherSaudacao(
              dict.funnel.doneSubtitle,
              appointment.client_name,
              appointment.unit_name,
            )}
          </p>
          <div className="animate-fade delay-5 mt-8 flex justify-center text-[var(--gold)] opacity-60">
            <Ornament />
          </div>
        </div>
      </header>

      {/* -------------------------------------------------- o bilhete --- */}
      <div className="flex-1">
        <div className="mx-auto max-w-xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-warm)]">
            <div className="h-1 bg-[var(--accent)]" />

            <Row label={dict.funnel.whenLabel}>
              <span className="display block text-lg leading-snug text-[var(--ink)] first-letter:uppercase">
                {formatDayLong(day, timezone, language)}
              </span>
              <span className="tabular mt-1 block text-[var(--accent)]">
                {formatTime(appointment.starts_at, timezone, language)}
                {' · '}
                {formatDuration(minutes, language)}
              </span>
            </Row>

            <Row label={dict.funnel.whereLabel}>
              <span className="display block text-lg text-[var(--ink)]">
                {appointment.unit_name}
              </span>
              {address ? (
                <p className="mt-1.5 flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {maps ? (
                    <a
                      href={maps}
                      target="_blank"
                      rel="noreferrer"
                      className="link-slide"
                    >
                      {address}
                    </a>
                  ) : (
                    <span>{address}</span>
                  )}
                </p>
              ) : null}
              {unit?.phone ? (
                <p className="mt-1 flex items-center gap-2 text-[0.8125rem] text-[var(--ink-muted)]">
                  <Phone size={14} className="shrink-0" />
                  <a
                    href={`tel:${unit.phone.replace(/\s/g, '')}`}
                    className="tabular link-slide"
                  >
                    {formatPhone(unit.phone)}
                  </a>
                </p>
              ) : null}
            </Row>

            <Row label={dict.funnel.whatLabel}>
              <ul className="space-y-3">
                {appointment.items.map((item) => (
                  <li key={item.id}>
                    <div className="flex items-baseline gap-3">
                      <span className="text-[0.9375rem] text-[var(--ink)]">
                        {names.get(item.service_id) ?? item.service_name}
                      </span>
                      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-[var(--line)]" />
                      <span className="tabular shrink-0 text-[0.875rem] text-[var(--ink)]">
                        {formatCents(item.price_cents, org.currency, language)}
                      </span>
                    </div>
                    <p className="tabular mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
                      {formatTime(item.starts_at, timezone, language)}
                      {/* Ao domingo nao se diz «com quem»: a cliente nao
                          escolheu ninguem, e o nome que o motor arrumou
                          por dentro nao e uma promessa. */}
                      {picksStaffOn(day) ? (
                        <>
                          {' · '}
                          {dict.common.with} {item.staff_public_name}
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            </Row>

            <div className="flex items-baseline justify-between px-6 py-5">
              <Eyebrow>{dict.common.total}</Eyebrow>
              <span className="tabular display text-2xl text-[var(--ink)]">
                {formatCents(appointment.total_cents, org.currency, language)}
              </span>
            </div>
          </div>

          {/*
            AS DUAS PORTAS PARA ELA VOLTAR AQUI SOZINHA.

            Vai para `/conta` e não para `/conta/entrar`: a sessão dela
            nasceu ao marcar, e mandá-la à porta de entrada era pedir-lhe
            um código que ninguém lhe manda. É esse código que a deixava
            presa.
          */}
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/conta" size="lg">
              {dict.funnel.goToAccount}
            </ButtonLink>
            <ButtonLink href="/agendar" size="lg" variant="outline">
              {dict.funnel.bookAnother}
            </ButtonLink>
          </div>

          {/*
            E A SEGUNDA PORTA, DISCRETA.

            A sessão vive naquele telemóvel. Se ela quiser desmarcar do
            computador do trabalho, ou se limpar o navegador, é este link
            que a salva — e vem DELA, não de alguém do salão a ter de o
            enviar.

            Fica pequeno de propósito: a maioria nunca vai precisar dele,
            e quem precisa é porque já anda à procura.
          */}
          {chave ? <GuardarLink chave={chave} /> : null}

          <div className="mt-12 flex justify-center text-[var(--line)]">
            <LeafRule className="w-40" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--line-soft)] px-6 py-5">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </div>
  )
}
