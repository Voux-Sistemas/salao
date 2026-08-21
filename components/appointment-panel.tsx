import Link from 'next/link'
import { X } from 'lucide-react'
import { formatCents } from '@/lib/money'
import { formatTime } from '@/lib/time'
import { nextStatuses, type AppointmentItemRow, type AppointmentRow, type Status } from '@/lib/booking'
import { SOURCE_LABEL, STATUS_ACTION, STATUS_LABEL, STATUS_TONE } from '@/lib/status'
import { composeMessage, loadTemplates } from '@/lib/notify'
import { Badge, ButtonLink } from '@/components/ui'
import { SendWhatsApp, StatusButtons } from '@/components/desk-actions'
import type { Actor } from '@/lib/auth/actor'
import { can } from '@/lib/auth/actor'

/**
 * O painel lateral: cliente, serviços, valor, e os botões do estado
 * seguinte. Mais «Enviar confirmação», que abre o WhatsApp e NÃO muda o
 * estado — são dois factos distintos.
 */

const VARIANT: Record<Status, 'primary' | 'outline' | 'quiet' | 'danger'> = {
  booked: 'quiet',
  confirmed: 'primary',
  checked_in: 'primary',
  in_service: 'primary',
  completed: 'primary',
  cancelled_by_client: 'danger',
  cancelled_by_salon: 'danger',
  no_show: 'danger',
}

export async function AppointmentPanel({
  actor,
  appointment,
  closeHref,
  confirmSent,
}: {
  actor: Actor
  appointment: AppointmentRow & { items: AppointmentItemRow[] }
  closeHref: string
  confirmSent: boolean
}) {
  const tz = appointment.unit_timezone
  const templates = await loadTemplates(appointment.org_id)

  const services = appointment.items.map((i) => i.service_name).join(' + ')
  const message = composeMessage(
    'confirm',
    {
      clientName: appointment.client_name,
      clientPhone: appointment.client_phone,
      language: appointment.language,
      unitName: appointment.unit_name,
      startsAt: appointment.starts_at,
      timezone: tz,
      services,
    },
    templates,
  )

  const options = nextStatuses(appointment.status).map((to) => ({
    to,
    label: STATUS_ACTION[to],
    variant: VARIANT[to],
  }))

  const total = appointment.total_cents - appointment.discount_cents

  return (
    <aside className="flex h-full flex-col border-l border-[var(--line)] bg-[var(--surface-raised)]">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3">
        <div className="min-w-0">
          <Link
            href={`/clientes/${appointment.client_id}`}
            className="display block truncate text-lg text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
          >
            {appointment.client_name}
          </Link>
          <p className="tabular text-[0.75rem] text-[var(--ink-muted)]">
            {appointment.client_phone}
          </p>
        </div>
        <Link
          href={closeHref}
          scroll={false}
          aria-label="Fechar"
          className="shrink-0 p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
        >
          <X className="h-4 w-4" />
        </Link>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[appointment.status]}>
            {STATUS_LABEL[appointment.status]}
          </Badge>
          <Badge>{SOURCE_LABEL[appointment.source]}</Badge>
          {confirmSent ? <Badge tone="ok">Confirmação enviada</Badge> : null}
          {appointment.closed_at ? <Badge tone="ok">Comanda fechada</Badge> : null}
          {appointment.rescheduled_from_id ? <Badge>Remarcada</Badge> : null}
        </div>

        <ul className="divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
          {appointment.items.map((item) => (
            <li key={item.id} className="flex items-baseline gap-3 py-2.5">
              <span className="tabular w-11 shrink-0 text-[0.8125rem] text-[var(--ink-muted)]">
                {formatTime(item.starts_at, tz)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-[var(--ink)]">
                  {item.service_name}
                </span>
                <span className="block truncate text-[0.75rem] text-[var(--ink-muted)]">
                  {item.staff_name} · {item.duration_minutes} min
                </span>
              </span>
              <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink)]">
                {formatCents(item.price_cents)}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1">
          {appointment.discount_cents > 0 ? (
            <div className="flex items-baseline justify-between text-[0.8125rem] text-[var(--ink-muted)]">
              <span>Desconto{appointment.discount_reason ? ` · ${appointment.discount_reason}` : ''}</span>
              <span className="tabular">
                −{formatCents(appointment.discount_cents)}
              </span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">Total</span>
            <span className="tabular display text-lg text-[var(--ink)]">
              {formatCents(total)}
            </span>
          </div>
        </div>

        {appointment.client_note ? (
          <div>
            <p className="eyebrow mb-1">Observação da cliente</p>
            <p className="text-[0.8125rem] text-[var(--ink-muted)]">
              {appointment.client_note}
            </p>
          </div>
        ) : null}

        {appointment.internal_note ? (
          <div>
            <p className="eyebrow mb-1">Nota interna</p>
            <p className="text-[0.8125rem] text-[var(--ink-muted)]">
              {appointment.internal_note}
            </p>
          </div>
        ) : null}
      </div>

      <footer className="space-y-4 border-t border-[var(--line-soft)] px-4 py-4">
        {options.length > 0 ? (
          <StatusButtons appointmentId={appointment.id} options={options} />
        ) : (
          <p className="text-[0.75rem] text-[var(--ink-faint)]">
            Esta marcação já não muda de estado.
          </p>
        )}

        <SendWhatsApp
          appointmentId={appointment.id}
          routine="confirm"
          href={message.href}
          message={message.text}
          label="Enviar confirmação"
          done={confirmSent}
        />

        {can.seeCash(actor) ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={`/agenda/${appointment.unit_slug}/comanda/${appointment.id}`}
              variant="outline"
              size="sm"
            >
              Comanda
            </ButtonLink>
            <ButtonLink
              href={`/agenda/${appointment.unit_slug}/remarcar/${appointment.id}`}
              variant="quiet"
              size="sm"
            >
              Remarcar
            </ButtonLink>
          </div>
        ) : null}
      </footer>
    </aside>
  )
}
