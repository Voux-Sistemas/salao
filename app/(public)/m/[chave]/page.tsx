import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarClock, MapPin, Phone } from 'lucide-react'
import {
  clientMayCancel,
  clientMayReschedule,
  isTerminal,
  marcacaoPelaChave,
} from '@/lib/booking'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { formatCents } from '@/lib/money'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { serviceNamesFor } from '@/lib/catalog-names'
import { picksStaffOn } from '@/lib/sunday'
import { formatPhone } from '@/lib/text'
import { formatDayLong, formatDuration, formatTime, isoDay } from '@/lib/time'
import { DesmarcarPelaChave } from '@/components/manage-forms'
import { ButtonLink, Empty, Eyebrow, Notice } from '@/components/ui'
import { LeafRule, Monogram, Ornament } from '@/components/brand'

type Params = {
  params: Promise<{ chave: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    // Um endereço por marcação, e cada um aponta para uma pessoa em
    // concreto. Nada disto entra num índice de pesquisa.
    title: dict.manage.title,
    robots: { index: false, follow: false },
  }
}

/**
 * A PÁGINA QUE O LINK ABRE.
 *
 * Uma cliente quis desmarcar, pediu o código para entrar na área dela, e
 * ficou a olhar para seis quadrados vazios: o sistema não tem canal
 * automático nenhum, e o código fica no balcão à espera que alguém o
 * mande. Ao balcão ninguém tem tempo de o mandar.
 *
 * Esta página não pede nada. A chave está no endereço, e o endereço foi
 * ela que guardou quando marcou. É a mesma ideia de um link de
 * confirmação de um hotel: quem o tem, manda naquela reserva.
 *
 * E MOSTRA UMA MARCAÇÃO SÓ. Não é a área de conta por outra porta — não
 * há histórico, não há dados da ficha, não há as outras marcações. A
 * chave abre uma porta, não a casa.
 */
export default async function ManagePage({ params, searchParams }: Params) {
  const { chave } = await params
  const query = await searchParams

  const appointment = await marcacaoPelaChave(chave)
  const [dict, language] = await Promise.all([getDictionary(), getLanguage()])

  /*
    Uma chave inventada e uma chave de uma marcação apagada respondem o
    mesmo. Se respondessem coisas diferentes, esta página passava a
    dizer a quem tentasse às cegas quais das chaves existem.
  */
  if (!appointment) {
    return (
      <Shell>
        <Empty
          title={dict.manage.gone}
          hint={dict.manage.goneHint}
          action={<ButtonLink href="/agendar">{dict.account.bookNow}</ButtonLink>}
        />
      </Shell>
    )
  }

  const [org, unit] = await Promise.all([
    requireOrg(),
    getUnitBySlug(appointment.unit_slug),
  ])

  const timezone = appointment.unit_timezone
  const day = isoDay(appointment.starts_at, timezone)
  const minutes = Math.round(
    (appointment.ends_at.getTime() - appointment.starts_at.getTime()) / 60_000,
  )
  const names = await serviceNamesFor(
    appointment.items.map((item) => item.service_id),
    language,
  )

  const now = new Date()
  const podeDesmarcar = clientMayCancel(
    appointment,
    { cancel_window_hours: unit?.cancel_window_hours ?? 0 },
    now,
  )
  const podeRemarcar = unit !== null && clientMayReschedule(appointment, unit, now)

  /*
    Uma marcação fechada — desmarcada, dada como falta, já feita — ainda
    abre nesta página, e é de propósito: quem carrega no link quer saber
    em que pé está. O que desaparece são os botões, porque nenhum deles
    faria alguma coisa.
  */
  const fechada = !podeDesmarcar && !podeRemarcar

  const address = [unit?.address_line, unit?.postal_code, unit?.city]
    .filter(Boolean)
    .join(', ')

  return (
    <Shell>
      {/* Volta de uma remarcação feita: a página é a mesma, e a única
          diferença é esta linha em cima a dizer que correu bem. */}
      {query.feito ? (
        <div className="mb-6">
          <Notice tone="ok">{dict.manage.rescheduled}</Notice>
        </div>
      ) : null}

      <div className="mb-7">
        <p className="eyebrow eyebrow-gold">{appointment.unit_name}</p>
        <h1 className="display animate-rise mt-3 text-[1.75rem] leading-[1.15] sm:text-[2.25rem]">
          {dict.manage.title}
        </h1>
        <p className="animate-fade delay-1 mt-2 text-[0.875rem] text-[var(--ink-muted)]">
          {dict.manage.subtitle}
        </p>
      </div>

      <article className="border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
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
              <span>{address}</span>
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
                  {/* Ao domingo não se diz «com quem»: ninguém foi
                      escolhido, e o nome que o motor arrumou por dentro
                      não é uma promessa da casa. */}
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
      </article>

      {/*
        AS DUAS COISAS QUE ELA PODE FAZER, e por esta ordem de propósito.

        Mudar de hora vem primeiro e vem com peso: entre uma cliente que
        desmarca e uma que muda de dia, a casa quer a que muda de dia — a
        hora perde-se de qualquer maneira, mas o dinheiro só se perde
        numa delas. Desmarcar fica ao lado, discreto, sem nunca estar
        escondido: quem não pode vir tem de o poder dizer sem lutar.
      */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {podeRemarcar ? (
          <ButtonLink href={`/m/${chave}/remarcar`} size="lg">
            <CalendarClock size={16} />
            {dict.manage.reschedule}
          </ButtonLink>
        ) : null}

        {podeDesmarcar ? (
          <DesmarcarPelaChave
            chave={chave}
            labels={{
              cancel: dict.account.cancelBooking,
              confirm: dict.account.cancelConfirm,
              back: dict.common.close,
              doneTitle: dict.manage.cancelledTitle,
              doneHint: dict.manage.cancelledHint,
            }}
          />
        ) : null}
      </div>

      {/* Quando não há nada a fazer, diz-se porquê e com quem falar — uma
          porta para o telefone da loja vale mais do que um botão apagado
          que não explica nada. */}
      {fechada ? (
        <div className="mt-8 space-y-3">
          <Notice tone="warn">
            {isTerminal(appointment.status)
              ? dict.account.statusLabel[appointment.status]
              : dict.account.cancelTooLate}
          </Notice>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/agendar" variant="outline">
              {dict.account.bookNow}
            </ButtonLink>
          </div>
        </div>
      ) : null}

      <p className="mt-10 text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
        {dict.account.signInNoAccount}{' '}
        <Link href="/conta" className="link-slide">
          {dict.account.title}
        </Link>
      </p>

      <div className="mt-10 flex justify-center text-[var(--line)]">
        <LeafRule className="w-40" />
      </div>
    </Shell>
  )
}

/**
 * A moldura. Fica de fora do corpo porque a página do «não abre nada»
 * usa a mesma — e ela tem de parecer a mesma casa, não um erro do
 * servidor.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[78vh] flex-col">
      <header className="band-dark relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[40rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--gold) 34%, transparent), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-2xl px-5 py-10 text-center sm:px-8 sm:py-12">
          <Monogram className="text-4xl text-[var(--gold)] opacity-80" />
          <div className="mt-5 flex justify-center text-[var(--gold)] opacity-50">
            <Ornament />
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-14">
          {children}
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
