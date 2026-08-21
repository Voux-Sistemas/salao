import Link from 'next/link'
import type { Metadata } from 'next'
import { requireOrgScope } from '@/lib/auth/actor'
import {
  listRules,
  pendingByStaff,
  pendingEntries,
  recentPayouts,
  ruleOptions,
  scopeOf,
  SCOPE_LABEL,
  type CommissionRule,
  type PendingEntry,
} from '@/lib/commissions'
import { formatCents } from '@/lib/money'
import { requireOrg } from '@/lib/org'
import { formatDateTime, formatDayShort, isoDay } from '@/lib/time'
import { PayForm, RemoveRule, RuleForm } from '@/components/commission-forms'
import { Badge, Card, Empty, Notice } from '@/components/ui'

export const metadata: Metadata = { title: 'Comissões' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * COMISSÕES.
 *
 * Duas coisas neste ecrã: a regra, que decide o que se vai gerar, e o
 * que já foi gerado e falta pagar. Não se toca no que já está gerado —
 * cada entrada levou a percentagem congelada consigo no fecho da
 * comanda, e mudar a regra hoje não reescreve o mês passado.
 */
export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  const actor = await requireOrgScope()
  const { s } = await searchParams
  const chosen = s && UUID.test(s) ? s : null

  const [org, pending, rules, options, payouts] = await Promise.all([
    requireOrg(),
    pendingByStaff(actor.orgId),
    listRules(actor.orgId),
    ruleOptions(actor.orgId),
    recentPayouts(actor.orgId),
  ])

  const tz = org.timezone
  const open = chosen ? pending.find((row) => row.staff_id === chosen) : null
  const entries = open ? await pendingEntries(actor.orgId, open.staff_id) : []
  const totalPending = pending.reduce((sum, row) => sum + row.total_cents, 0)

  return (
    <div className="space-y-10">
      {/* --- o que falta pagar ------------------------------------- */}
      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">Por pagar</h2>
          {pending.length > 0 ? (
            <p className="tabular text-sm text-[var(--ink)]">
              {formatCents(totalPending)}
            </p>
          ) : null}
        </div>

        {pending.length === 0 ? (
          <Card className="px-4">
            <Empty
              title="Nada por pagar"
              hint="A comissão nasce quando se fecha uma comanda. Ainda não há nenhuma à espera."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-[var(--line-soft)]">
            {pending.map((row) => {
              const isOpen = row.staff_id === chosen
              return (
                <div key={row.staff_id}>
                  <Link
                    href={
                      isOpen
                        ? '/admin/comissoes'
                        : `/admin/comissoes?s=${row.staff_id}`
                    }
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--ink)]">{row.name}</p>
                      <p className="text-[0.75rem] text-[var(--ink-muted)]">
                        {row.entries} linha{row.entries === 1 ? '' : 's'} · desde{' '}
                        {formatDayShort(isoDay(row.oldest_at, tz), tz)}
                      </p>
                    </div>
                    <span
                      className="tabular shrink-0 text-sm"
                      style={{ color: isOpen ? 'var(--accent)' : 'var(--ink)' }}
                    >
                      {formatCents(row.total_cents)}
                    </span>
                  </Link>

                  {isOpen ? (
                    <div className="border-t border-[var(--line-soft)] bg-[var(--surface-2)] px-4 py-4">
                      <ul className="mb-4 divide-y divide-[var(--line-soft)]">
                        {entries.map((entry) => (
                          <EntryLine key={entry.id} entry={entry} tz={tz} />
                        ))}
                      </ul>
                      <PayForm
                        staffId={row.staff_id}
                        staffName={row.name}
                        totalCents={row.total_cents}
                        entries={row.entries}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </Card>
        )}
      </section>

      {/* --- as regras --------------------------------------------- */}
      <section>
        <h2 className="eyebrow mb-2">Regras</h2>
        <Card className="mb-3 px-4 py-5 sm:px-6">
          <RuleForm staff={options.staff} services={options.services} />
        </Card>

        {rules.length === 0 ? (
          <Notice tone="warn">
            Sem nenhuma regra não se gera comissão nenhuma — e zero não é o
            mesmo que a casa não ter decidido. Comece pela regra da casa.
          </Notice>
        ) : (
          <Card className="divide-y divide-[var(--line-soft)]">
            {rules.map((rule) => (
              <RuleLine key={rule.id} rule={rule} />
            ))}
          </Card>
        )}

        <p className="mt-2 text-[0.75rem] text-[var(--ink-faint)]">
          Ganha sempre a mais específica: profissional + serviço, depois
          profissional, depois serviço, depois a casa.
        </p>
      </section>

      {/* --- o que já se pagou -------------------------------------- */}
      {payouts.length > 0 ? (
        <section>
          <h2 className="eyebrow mb-2">Pagamentos recentes</h2>
          <Card className="divide-y divide-[var(--line-soft)]">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--ink)]">
                    {payout.staff_name}
                  </p>
                  <p className="text-[0.75rem] text-[var(--ink-muted)]">
                    {formatDateTime(payout.paid_at, tz)} · {payout.entry_count}{' '}
                    linha{payout.entry_count === 1 ? '' : 's'}
                    {payout.paid_by ? ` · por ${payout.paid_by}` : ''}
                    {payout.note ? ` · ${payout.note}` : ''}
                  </p>
                </div>
                <span className="tabular shrink-0 text-sm text-[var(--ink-muted)]">
                  {formatCents(payout.total_cents)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  )
}

function RuleLine({ rule }: { rule: CommissionRule }) {
  const scope = scopeOf(rule)
  const who =
    scope === 'house'
      ? 'Todas, em tudo'
      : [rule.staff_name, rule.service_name].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <Badge tone={scope === 'house' ? 'neutral' : 'accent'}>
        {SCOPE_LABEL[scope]}
      </Badge>
      <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{who}</p>
      <span className="tabular shrink-0 text-sm text-[var(--ink)]">
        {Number(rule.percent)}%
      </span>
      <RemoveRule id={rule.id} />
    </div>
  )
}

function EntryLine({ entry, tz }: { entry: PendingEntry; tz: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
      <div className="min-w-0 flex-1">
        <Link
          href={`/agenda/${entry.unit_slug}/comanda/${entry.appointment_id}`}
          className="text-[0.8125rem] text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
        >
          {entry.service_name}
        </Link>
        <p className="text-[0.75rem] text-[var(--ink-muted)]">
          {formatDayShort(isoDay(entry.generated_at, tz), tz)} ·{' '}
          {entry.client_name} · {entry.unit_name}
        </p>
      </div>
      <span className="tabular shrink-0 text-[0.75rem] text-[var(--ink-faint)]">
        {formatCents(entry.item_price_cents)}
        {entry.discount_share_cents > 0
          ? ` − ${formatCents(entry.discount_share_cents)}`
          : ''}{' '}
        × {Number(entry.percent)}%
      </span>
      <span className="tabular shrink-0 text-sm text-[var(--ink)]">
        {formatCents(entry.amount_cents)}
      </span>
    </li>
  )
}
