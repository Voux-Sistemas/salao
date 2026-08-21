import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement, resolveUnit, unitsFor } from '@/lib/auth/actor'
import {
  expectedCents,
  KIND_LABEL,
  loadMovements,
  openSession,
  recentSessions,
  type CashMovement,
  type CashSession,
} from '@/lib/cash'
import { formatCents } from '@/lib/money'
import { formatDayLong, formatDayShort, formatTime } from '@/lib/time'
import {
  CloseCashForm,
  MovementForm,
  OpenCashForm,
} from '@/components/cash-forms'
import { UnitSwitcher } from '@/components/unit-switcher'
import { Badge, Card, Divider, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Caixa' }

/**
 * A CAIXA de uma loja.
 *
 * Abre-se com o que está na gaveta. Durante o dia o dinheiro vivo entra
 * sozinho — cada comanda fechada em numerário deixa aqui a sua linha — e
 * reforços e sangrias são à mão. Fecha-se contando a gaveta: o esperado
 * está à vista, o contado grava-se, e a diferença fica escrita.
 */
export default async function CaixaPage({
  params,
}: {
  params: Promise<{ loja: string }>
}) {
  const actor = await requireManagement()
  const { loja } = await params
  const unit = await resolveUnit(actor, loja)

  const [session, units, history] = await Promise.all([
    openSession(unit.id),
    unitsFor(actor),
    recentSessions(unit.id, 14),
  ])
  const movements = session ? await loadMovements(session.id) : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">{unit.name}</p>
          <h1 className="display text-2xl text-[var(--ink)]">Caixa</h1>
        </div>
        <UnitSwitcher
          units={units}
          current={unit.slug}
          base="/caixa"
          showAll={false}
        />
      </header>

      {session ? (
        <OpenDrawer
          session={session}
          movements={movements}
          unitSlug={unit.slug}
          timezone={unit.timezone}
        />
      ) : (
        <Card className="px-4 py-6">
          <Empty
            title="Caixa fechada"
            hint="Conte o que está na gaveta e abra o dia. Enquanto a caixa estiver fechada não se pode receber em dinheiro."
          />
          <div className="mx-auto max-w-sm">
            <OpenCashForm unitSlug={unit.slug} />
          </div>
        </Card>
      )}

      {history.length > 0 ? (
        <History sessions={history} timezone={unit.timezone} />
      ) : null}
    </div>
  )
}

/* --- a caixa aberta ------------------------------------------------- */

