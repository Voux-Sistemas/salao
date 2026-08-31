import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import {
  clientNotes,
  clientVisits,
  getClient,
  preferenceOptions,
  type ClientVisit,
} from '@/lib/clients'
import { formatCents } from '@/lib/money'
import { requireOrg } from '@/lib/org'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/status'
import {
  formatDateTime,
  formatDateTimeShort,
  formatDayShort,
  isoDay,
} from '@/lib/time'
import { LANGUAGE_LABEL } from '@/lib/i18n/config'
import { waLink } from '@/lib/whatsapp'
import { Monogram } from '@/components/brand'
import { ClientForm, DeleteNote, NoteForm } from '@/components/client-forms'
import { formatPhone } from '@/lib/text'
import {
  Badge,
  ButtonLink,
  buttonClass,
  Card,
  Empty,
} from '@/components/ui'
import { isUuid } from '@/lib/id'

export const metadata: Metadata = { title: 'Ficha da cliente' }


/** "Ana Sofia Marques" -> "AM", para o monograma do avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '·'
}

/**
 * A FICHA.
 *
 * Uma cliente é uma ficha só na rede — o histórico atravessa as lojas.
 * Aqui está o que se precisa de saber para a atender bem, o que ela já
 * fez cá, e o que a equipa escreveu entre si e ela nunca vê.
 */
