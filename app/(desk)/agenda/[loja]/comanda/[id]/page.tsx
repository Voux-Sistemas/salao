import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireManagement, resolveUnit } from '@/lib/auth/actor'
import { getAppointment } from '@/lib/booking'
import { loadPayments, totals } from '@/lib/comanda'
import { sql } from '@/lib/db'
import { formatCents } from '@/lib/money'
import {
  PAYMENT_METHOD_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from '@/lib/status'
import { formatDayLong, formatDayShort, formatTime, isoDay } from '@/lib/time'
import {
  CloseComanda,
  DiscountForm,
  PaymentForm,
  RemovePayment,
} from '@/components/comanda-forms'
import { Ornament } from '@/components/brand'
import { Badge, Card, Empty } from '@/components/ui'
import { formatPhone } from '@/lib/text'

export const metadata: Metadata = { title: 'Comanda' }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CommissionRow = {
  id: string
  staff_name: string
  service_name: string
  base_cents: number
  percent: string
  amount_cents: number
  status: 'pending' | 'paid'
}

/**
 * O ECRÃ DO FECHO. Não há comanda separada — a comanda é a marcação.
 * Aqui só se acrescentam três coisas: desconto, pagamentos e o fecho.
 */
export default async function ComandaPage({
  params,
}: {
  params: Promise<{ loja: string; id: string }>
}) {
  const actor = await requireManagement()
  const { loja, id } = await params

  if (!UUID_RE.test(id)) notFound()

  const unit = await resolveUnit(actor, loja)
  const appointment = await getAppointment(id)

  // Marcação de outra loja, de outra rede ou inexistente: a mesma resposta.
  if (
    !appointment ||
    appointment.org_id !== actor.orgId ||
    appointment.unit_id !== unit.id
  ) {
    notFound()
  }

  const tz = unit.timezone
  const payments = await loadPayments(appointment.id)
  const sums = totals(
    appointment.total_cents,
    appointment.discount_cents,
    payments,
  )
  const closed = appointment.closed_at !== null
  const commissions = closed ? await loadCommissions(appointment.id) : []
  const commissionTotal = commissions.reduce((s, c) => s + c.amount_cents, 0)

  // Para o talão: quanto entrou por cada método.
  const methodTotals = new Map<keyof typeof PAYMENT_METHOD_LABEL, number>()
  for (const payment of payments) {
    methodTotals.set(
      payment.method,
      (methodTotals.get(payment.method) ?? 0) + payment.amount_cents,
    )
  }

  const day = isoDay(appointment.starts_at, tz)
  const backHref = `/agenda/${unit.slug}?d=${day}&m=${appointment.id}`

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à agenda
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Comanda · {unit.name}</p>
          <h1 className="display text-3xl text-[var(--ink)]">
            <Link
              href={`/clientes/${appointment.client_id}`}
              className="transition-colors hover:text-[var(--accent)]"
            >
              {appointment.client_name}
            </Link>
          </h1>
          <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
            {capitalise(formatDayLong(day, tz))} às{' '}
            <span className="tabular">
              {formatTime(appointment.starts_at, tz)}
            </span>
            {' · '}
            <span className="tabular">{formatPhone(appointment.client_phone)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[appointment.status]}>
            {STATUS_LABEL[appointment.status]}
          </Badge>
          <Badge>{SOURCE_LABEL[appointment.source]}</Badge>
        </div>
      </header>

      {closed && appointment.closed_at ? (
        <div className="mb-8 rounded-[2px] border border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_7%,transparent)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--ok)]">
            Fechada às {formatTime(appointment.closed_at, tz)}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">
            O resumo em baixo é definitivo — depois do fecho não se mexe em
            pagamentos nem em descontos.
          </p>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_21rem] lg:items-start">
        <div className="space-y-8">
          {/* --- itens, com preço congelado ------------------------- */}
          <section>
            <SectionTitle>Serviços</SectionTitle>
            <Card className="divide-y divide-[var(--line-soft)]">
              {appointment.items.map((item) => (
                <div key={item.id} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="tabular w-11 shrink-0 text-[0.8125rem] text-[var(--accent)]">
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
                  <span className="tabular shrink-0 text-sm text-[var(--ink)]">
                    {formatCents(item.price_cents)}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between bg-[var(--surface-2)] px-4 py-2.5">
                <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                  {appointment.items.length}{' '}
                  {appointment.items.length === 1 ? 'serviço' : 'serviços'}
                </span>
                <span className="tabular text-sm text-[var(--ink)]">
                  {formatCents(sums.itemsCents)}
                </span>
              </div>
            </Card>
          </section>

          {/* --- desconto ------------------------------------------- */}
          <section>
            <SectionTitle>Desconto</SectionTitle>
            {closed ? (
              <p className="text-sm text-[var(--ink-muted)]">
                {appointment.discount_cents > 0
                  ? `${formatCents(appointment.discount_cents)}${
                      appointment.discount_reason
                        ? ` · ${appointment.discount_reason}`
                        : ''
                    }`
                  : 'Sem desconto.'}
              </p>
            ) : (
              <Card className="px-4 py-4">
                <DiscountForm
                  appointmentId={appointment.id}
                  discountCents={appointment.discount_cents}
                  discountReason={appointment.discount_reason}
                />
              </Card>
            )}
          </section>

          {/* --- pagamentos ----------------------------------------- */}
          <section>
            <SectionTitle>Pagamentos</SectionTitle>
            {payments.length === 0 ? (
              <p className="mb-4 text-sm text-[var(--ink-muted)]">
                Ainda não entrou nada.
              </p>
            ) : (
              <Card className="mb-4 divide-y divide-[var(--line-soft)]">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-baseline gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-[var(--ink)]">
                        {PAYMENT_METHOD_LABEL[payment.method]}
                      </span>
                      <span className="block truncate text-[0.75rem] text-[var(--ink-muted)]">
                        <span className="tabular">
                          {formatTime(payment.received_at, tz)}
                        </span>
                        {payment.received_by ? ` · ${payment.received_by}` : ''}
                        {payment.note ? ` · ${payment.note}` : ''}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm text-[var(--ink)]">
                      {formatCents(payment.amount_cents)}
                    </span>
                    {closed ? null : (
                      <RemovePayment
                        appointmentId={appointment.id}
                        paymentId={payment.id}
                      />
                    )}
                  </div>
                ))}
              </Card>
            )}

            {closed ? null : (
              <Card className="px-4 py-4">
                <PaymentForm
                  appointmentId={appointment.id}
                  dueCents={Math.max(0, sums.dueCents)}
                />
              </Card>
            )}
          </section>

          {/* --- comissões geradas ---------------------------------- */}
          {closed ? (
            <section>
              <SectionTitle>Comissões geradas</SectionTitle>
              {commissions.length === 0 ? (
                <Empty
                  title="Nenhuma"
                  hint="Não há regra de comissão para estes serviços — e não haver regra não é o mesmo que zero por cento."
                />
              ) : (
                <Card className="divide-y divide-[var(--line-soft)]">
                  {commissions.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-baseline gap-3 px-4 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-[var(--ink)]">
                          {entry.staff_name}
                        </span>
                        <span className="block truncate text-[0.75rem] text-[var(--ink-muted)]">
                          {entry.service_name} ·{' '}
                          <span className="tabular">
                            {formatCents(entry.base_cents)} ×{' '}
                            {Number(entry.percent)}%
                          </span>
                        </span>
                      </span>
                      <Badge tone={entry.status === 'paid' ? 'ok' : 'neutral'}>
                        {entry.status === 'paid' ? 'Paga' : 'Por pagar'}
                      </Badge>
                      <span className="tabular shrink-0 text-sm text-[var(--ink)]">
                        {formatCents(entry.amount_cents)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between bg-[var(--surface-2)] px-4 py-2.5">
                    <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                      Total
                    </span>
                    <span className="tabular text-sm text-[var(--ink)]">
                      {formatCents(commissionTotal)}
                    </span>
                  </div>
                </Card>
              )}
            </section>
          ) : null}
        </div>

        {/* --- o talão ---------------------------------------------- */}
        <aside className="lg:sticky lg:top-20">
          <Card className="overflow-hidden shadow-[var(--shadow-soft)]">
            <div className="border-b border-dashed border-[var(--line)] px-5 pb-4 pt-5 text-center">
              <Ornament className="scale-90" />
              <p className="display mt-2.5 text-lg leading-tight text-[var(--ink)]">
                {appointment.client_name}
              </p>
              <p className="tabular mt-1 text-[0.75rem] text-[var(--ink-muted)]">
                {formatDayShort(day, tz)} ·{' '}
                {formatTime(appointment.starts_at, tz)} · {unit.name}
              </p>
            </div>

            <div className="space-y-2.5 px-5 py-4">
              <div className="space-y-1.5">
                {appointment.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="min-w-0 truncate text-[0.8125rem] text-[var(--ink)]">
                      {item.service_name}
                    </span>
                    <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink)]">
                      {formatCents(item.price_cents)}
                    </span>
                  </div>
                ))}
              </div>
              {sums.discountCents > 0 ? (
                <Line label="Desconto" cents={-sums.discountCents} muted />
              ) : null}

              <div className="flex items-end justify-between gap-3 border-t border-dashed border-[var(--line)] pt-3">
                <span className="eyebrow">A pagar</span>
                <span className="display tabular text-4xl leading-none text-[var(--ink)]">
                  {formatCents(sums.totalCents)}
                </span>
              </div>

              <div className="space-y-1.5 border-t border-dashed border-[var(--line)] pt-3">
                {[...methodTotals.entries()].map(([method, cents]) => (
                  <Line
                    key={method}
                    label={PAYMENT_METHOD_LABEL[method]}
                    cents={cents}
                    muted
                  />
                ))}
                <Line label="Recebido" cents={sums.paidCents} />
                {sums.dueCents !== 0 ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.8125rem] text-[var(--ink-muted)]">
                      {sums.dueCents > 0 ? 'Falta' : 'Troco'}
                    </span>
                    <span
                      className="tabular text-sm"
                      style={{
                        color:
                          sums.dueCents > 0
                            ? 'var(--warn)'
                            : 'var(--ink-muted)',
                      }}
                    >
                      {formatCents(Math.abs(sums.dueCents))}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-dashed border-[var(--line)] px-5 py-4">
              {closed && appointment.closed_at ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--ok)]">
                    Fechada às {formatTime(appointment.closed_at, tz)}
                  </p>
                  <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--ink-muted)]">
                    As comissões já foram geradas e o dinheiro vivo já entrou
                    na caixa.
                  </p>
                </div>
              ) : (
                <CloseComanda
                  appointmentId={appointment.id}
                  dueCents={Math.max(0, sums.dueCents)}
                />
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-3">
      <span className="eyebrow">{children}</span>
      <span className="h-px flex-1 bg-[var(--line-soft)]" aria-hidden />
    </h2>
  )
}

function Line({
  label,
  cents,
  muted = false,
}: {
  label: string
  cents: number
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[0.8125rem] text-[var(--ink-muted)]">{label}</span>
      <span
        className={
          muted
            ? 'tabular text-sm text-[var(--ink-muted)]'
            : 'tabular text-sm text-[var(--ink)]'
        }
      >
        {cents < 0 ? `−${formatCents(-cents)}` : formatCents(cents)}
      </span>
    </div>
  )
}

async function loadCommissions(appointmentId: string): Promise<CommissionRow[]> {
  return sql<CommissionRow[]>`
    select e.id, s.name as staff_name, i.service_name,
           e.base_cents, e.percent, e.amount_cents, e.status
      from commission_entry e
      join staff s on s.id = e.staff_id
      join appointment_item i on i.id = e.appointment_item_id
     where e.appointment_id = ${appointmentId}
     order by i.sort_order, i.starts_at
  `
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
