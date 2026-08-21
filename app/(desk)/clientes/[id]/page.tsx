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
import { formatDateTime, formatDayShort, isoDay } from '@/lib/time'
import { LANGUAGE_LABEL } from '@/lib/i18n/config'
import { waLink } from '@/lib/whatsapp'
import { ClientForm, DeleteNote, NoteForm } from '@/components/client-forms'
import { Badge, ButtonLink, Card, Divider, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Ficha da cliente' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  if (!UUID.test(id)) notFound()

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
        <div className="min-w-0">
          <h1 className="display text-2xl text-[var(--ink)]">{client.name}</h1>
          <p className="tabular mt-1 text-sm text-[var(--ink-muted)]">
            {client.phone}
            {client.email ? ` · ${client.email}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge>{LANGUAGE_LABEL[client.language]}</Badge>
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

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={waLink(client.phone, '')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 border border-[var(--line)] px-3 text-[0.8125rem] text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <MessageCircle size={14} />
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
      <Card className="mb-6 px-4 py-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Figure
            label="Visitas"
            value={client.visits > 0 ? String(client.visits) : '—'}
          />
          <Figure
            label="Primeira"
            value={
              client.first_visit_at
                ? formatDayShort(isoDay(client.first_visit_at, tz), tz)
                : '—'
            }
          />
          <Figure
            label="Última"
            value={
              client.last_visit_at
                ? formatDayShort(isoDay(client.last_visit_at, tz), tz)
                : '—'
            }
          />
          <Figure
            label="Próxima"
            value={client.next_at ? formatDateTime(client.next_at, tz) : '—'}
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
          <h2 className="eyebrow mb-2">Histórico</h2>
          {visits.length === 0 ? (
            <Card className="px-4">
              <Empty
                title="Ainda não veio"
                hint="Assim que for atendida, aparece aqui — de qualquer das lojas."
              />
            </Card>
          ) : (
            <Card className="divide-y divide-[var(--line-soft)]">
              {visits.map((visit) => (
                <VisitLine key={visit.appointment_id} visit={visit} />
              ))}
            </Card>
          )}
        </section>

        {/* --- notas internas -------------------------------------- */}
        <section>
          <h2 className="eyebrow mb-2">Notas internas</h2>
          <Card className="px-4 py-4">
            <p className="mb-3 text-[0.75rem] text-[var(--ink-faint)]">
              Só a equipa vê isto. A cliente nunca.
            </p>
            <NoteForm clientId={client.id} />

            {notes.length > 0 ? (
              <ul className="mt-4 space-y-3 border-t border-[var(--line-soft)] pt-4">
                {notes.map((note) => (
                  <li key={note.id} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-[0.8125rem] text-[var(--ink)]">
                        {note.body}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-[var(--ink-faint)]">
                        {note.author ?? 'Alguém'} ·{' '}
                        {formatDateTime(note.created_at, tz)}
                      </p>
                    </div>
                    <DeleteNote clientId={client.id} noteId={note.id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </section>
      </div>

      {/* --- editar ------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="eyebrow mb-2">Editar ficha</h2>
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
      <dt className="eyebrow mb-0.5">{label}</dt>
      <dd
        className={
          accent
            ? 'tabular text-sm text-[var(--accent)]'
            : 'tabular text-sm text-[var(--ink)]'
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
      <dt className="w-20 shrink-0 text-[0.75rem] uppercase tracking-wide text-[var(--ink-faint)]">
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
