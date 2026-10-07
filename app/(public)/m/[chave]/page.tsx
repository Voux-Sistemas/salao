import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarClock, Check, MapPin, Phone, RefreshCw } from 'lucide-react'
import {
  clientMayCancel,
  clientMayReschedule,
  foiFeita,
  isTerminal,
  marcacaoPelaChave,
} from '@/lib/booking'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { marcarDeNovo } from '@/lib/marcar-de-novo'
import { formatCents } from '@/lib/money'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { serviceNamesFor } from '@/lib/catalog-names'
import { picksStaffOn } from '@/lib/sunday'
import { formatPhone } from '@/lib/text'
import {
  formatDayLong,
  formatDuration,
  formatTime,
  isoDay,
  weekdayOf,
} from '@/lib/time'
import { DesmarcarPelaChave } from '@/components/manage-forms'
import { ButtonLink, Empty, Eyebrow, Notice } from '@/components/ui'
import { LeafRule, Monogram, Ornament } from '@/components/brand'
import { BAND_GROUND } from '@/components/funnel-stage'

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

  /*
    DESMARCADA, A PÁGINA MUDA DE ASSUNTO.

    Depois de desmarcar, a página voltava a desenhar o recibo da visita
    com um aviso «Cancelada» e um botão «Marcar» — parecia que nada tinha
    acontecido. A confirmação existia, mas vivia dentro do botão de
    desmarcar, e o botão some assim que a marcação deixa de se poder
    desmarcar: a página recarrega e a mensagem ia com ele.

    Agora é a própria página que o diz, a partir do estado da marcação:
    «Está desmarcado.», qual era a hora, e a porta para marcar outra vez.
    Serve também a quem volta a abrir o link dias depois, e a uma
    marcação que o salão tenha desmarcado. (Uma remarcação não chega
    aqui: a chave segue para a marcação nova.)
  */
  const cancelada =
    appointment.status === 'cancelled_by_client' ||
    appointment.status === 'cancelled_by_salon'
  // A visita que já foi: feita, ou com a hora passada sem ter sido
  // desmarcada nem dada como falta (a mesma regra do resto da casa).
  const visitada = !cancelada && foiFeita(appointment.status, appointment.ends_at)

  const names = await serviceNamesFor(
    appointment.items.map((item) => item.service_id),
    language,
  )

  /*
    MARCAR NOVAMENTE — só depois de a visita ter ido ou de ter sido
    desmarcada. Só lê: monta um endereço do funil já preenchido, e a
    marcação nova nasce pelo caminho de sempre. Ver lib/marcar-de-novo.
    Sem loja activa, ou sem nada que ainda se marque online, fica o
    botão de sempre para uma marcação nova.
  */
  const lojaHref = unit ? `/agendar/${unit.slug}` : '/agendar'
  const deNovo =
    (cancelada || visitada) && unit ? await marcarDeNovo(appointment, unit) : null
  const nomesDeNovo = deNovo
    ? new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(
        deNovo.serviceIds.map(
          (id) =>
            names.get(id) ??
            appointment.items.find((item) => item.service_id === id)?.service_name ??
            '',
        ),
      )
    : ''

  if (cancelada) {
    return (
      <Desmarcada
        title={dict.manage.cancelledTitle}
        line={dict.manage.cancelledLine
          .replace('{dia}', formatDayLong(day, timezone, language))
          .replace('{hora}', formatTime(appointment.starts_at, timezone, language))
          .replace('{loja}', appointment.unit_name)}
        hint={dict.manage.cancelledHint}
        action={dict.manage.bookAgain}
        again={
          deNovo
            ? {
                href: deNovo.href,
                label: dict.manage.sameAgain,
                note: deNovo.staffName
                  ? dict.manage.sameLine
                      .replace('{servicos}', nomesDeNovo)
                      .replace('{nome}', deNovo.staffName)
                  : `${nomesDeNovo}.`,
                other: dict.manage.otherBooking,
                otherHref: lojaHref,
              }
            : null
        }
      />
    )
  }

  if (visitada) {
    // «na terça-feira», mas «no sábado» e «no domingo». Só o português
    // precisa disto: nas outras línguas o artigo está no próprio texto.
    const fimDeSemana = [0, 6].includes(weekdayOf(day))
    const dia = formatDayLong(day, timezone, language)
    return (
      <VisitaFeita
        title={dict.manage.visitedTitle}
        line={dict.manage.visitedLine
          .replace('{dia}', language === 'pt' ? `${fimDeSemana ? 'no' : 'na'} ${dia}` : dia)
          .replace('{loja}', appointment.unit_name)}
        eyebrow={dict.manage.lastTime}
        rows={appointment.items.map((item) => ({
          id: item.id,
          service: names.get(item.service_id) ?? item.service_name,
          // Ao domingo não se diz «com quem» (ver o recibo, mais abaixo).
          staff: picksStaffOn(day) ? `${dict.common.with} ${item.staff_public_name}` : null,
        }))}
        again={
          deNovo
            ? {
                href: deNovo.href,
                label: dict.manage.again,
                note: deNovo.staffName
                  ? dict.manage.againWith.replace('{nome}', deNovo.staffName)
                  : dict.manage.againSame,
                other: dict.manage.otherServices,
                otherHref: lojaHref,
              }
            : null
        }
        fallback={{
          href: lojaHref,
          label: dict.manage.bookAgain,
        }}
      />
    )
  }

  const minutes = Math.round(
    (appointment.ends_at.getTime() - appointment.starts_at.getTime()) / 60_000,
  )

  const now = new Date()
  const podeDesmarcar = clientMayCancel(
    appointment,
    { cancel_window_minutes: unit?.cancel_window_minutes ?? 0 },
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

      <div className="mt-10 flex justify-center text-[var(--line)]">
        <LeafRule className="w-40" />
      </div>
    </Shell>
  )
}