export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireManagement()
  const { id } = await params
  if (!isUuid(id)) notFound()

  const client = await getClient(actor.orgId, id)
  if (!client) notFound()

  const [visits, notes, options, units, org] = await Promise.all([
    clientVisits(client.id),
    clientNotes(client.id),
    preferenceOptions(actor.orgId),
    unitsFor(actor),
    requireOrg(),
  ])

  const tz = org.timezone
  const bookHere =
    units.find((unit) => unit.id === client.preferred_unit_id) ?? units[0]

  /* «Valongo · Filipa Rocha», ou nada. Vivia num cartão de números,
     debaixo de um fio, com o rótulo «Prefere» — e não é um número. */
  const prefere = [client.preferred_unit_name, client.preferred_staff_name]
    .filter(Boolean)
    .join(' · ')

  /* A ficha pode ainda não ter as datas gravadas — o histórico sabe.
     As visitas vêm por ordem descendente; conta só o que foi concluído. */
  const completed = visits.filter((visit) => visit.status === 'completed')
  const lastVisitAt = client.last_visit_at ?? completed[0]?.starts_at ?? null
  const firstVisitAt =
    client.first_visit_at ?? completed[completed.length - 1]?.starts_at ?? null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} />
        Clientes
      </Link>

      {/*
        QUEM É — NUMA LINHA, NÃO EM TRÊS ANDARES.

        O telefone estava numa linha, a língua noutra, e a loja preferida
        vivia lá em baixo dentro do cartão dos números, debaixo de um
        fio, onde não pertencia: não é um número.

        Juntam-se todos debaixo do nome. E o selo da língua só aparece
        quando NÃO é português — estava em todas as fichas, sozinho, a
        dizer o que já se supunha.

        O monograma é redondo e dourado, como na lista. Era quadrado e
        cinzento aqui: a mesma pessoa com duas caras conforme o ecrã.
      */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-[var(--accent)]">
            <Monogram initials={initialsOf(client.name)} className="text-xl" />
          </span>
          <div className="min-w-0">
            <h1 className="display text-[1.875rem] leading-none text-[var(--ink)]">
              {client.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
              <span className="tabular">{formatPhone(client.phone)}</span>
              {client.email ? (
                <>
                  <span className="text-[var(--ink-faint)]">·</span>
                  <span>{client.email}</span>
                </>
              ) : null}
              {prefere ? (
                <>
                  <span className="text-[var(--ink-faint)]">·</span>
                  <span className="font-semibold text-[var(--accent)]">
                    {prefere}
                  </span>
                </>
              ) : null}
              {client.language !== 'pt' ? (
                <Badge>{LANGUAGE_LABEL[client.language]}</Badge>
              ) : null}
              {client.no_show_count > 0 ? (
                <Badge tone="bad">
                  {client.no_show_count} falta
                  {client.no_show_count === 1 ? '' : 's'}
                </Badge>
              ) : null}
              {client.tags.map((tag) => (
                <Badge key={tag} tone="accent">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={waLink(client.phone, '')}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('outline', 'md')}
          >
            <MessageCircle size={15} />
            WhatsApp
          </a>
          {bookHere ? (
            <ButtonLink
              href={`/agenda/${bookHere.slug}/encaixe?cli=${client.id}`}
              size="md"
            >
              Marcar
            </ButtonLink>
          ) : null}
        </div>
      </header>

      {/*
        OS QUATRO NÚMEROS, ENCOSTADOS.

        Estavam numa grelha larga com espaço entre eles, e cada um
        parecia sozinho. Encostados, com um fio a separá-los, lêem-se
        como uma fila — que é o que são: a mesma cliente, contada de
        quatro maneiras.

        A PRÓXIMA TEM FUNDO PRÓPRIO. Das quatro é a única sobre a qual
        se faz alguma coisa; as outras três são história.

        E as visitas dizem «0», não «—»: zero é um facto, um traço não é
        nada. Só as datas que não existem levam traço — essas realmente
        não existem.
      */}
      {/*
        OS FIOS SÃO O FUNDO, NÃO SÃO BORDAS.

        A primeira versão punha borda esquerda em cada caixa e tirava-a à
        primeira de cada linha — e como são duas por linha no telemóvel e
        quatro no monitor, isso pedia `nth-child` a discutir com `first:`
        dentro do mesmo `sm:`. Quem ganha essa discussão é a ordem por
        que o Tailwind emite as regras, não a ordem em que se escrevem: é
        uma armadilha que esta casa já pagou.

        Aqui o fundo do quadro é a cor do fio e as caixas ficam com um
        píxel de intervalo. Desenha-se sozinho, com duas colunas ou com
        quatro, e não há nada para discutir.
      */}
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--line-soft)] sm:grid-cols-4">
        <Figure label="Visitas" value={String(client.visits)} />
        <Figure
          label="Primeira"
          value={firstVisitAt ? formatDayShort(isoDay(firstVisitAt, tz), tz) : null}
        />
        <Figure
          label="Última"
          value={lastVisitAt ? formatDayShort(isoDay(lastVisitAt, tz), tz) : null}
        />
        {/* Por extenso — «22 de agosto às 15:00» — quebrava em duas
            linhas e desalinhava a fila toda. Aqui só se quer saber
            quando é. */}
        <Figure
          label="Próxima"
          value={client.next_at ? formatDateTimeShort(client.next_at, tz) : null}
          proxima
        />
      </div>

      {client.service_notes ? (
        <Card className="mb-5 px-4 py-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-[var(--ink-faint)]">
            Nota do serviço
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-[var(--ink)]">
            {client.service_notes}
          </p>
        </Card>
      ) : null}

      {/*
        O HISTÓRICO LEVA QUASE O DOBRO DAS NOTAS.

        Era `1fr / 20rem`, quase meio a meio — e como a caixa de escrever
        notas estava sempre aberta, o cartão vazio das notas ficava mais
        alto do que o histórico. A coisa que se lê era mais pequena do
        que a coisa que raramente se escreve.
      */}
      <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr] lg:items-start">
        {/* --- o que já cá fez ------------------------------------- */}
        <section>
          <h2 className="titulo-seccao mb-2">Histórico</h2>
          {visits.length === 0 ? (
            <Card className="px-4">
              <Empty
                title="Ainda não veio"
                hint="Assim que for atendida, aparece aqui — de qualquer das lojas."
              />
            </Card>
          ) : (
            /* Uma cliente antiga traz dezenas de visitas: o histórico rola
               dentro da própria moldura em vez de esticar a página e
               deixar a coluna do lado às moscas. */
            <Card className="relative overflow-hidden">
              <div className="max-h-[34rem] divide-y divide-[var(--line-soft)] overflow-y-auto overscroll-contain">
                {visits.map((visit) => (
                  <VisitLine key={visit.appointment_id} visit={visit} />
                ))}
              </div>
              {/* Cortado a meio de uma linha, o rolo lia-se como avaria.
                  Este esbatido no fim diz que a lista continua. */}
              {visits.length > 8 ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--surface-raised)] to-transparent"
                />
              ) : null}
            </Card>
          )}
        </section>

        {/* --- notas internas -------------------------------------- */}
        <section>
          <h2 className="titulo-seccao mb-2">
            Notas da equipa
            {notes.length > 0 ? (
              <span className="tabular ml-2 font-normal normal-case tracking-normal text-[var(--ink-faint)]">
                {notes.length}
              </span>
            ) : null}
          </h2>
          <Card className="overflow-hidden">
            {notes.map((note) => (
              <div
                key={note.id}
                className="border-t border-[var(--line-soft)] px-4 py-3 first:border-t-0"
              >
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[var(--ink)]">
                    {note.body}
                  </p>
                  <DeleteNote clientId={client.id} noteId={note.id} />
                </div>
                <p className="mt-1.5 text-[0.6875rem] text-[var(--ink-faint)]">
                  {note.author ?? 'Equipa'} ·{' '}
                  {formatDateTime(note.created_at, tz)}
                </p>
              </div>
            ))}
            <NoteForm clientId={client.id} />
          </Card>
          <p className="mt-2 text-[0.75rem] text-[var(--ink-faint)]">
            Só a equipa vê. A cliente nunca.
          </p>
        </section>
      </div>

      {/*
        EDITAR É UMA PORTA, NÃO O CHÃO.

        O formulário estava sempre aberto e era mais de metade da página:
        vinha-se a uma ficha para LER — quem é, o que fez, o que a equipa
        escreveu — e o que se via primeiro era um formulário de vinte
        campos a empurrar tudo para cima.

        Fechado por omissão, como os serviços na Gestão.
      */}
      <details className="group mt-6">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] px-4 py-3 text-[0.875rem] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] [&::-webkit-details-marker]:hidden">
          Editar ficha
          <span className="ml-auto hidden text-[0.75rem] font-normal text-[var(--ink-faint)] sm:inline">
            nome, telefone, preferências, nota do serviço, etiquetas
          </span>
          <span
            aria-hidden
            className="text-[0.75rem] text-[var(--ink-faint)] group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>
        <Card className="mt-2 px-4 py-5 sm:px-6">
          <ClientForm
            client={client}
            units={options.units}
            staff={options.staff}
          />
        </Card>
      </details>
    </div>
  )
}