function OpenDrawer({
  session,
  movements,
  unitSlug,
  timezone,
}: {
  session: CashSession
  movements: CashMovement[]
  unitSlug: string
  timezone: string
}) {
  const expected = expectedCents(session, movements)
  const entries = movements
    .filter((m) => m.amount_cents > 0)
    .reduce((sum, m) => sum + m.amount_cents, 0)
  const exits = movements
    .filter((m) => m.amount_cents < 0)
    .reduce((sum, m) => sum + m.amount_cents, 0)

  return (
    <div className="space-y-5">
      <Card className="px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">
              {formatDayLong(session.business_date, timezone)}
            </p>
            <p className="text-[0.8125rem] text-[var(--ink-muted)]">
              Aberta às {formatTime(session.opened_at, timezone)}
              {session.opened_by ? ` por ${session.opened_by}` : ''}
            </p>
          </div>
          <Badge tone="ok">Aberta</Badge>
        </div>

        <Divider className="my-4" />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Figure label="Abertura" cents={session.opening_cents} />
          <Figure label="Entradas" cents={entries} />
          <Figure label="Sangrias" cents={exits} />
          <Figure label="Esperado" cents={expected} strong />
        </dl>
      </Card>

      {/* --- o que passou pela gaveta ------------------------------- */}
      <Card>
        <p className="eyebrow px-4 pt-4">Movimentos</p>
        {movements.length === 0 ? (
          <p className="px-4 py-6 text-center text-[0.8125rem] text-[var(--ink-muted)]">
            Ainda não passou nada pela gaveta hoje.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--line-soft)]">
            {movements.map((movement) => (
              <li
                key={movement.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
              >
                <span className="tabular w-12 shrink-0 text-[0.75rem] text-[var(--ink-faint)]">
                  {formatTime(movement.created_at, timezone)}
                </span>
                <span className="text-sm text-[var(--ink)]">
                  {KIND_LABEL[movement.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.75rem] text-[var(--ink-muted)]">
                  {movement.appointment_id ? (
                    <Link
                      href={`/agenda/${unitSlug}/comanda/${movement.appointment_id}`}
                      className="underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                    >
                      {movement.client_name ?? 'Comanda'}
                    </Link>
                  ) : (
                    (movement.note ?? '—')
                  )}
                  {movement.by_staff ? ` · ${movement.by_staff}` : ''}
                </span>
                <span
                  className="tabular text-sm"
                  style={{
                    color:
                      movement.amount_cents < 0 ? 'var(--bad)' : 'var(--ink)',
                  }}
                >
                  {movement.amount_cents > 0 ? '+' : ''}
                  {formatCents(movement.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Divider />

        <div className="space-y-4 px-4 py-4">
          <MovementForm unitSlug={unitSlug} kind="reinforcement" />
          <MovementForm unitSlug={unitSlug} kind="withdrawal" />
        </div>
      </Card>

      {/* --- fechar é contar --------------------------------------- */}
      <Card className="px-4 py-4">
        <p className="eyebrow mb-1">Fechar o dia</p>
        <p className="mb-4 text-[0.8125rem] text-[var(--ink-muted)]">
          Conte a gaveta e escreva o que lá está. A diferença fica registada —
          não se corrige nem se esconde.
        </p>
        <CloseCashForm unitSlug={unitSlug} expectedCents={expected} />
      </Card>
    </div>
  )
}

function Figure({
  label,
  cents,
  strong = false,
}: {
  label: string
  cents: number
  strong?: boolean
}) {
  return (
    <div>
      <dt className="eyebrow mb-0.5">{label}</dt>
      <dd
        className={
          strong
            ? 'tabular text-lg text-[var(--accent)]'
            : 'tabular text-sm text-[var(--ink)]'
        }
      >
        {formatCents(cents)}
      </dd>
    </div>
  )
}

/* --- os dias já fechados -------------------------------------------- */

function History({
  sessions,
  timezone,
}: {
  sessions: CashSession[]
  timezone: string
}) {
  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-2">Dias fechados</h2>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-[var(--ink-faint)]">
              <th className="px-4 py-2 font-normal">Dia</th>
              <th className="px-4 py-2 font-normal">Abertura</th>
              <th className="px-4 py-2 font-normal">Esperado</th>
              <th className="px-4 py-2 font-normal">Contado</th>
              <th className="px-4 py-2 font-normal">Diferença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-soft)]">
            {sessions.map((session) => {
              const difference = session.difference_cents ?? 0
              return (
                <tr key={session.id}>
                  <td className="px-4 py-2 text-[var(--ink)]">
                    {formatDayShort(session.business_date, timezone)}
                    {session.closed_by ? (
                      <span className="block text-[0.6875rem] text-[var(--ink-faint)]">
                        {session.closed_by}
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular px-4 py-2 text-[var(--ink-muted)]">
                    {formatCents(session.opening_cents)}
                  </td>
                  <td className="tabular px-4 py-2 text-[var(--ink-muted)]">
                    {formatCents(session.expected_cents ?? 0)}
                  </td>
                  <td className="tabular px-4 py-2 text-[var(--ink)]">
                    {formatCents(session.counted_cents ?? 0)}
                  </td>
                  <td
                    className="tabular px-4 py-2"
                    style={{
                      color:
                        difference === 0
                          ? 'var(--ink-faint)'
                          : difference > 0
                            ? 'var(--warn)'
                            : 'var(--bad)',
                    }}
                  >
                    {difference > 0 ? '+' : ''}
                    {formatCents(difference)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </section>
  )
}
