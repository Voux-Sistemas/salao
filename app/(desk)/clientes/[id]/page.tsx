import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
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
  Divider,
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

      {/* --- quem é ------------------------------------------------- */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-2)] text-[var(--accent)]">
            <Monogram initials={initialsOf(client.name)} className="text-2xl" />
          </span>
          <div className="min-w-0">
            <h1 className="display text-3xl text-[var(--ink)]">
              {client.name}
            </h1>
            {/* O ponto separador ficava colado ao telefone e, quando o
                e-mail descia para a linha seguinte, a de cima acabava
                num «·» pendurado. Preso ao e-mail, desce com ele. (O
                número já não se parte: os espaços de `formatPhone` são
                inquebráveis.) */}
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              <span className="tabular">{formatPhone(client.phone)}</span>
              {client.email ? (
                <span className="whitespace-nowrap"> · {client.email}</span>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge>{LANGUAGE_LABEL[client.language]}</Badge>
              {client.no_show_count > 0 ? (
                <Badge tone="warn">
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

      {/* --- o essencial -------------------------------------------- */}
      <Card className="mb-6 px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Figure
            label="Visitas"
            value={client.visits > 0 ? String(client.visits) : '—'}
          />
          <Figure
            label="Primeira"
            value={
              firstVisitAt
                ? formatDayShort(isoDay(firstVisitAt, tz), tz)
                : '—'
            }
          />
          <Figure
            label="Última"
            value={
              lastVisitAt ? formatDayShort(isoDay(lastVisitAt, tz), tz) : '—'
            }
          />
          {/* As três primeiras são curtas — 20, 10/07, 21/08 — e esta
              vinha por extenso, «22 de agosto às 15:00», a quebrar em
              duas linhas e a desalinhar a fila toda. Aqui só se quer
              saber quando é: 22/08 · 15:00 chega e cabe. */}
          <Figure
            label="Próxima"
            value={
              client.next_at ? formatDateTimeShort(client.next_at, tz) : '—'
            }
            accent={Boolean(client.next_at)}
          />
        </dl>

        {client.drink_preference ||
        client.allergies ||
        client.service_notes ||
        client.preferred_unit_name ||
        client.preferred_staff_name ? (
          <>
            <Divider className="my-4" />
            <dl className="space-y-2 text-sm">
              {client.allergies ? (
                <Line label="Alergias" tone="bad">
                  {client.allergies}
                </Line>
              ) : null}
              {client.drink_preference ? (
                <Line label="Bebida">{client.drink_preference}</Line>
              ) : null}
              {client.preferred_unit_name || client.preferred_staff_name ? (
                <Line label="Prefere">
                  {[client.preferred_unit_name, client.preferred_staff_name]
                    .filter(Boolean)
                    .join(' · ')}
                </Line>
              ) : null}
              {client.service_notes ? (
                <Line label="Serviço">{client.service_notes}</Line>
              ) : null}
            </dl>
          </>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
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
          <h2 className="titulo-seccao mb-2">Notas da equipa</h2>
          <Card className="px-4 py-4">
            <p className="mb-3 text-[0.75rem] text-[var(--ink-faint)]">
              Só a equipa vê isto. A cliente nunca.
            </p>
            <NoteForm clientId={client.id} />

            {notes.length > 0 ? (
              <ul className="mt-4 space-y-2.5 border-t border-[var(--line-soft)] pt-4">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-2)] px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-[0.8125rem] text-[var(--ink)]">
                        {note.body}
                      </p>
                      <DeleteNote clientId={client.id} noteId={note.id} />
                    </div>
                    <p className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                      {note.author ?? 'Equipa'} ·{' '}
                      {formatDateTime(note.created_at, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </section>
      </div>

      {/* --- editar ------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="titulo-seccao mb-2">Editar ficha</h2>
        <Card className="px-4 py-5 sm:px-6">
          <ClientForm
            client={client}
            units={options.units}
            staff={options.staff}
          />
        </Card>
      </section>
    </div>
  )
}

function Figure({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
        {label}
      </dt>
      <dd
        className={
          accent
            ? 'tabular mt-0.5 text-sm text-[var(--accent)]'
            : 'tabular mt-0.5 text-sm text-[var(--ink)]'
        }
      >
        {value}
      </dd>
    </div>
  )
}

function Line({
  label,
  tone = 'neutral',
  children,
}: {
  label: string
  tone?: 'neutral' | 'bad'
  children: string
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-[0.75rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
        {label}
      </dt>
      <dd
        className="min-w-0 flex-1 whitespace-pre-wrap"
        style={{ color: tone === 'bad' ? 'var(--bad)' : 'var(--ink)' }}
      >
        {children}
      </dd>
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

      {visit.closed_at ? (
        <Link
          href={`/agenda/${visit.unit_slug}/comanda/${visit.appointment_id}`}
          className="tabular shrink-0 text-sm text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
        >
          {formatCents(net)}
        </Link>
      ) : (
        <span className="tabular shrink-0 text-sm text-[var(--ink-faint)]">
          {formatCents(net)}
        </span>
      )}
    </div>
  )
}
