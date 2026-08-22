import Link from 'next/link'
import { formatCents } from '@/lib/money'
import { formatDayLong, formatTime, isoDay } from '@/lib/time'
import {
  nextStatuses,
  type AppointmentItemRow,
  type AppointmentRow,
} from '@/lib/booking'
import { SOURCE_LABEL, STATUS_ACTION, STATUS_LABEL } from '@/lib/status'
import { composeMessage, loadTemplates } from '@/lib/notify'
import { Badge, ButtonLink } from '@/components/ui'
import { SendWhatsApp, StatusButtons } from '@/components/desk-actions'
import { AGENDA_TONE } from '@/components/agenda-grid'
import { IconClose } from '@/components/desk-icons'
import type { Actor } from '@/lib/auth/actor'
import { can } from '@/lib/auth/actor'
import { formatPhone } from '@/lib/text'

/**
 * O painel lateral: cliente, serviços, valor — e as acções por ordem de
 * importância. Primeiro o passo natural do dia (confirmar, check-in,
 * iniciar, concluir), depois a palavra à cliente (WhatsApp), depois o
 * dinheiro (comanda) e só no fim o que corre mal (cancelar, falta).
 *
 * «Enviar confirmação» abre o WhatsApp e NÃO muda o estado — mandar a
 * mensagem e a cliente confirmar são dois factos distintos.
 */
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
  }))

  const total = appointment.total_cents - appointment.discount_cents
  const whenDay = capitalise(
    formatDayLong(isoDay(appointment.starts_at, tz), tz),
  )
  const closeTab =
    can.seeCash(actor) &&
    appointment.status === 'completed' &&
    !appointment.closed_at

  return (
    <div className="flex h-full flex-col border-l border-[var(--line)] bg-[var(--surface-raised)]">
      <header className="border-b border-[var(--line-soft)] px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">Marcação · {SOURCE_LABEL[appointment.source]}</p>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Fechar"
            className="-mr-1 -mt-1 shrink-0 p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
          >
            <IconClose className="h-4 w-4" />
          </Link>
        </div>

        <Link
          href={`/clientes/${appointment.client_id}`}
          className="display mt-1.5 block truncate text-xl leading-tight text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
        >
          {appointment.client_name}
        </Link>
        <a
          href={`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir conversa no WhatsApp"
          className="tabular text-[0.75rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          {formatPhone(appointment.client_phone)}
        </a>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone={AGENDA_TONE[appointment.status]}>
            {STATUS_LABEL[appointment.status]}
          </Badge>
          {confirmSent ? <Badge tone="ok">Confirmação enviada</Badge> : null}
          {appointment.closed_at ? (
            <Badge tone="ok">Comanda fechada</Badge>
          ) : null}
          {appointment.rescheduled_from_id ? <Badge>Remarcada</Badge> : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <p className="text-[0.8125rem] text-[var(--ink)]">
          {whenDay} ·{' '}
          <span className="tabular">
            {formatTime(appointment.starts_at, tz)}–
            {formatTime(appointment.ends_at, tz)}
          </span>
        </p>

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
              <span>
                Desconto
                {appointment.discount_reason
                  ? ` · ${appointment.discount_reason}`
                  : ''}
              </span>
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

      <footer className="space-y-3 border-t border-[var(--line-soft)] px-5 py-4">
        {/* o passo seguinte do dia, com o resto atrás dele */}
        {closeTab ? (
          <ButtonLink
            href={`/agenda/${appointment.unit_slug}/comanda/${appointment.id}`}
            className="w-full"
          >
            Fechar comanda
          </ButtonLink>
        ) : null}

        {options.length > 0 ? (
          <StatusButtons appointmentId={appointment.id} options={options} />
        ) : !closeTab ? (
          <p className="text-[0.75rem] text-[var(--ink-faint)]">
            Esta marcação já não muda de estado.
          </p>
        ) : null}

        <SendWhatsApp
          appointmentId={appointment.id}
          routine="confirm"
          href={message.href}
          message={message.text}
          label="Enviar confirmação"
          done={confirmSent}
          className="w-full"
        />

        {can.seeCash(actor) ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--line-soft)] pt-3">
            {!closeTab ? (
              <ButtonLink
                href={`/agenda/${appointment.unit_slug}/comanda/${appointment.id}`}
                variant="outline"
                size="sm"
              >
                Comanda
              </ButtonLink>
            ) : null}
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
    </div>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
