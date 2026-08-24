import Link from 'next/link'
import type { Metadata } from 'next'
import { requireOrgScope } from '@/lib/auth/actor'
import {
  listRules,
  pendingEntries,
  recentPayouts,
  ruleOptions,
  scopeOf,
  SCOPE_LABEL,
  type CommissionRule,
  type PendingEntry,
} from '@/lib/commissions'
import { pendingCommissionTable } from '@/lib/dashboard'
import { formatCents } from '@/lib/money'
import { requireOrg } from '@/lib/org'
import { formatDateTime, formatDayShort, isoDay } from '@/lib/time'
import { PayForm, RemoveRule, RuleForm } from '@/components/commission-forms'
import { Badge, Card, Empty, Notice } from '@/components/ui'

export const metadata: Metadata = { title: 'Comissões' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** "40.00" -> "40" · "37.50" -> "37,5" */
function percentText(value: string): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(
    Number(value),
  )
}

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
    pendingCommissionTable(actor.orgId),
    listRules(actor.orgId),
    ruleOptions(actor.orgId),
    recentPayouts(actor.orgId),
  ])

  const tz = org.timezone
  const open = chosen ? pending.find((row) => row.staff_id === chosen) : null
  const entries = open ? await pendingEntries(actor.orgId, open.staff_id) : []

  const totalPending = pending.reduce((sum, row) => sum + row.total_cents, 0)
  const totalBase = pending.reduce((sum, row) => sum + row.base_cents, 0)
  const totalEntries = pending.reduce((sum, row) => sum + row.entries, 0)

  const cellHead =
    'px-4 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-[var(--ink-faint)]'

  return (
    <div className="space-y-10">
      {/* --- o que falta pagar ------------------------------------- */}
      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">Por pagar</h2>
          {pending.length > 0 ? (
            <p className="text-[0.75rem] text-[var(--ink-faint)]">
              A percentagem ficou congelada no fecho de cada comanda.
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
          /* No telemóvel esta tabela tinha seis colunas e 640px de largura
             mínima: a Comissão — a única coluna por que se abre este ecrã —
             ficava fora do ecrã, atrás de um deslize horizontal que nada
             anunciava. Abaixo de `md` sobram o nome e o dinheiro; o resto
             desce para a linha de baixo do nome. */
          <Card className="overflow-x-auto">
            <table className="w-full text-sm md:min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--line-soft)] text-left">
                  <th className={cellHead}>Profissional</th>
                  <th className={`${cellHead} hidden md:table-cell`}>Desde</th>
                  <th className={`${cellHead} hidden text-right md:table-cell`}>
                    % congelada
                  </th>
                  <th className={`${cellHead} hidden text-right md:table-cell`}>
                    Base
                  </th>
                  <th className={`${cellHead} text-right`}>Comissão</th>
                  <th className={`${cellHead} hidden text-right md:table-cell`}>
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-soft)]">
                {pending.map((row) => {
                  const isOpen = row.staff_id === chosen
                  const percent =
                    row.percent_min === row.percent_max
                      ? `${percentText(row.percent_min)} %`
                      : `${percentText(row.percent_min)}–${percentText(row.percent_max)} %`
                  return (
                    <RowGroup key={row.staff_id} open={isOpen}>
                      <tr
                        className="transition-colors hover:bg-[var(--surface-2)]"
                        style={
                          isOpen
                            ? { background: 'var(--surface-2)' }
                            : undefined
                        }
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={
                              isOpen
                                ? '/admin/comissoes'
                                : `/admin/comissoes?s=${row.staff_id}`
                            }
                            className="text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                          >
                            {row.name}
                          </Link>
                          <p className="mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
                            {row.entries} linha{row.entries === 1 ? '' : 's'}
                            <span className="md:hidden">
                              {' · desde '}
                              <span className="tabular">
                                {formatDayShort(isoDay(row.oldest_at, tz), tz)}
                              </span>
                              {' · '}
                              <span className="tabular">{percent}</span>
                            </span>
                          </p>
                        </td>
                        <td className="tabular hidden px-4 py-3 text-[0.8125rem] text-[var(--ink-muted)] md:table-cell">
                          {formatDayShort(isoDay(row.oldest_at, tz), tz)}
                        </td>
                        <td className="tabular hidden px-4 py-3 text-right text-[var(--ink-muted)] md:table-cell">
                          {percent}
                        </td>
                        <td className="tabular hidden px-4 py-3 text-right text-[var(--ink-muted)] md:table-cell">
                          {formatCents(row.base_cents)}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-[var(--ink)]">
                          {formatCents(row.total_cents)}
                        </td>
                        <td className="hidden px-4 py-3 text-right md:table-cell">
                          <Badge tone="warn">Pendente</Badge>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="border-t border-[var(--line-soft)] bg-[var(--surface-2)] px-4 py-4"
                          >
                            <ul className="mb-4 max-h-80 divide-y divide-[var(--line-soft)] overflow-y-auto pr-2">
                              {entries.map((entry) => (
                                <EntryLine
                                  key={entry.id}
                                  entry={entry}
                                  tz={tz}
                                />
                              ))}
                            </ul>
                            <PayForm
                              staffId={row.staff_id}
                              staffName={row.name}
                              totalCents={row.total_cents}
                              entries={row.entries}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </RowGroup>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 text-[0.8125rem] text-[var(--ink-muted)]">
                    Total · {totalEntries} linha{totalEntries === 1 ? '' : 's'}
                  </td>
                  <td className="hidden md:table-cell" />
                  <td className="hidden md:table-cell" />
                  <td className="tabular hidden px-4 py-3 text-right text-[var(--ink-muted)] md:table-cell">
                    {formatCents(totalBase)}
                  </td>
                  <td className="tabular px-4 py-3 text-right font-medium text-[var(--ink)]">
                    {formatCents(totalPending)}
                  </td>
                  <td className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
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
                <Badge tone="ok">Pago</Badge>
                <span className="tabular shrink-0 text-sm text-[var(--ink)]">
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

/** Agrupa a linha e o seu detalhe sem quebrar a semântica da tabela. */
function RowGroup({
  children,
}: {
  open: boolean
  children: React.ReactNode
}) {
  return <>{children}</>
}

function RuleLine({ rule }: { rule: CommissionRule }) {
  const scope = scopeOf(rule)
  const who =
    scope === 'house'
      ? 'Todas, em tudo'
      : [rule.staff_name, rule.service_name].filter(Boolean).join(' · ')

  return (
    /* A percentagem e o caixote ficam agarrados à direita; a etiqueta e a
       quem a regra se aplica partilham o resto e quebram entre si quando
       preciso. Numa só fila, «PROFISSIONAL + SERVIÇO» comia a largura toda
       e o nome saía truncado a «Marta ...» no telemóvel. */
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <Badge tone={scope === 'house' ? 'neutral' : 'accent'}>
          {SCOPE_LABEL[scope]}
        </Badge>
        <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
          {who}
        </p>
      </div>
      {/* A tabela em cima escreve «30 %» à portuguesa e aqui lia-se
          «30%», na mesma página e a poucos centímetros de distância. */}
      <span className="tabular shrink-0 text-sm text-[var(--ink)]">
        {percentText(rule.percent)} %
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
        × {percentText(entry.percent)} %
      </span>
      <span className="tabular shrink-0 text-sm text-[var(--ink)]">
        {formatCents(entry.amount_cents)}
      </span>
    </li>
  )
}