/** O botão cheio dos dois painéis — o mesmo do recibo. */
const BOTAO =
  'botao sheen mt-3.5 flex h-[46px] items-center justify-center rounded-full bg-[var(--action)] text-[0.90625rem] font-semibold tracking-[0.01em] text-[var(--action-ink)] shadow-[0_10px_22px_-14px_rgba(111,85,47,0.7)] transition-all duration-300 select-none hover:-translate-y-0.5 hover:bg-[var(--action-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:translate-y-px sm:mt-[18px] sm:h-12 sm:text-[0.9375rem]'

/** O «Marcar novamente» de um painel: o botão, a frase e a porta discreta. */
type DeNovo = {
  href: string
  label: string
  note: string
  other: string
  otherHref: string
}

/**
 * A faixa escura em painel, com o sinal dourado e a frase, e por baixo
 * o cartão com o que fazer a seguir. É a moldura do «Está desmarcado.»
 * e do «Até à próxima.» — o par do recibo de quando se marca.
 */
function Painel({
  icon,
  title,
  line,
  children,
}: {
  icon: React.ReactNode
  title: string
  line: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[78vh] flex-col">
      <div className="mx-auto w-full max-w-[74.5rem] px-3 pt-2.5 sm:px-5 sm:pt-4">
        <header
          className="band-dark relative overflow-hidden rounded-[20px] px-[18px] py-6 text-center shadow-[inset_0_0_0_1px_rgba(211,184,126,0.14)] sm:rounded-[24px] sm:px-8 sm:pt-[38px] sm:pb-10"
          style={{ background: BAND_GROUND }}
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-full text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(211,184,126,0.45),0_0_0_6px_rgba(211,184,126,0.06)] sm:size-[58px]">
            {icon}
          </span>
          <h1 className="display display-italic animate-rise mt-3.5 text-[1.5625rem] leading-[1.1] sm:mt-[18px] sm:text-[2.25rem]">
            {title}
          </h1>
          <p className="animate-fade mx-auto mt-2 max-w-[28rem] text-[0.78125rem] leading-[18px] text-[var(--ink-muted)] sm:mt-2.5 sm:text-[0.875rem] sm:leading-5">
            {line}
          </p>
        </header>
      </div>

      <div className="flex-1">
        <div className="mx-auto w-full max-w-[29rem] px-3 pt-3 pb-12 sm:px-0 sm:pt-7 sm:pb-16">
          <div className="rounded-[18px] bg-[var(--surface-raised)] p-4 text-center shadow-[0_1px_2px_rgba(34,29,23,0.03)] sm:rounded-[22px] sm:px-6 sm:py-[22px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * O botão «Marcar novamente» e o que vem com ele. Sem pré-carregamento:
 * o passo das horas calcula a semana inteira, e só vale a pena quando
 * ela toca.
 */
function BotaoDeNovo({ deNovo }: { deNovo: DeNovo }) {
  return (
    <>
      <Link href={deNovo.href} prefetch={false} className={BOTAO}>
        {deNovo.label}
      </Link>
      <p className="mt-[9px] text-[0.75rem] leading-[18px] text-[#8A7F6E] sm:mt-2.5 sm:text-[0.78125rem]">
        {deNovo.note}
      </p>
      <Link
        href={deNovo.otherHref}
        prefetch={false}
        className="mt-3 inline-block text-[0.78125rem] leading-5 text-[var(--action-strong)] underline decoration-[rgba(111,85,47,0.35)] underline-offset-[3px] transition-colors hover:decoration-[var(--action-strong)] sm:mt-3.5 sm:text-[0.8125rem]"
      >
        {deNovo.other}
      </Link>
    </>
  )
}

/**
 * O ecrã de uma marcação desmarcada, no desenho do mockup «Marcação
 * desmarcada». Com «Marcar novamente» (mockup «Marcar novamente · B»),
 * o botão cheio refaz a mesma marcação noutro dia e a marcação nova
 * passa a porta discreta por baixo.
 */
function Desmarcada({
  title,
  line,
  hint,
  action,
  again,
}: {
  title: string
  line: string
  hint: string
  action: string
  again: DeNovo | null
}) {
  return (
    <Painel icon={<Check size={24} strokeWidth={1.8} aria-hidden />} title={title} line={line}>
      <p className="text-[0.8125rem] leading-5 text-[var(--ink-muted)] sm:text-[0.875rem]">
        {hint}
      </p>
      {again ? (
        <BotaoDeNovo deNovo={again} />
      ) : (
        <Link href="/agendar" className={BOTAO}>
          {action}
        </Link>
      )}
    </Painel>
  )
}

/**
 * A VISITA QUE JÁ FOI (mockup «Marcar novamente · A»).
 *
 * Abria o recibo da visita com «Concluída» e um botão para o início do
 * funil. Agora diz «Até à próxima.», mostra o que ela fez da última vez
 * e oferece refazê-lo. Quando nada daquilo se marca online hoje, fica
 * só o botão de uma marcação nova.
 */
function VisitaFeita({
  title,
  line,
  eyebrow,
  rows,
  again,
  fallback,
}: {
  title: string
  line: string
  eyebrow: string
  rows: { id: string; service: string; staff: string | null }[]
  again: DeNovo | null
  fallback: { href: string; label: string }
}) {
  return (
    <Painel icon={<RefreshCw size={21} strokeWidth={1.7} aria-hidden />} title={title} line={line}>
      <p className="mb-2 text-left text-[0.65625rem] leading-4 tracking-[0.14em] text-[#A2957F] uppercase sm:mb-2.5 sm:text-[0.6875rem]">
        {eyebrow}
      </p>
      <ul className="divide-y divide-[rgba(34,29,23,0.05)] border-y border-[rgba(34,29,23,0.07)] text-left">
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline gap-2.5 py-2 sm:py-[9px]">
            <span className="min-w-0 text-[0.84375rem] leading-5 text-[var(--ink)] sm:text-[0.875rem]">
              {row.service}
            </span>
            {row.staff ? (
              <span className="ml-auto shrink-0 text-[0.78125rem] leading-5 text-[#8A7F6E] sm:text-[0.8125rem]">
                {row.staff}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {again ? (
        <BotaoDeNovo deNovo={again} />
      ) : (
        <Link href={fallback.href} prefetch={false} className={BOTAO}>
          {fallback.label}
        </Link>
      )}
    </Painel>
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
