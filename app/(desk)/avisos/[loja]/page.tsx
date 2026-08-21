import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { requireManagement, resolveUnit, unitsFor } from '@/lib/auth/actor'
import { loadQueues, type NoticeRow } from '@/lib/notices'
import { composeMessage, loadTemplates } from '@/lib/notify'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/status'
import { formatDayShort, formatTime, isoDay } from '@/lib/time'
import { ROUTINES, ROUTINE_HINT, ROUTINE_LABEL, type Routine } from '@/lib/whatsapp'
import { SendWhatsApp } from '@/components/desk-actions'
import { UnitSwitcher } from '@/components/unit-switcher'
import { Badge, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Avisos' }

/**
 * A FILA. Uma aba por rotina, e em cada linha um botão que abre a
 * conversa com a mensagem escrita.
 *
 * Carregar no botão faz duas coisas de uma vez: abre o WhatsApp e grava
 * o envio — e é o registo que tira a linha da fila. O que não faz é
 * mudar o estado da marcação: mandar a confirmação não é a cliente
 * confirmar.
 */
export default async function AvisosPage({
  params,
  searchParams,
}: {
  params: Promise<{ loja: string }>
  searchParams: Promise<{ r?: string }>
}) {
  const actor = await requireManagement()
  const { loja } = await params
  const { r } = await searchParams

  const unit = await resolveUnit(actor, loja)
  const routine: Routine =
    r && (ROUTINES as string[]).includes(r) ? (r as Routine) : 'confirm'

  const [queues, units, templates] = await Promise.all([
    loadQueues(unit),
    unitsFor(actor),
    loadTemplates(actor.orgId),
  ])

  const rows = queues[routine]
  const here = `/avisos/${unit.slug}`

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">{unit.name}</p>
          <h1 className="display text-2xl text-[var(--ink)]">Avisos</h1>
          <p className="mt-1 max-w-lg text-[0.8125rem] text-[var(--ink-muted)]">
            O sistema não envia sozinho: prepara a mensagem e abre a conversa.
            Quem carrega no botão é uma pessoa — e é o envio que tira a linha
            da fila.
          </p>
        </div>
        <UnitSwitcher
          units={units}
          current={unit.slug}
          base="/avisos"
          showAll={false}
        />
      </header>

      {/* --- as abas ------------------------------------------------ */}
      <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Rotinas">
        {ROUTINES.map((value) => {
          const count = queues[value].length
          const active = value === routine
          return (
            <Link
              key={value}
              href={value === 'confirm' ? here : `${here}?r=${value}`}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-2 border px-3 py-1.5 text-[0.8125rem] transition-colors',
                active
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
              )}
            >
              {ROUTINE_LABEL[value]}
              <span
                className={clsx(
                  'tabular text-[0.6875rem]',
                  count > 0 ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)]',
                )}
              >
                {count}
              </span>
            </Link>
          )
        })}

        {/* Os códigos de acesso não são de loja nenhuma: a ficha da
            cliente é uma só na rede. */}
        <Link
          href="/avisos/codigos"
          className="flex items-center gap-2 border border-[var(--line-soft)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Códigos de acesso
        </Link>
      </nav>

      <p className="mb-4 text-[0.8125rem] text-[var(--ink-muted)]">
        {ROUTINE_HINT[routine]}
      </p>

      {rows.length === 0 ? (
        <Empty
          title="Fila vazia"
          hint="Ninguém se enquadra nesta rotina neste momento. Nada a fazer."
        />
      ) : (
        <Card className="divide-y divide-[var(--line-soft)]">
          {rows.map((row) => (
            <NoticeLine
              key={row.appointment_id}
              row={row}
              routine={routine}
              unitName={unit.name}
              unitSlug={unit.slug}
              timezone={unit.timezone}
              templates={templates}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

function NoticeLine({
  row,
  routine,
  unitName,
  unitSlug,
  timezone,
  templates,
}: {
  row: NoticeRow
  routine: Routine
  unitName: string
  unitSlug: string
  timezone: string
  templates: Awaited<ReturnType<typeof loadTemplates>>
}) {
  const services = row.services ?? ''
  const message = composeMessage(
    routine,
    {
      clientName: row.client_name,
      clientPhone: row.client_phone,
      language: row.language,
      unitName,
      startsAt: row.starts_at,
      timezone,
      services,
    },
    templates,
  )

  const day = isoDay(row.starts_at, timezone)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <Link
            href={`/clientes/${row.client_id}`}
            className="truncate text-sm text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
          >
            {row.client_name}
          </Link>
          <span className="tabular text-[0.75rem] text-[var(--ink-muted)]">
            {row.client_phone}
          </span>
          {routine === 'winback' ? (
            <Badge tone={STATUS_TONE[row.status]}>
              {STATUS_LABEL[row.status]}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
          <Link
            href={`/agenda/${unitSlug}?d=${day}&m=${row.appointment_id}`}
            className="tabular underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
          >
            {formatDayShort(day, timezone)} · {formatTime(row.starts_at, timezone)}
          </Link>
          {services ? ` · ${services}` : ''}
          {row.staff_names ? ` · ${row.staff_names}` : ''}
        </p>
      </div>

      <SendWhatsApp
        appointmentId={row.appointment_id}
        routine={routine}
        href={message.href}
        message={message.text}
        label="Enviar"
      />
    </div>
  )
}