/**
 * Uma das quatro caixas. `value` a nulo é «não há» — desenha-se um
 * traço apagado, para a fila não perder o alinhamento.
 *
 * Cada caixa pinta o seu próprio fundo; o fio entre elas é o fundo do
 * quadro a aparecer pelo intervalo de um píxel.
 */
function Figure({
  label,
  value,
  proxima = false,
}: {
  label: string
  value: string | null
  proxima?: boolean
}) {
  return (
    <div
      className={clsx(
        'px-4 py-3',
        proxima
          ? 'bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface-raised))]'
          : 'bg-[var(--surface-raised)]',
      )}
    >
      <p
        className={clsx(
          'text-[0.625rem] font-semibold uppercase tracking-[0.13em]',
          proxima ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]',
        )}
      >
        {label}
      </p>
      <p
        className={clsx(
          'metric mt-1.5',
          value === null
            ? 'text-lg font-medium text-[var(--ink-faint)]'
            : proxima
              ? 'text-base text-[var(--accent)]'
              : 'text-xl text-[var(--ink)]',
        )}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

function VisitLine({ visit }: { visit: ClientVisit }) {
  const day = isoDay(visit.starts_at, visit.timezone)
  const net = Math.max(0, visit.gross_cents - visit.discount_cents)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <Link
            href={`/agenda/${visit.unit_slug}?d=${day}&m=${visit.appointment_id}`}
            className="tabular text-sm text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
          >
            {formatDateTime(visit.starts_at, visit.timezone)}
          </Link>
          <Badge tone={STATUS_TONE[visit.status]}>
            {STATUS_LABEL[visit.status]}
          </Badge>
          <span className="text-[0.75rem] text-[var(--ink-faint)]">
            {visit.unit_name}
          </span>
        </div>
        <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
          {visit.services ?? 'Sem serviços'}
          {visit.staff_names ? ` · ${visit.staff_names}` : ''}
        </p>
      </div>

      {/*
        O VALOR ERA UMA PORTA, E DEIXOU DE TER PARA ONDE DAR.

        Levava à comanda daquela visita, e por isso só ficava aceso
        depois de ela estar fechada. Sem comanda, o valor é só o que a
        visita valeu — e vale à mesma, esteja ou não concluída. Acende
        quando aconteceu: nas outras é o preço do que está combinado, e
        isso lê-se mais devagar.
      */}
      <span
        className={clsx(
          'tabular shrink-0 text-sm',
          visit.status === 'completed'
            ? 'text-[var(--ink)]'
            : 'text-[var(--ink-faint)]',
        )}
      >
        {formatCents(net)}
      </span>
    </div>
  )
}
