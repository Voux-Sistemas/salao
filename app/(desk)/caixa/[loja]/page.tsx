import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement, resolveUnit, unitsFor } from '@/lib/auth/actor'
import {
  expectedCents,
  KIND_LABEL,
  loadMovements,
  openSession,
  recentSessions,
  type CashKind,
  type CashMovement,
  type CashSession,
} from '@/lib/cash'
import { sql } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/status'
import {
  formatDayLong,
  formatDayShort,
  formatTime,
  type IsoDay,
} from '@/lib/time'
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

const METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]

type MethodTotal = { method: PaymentMethod; total: number; count: number }

/** O que a loja recebeu no dia, por método. Leitura, apenas. */
async function methodTotals(
  unitId: string,
  day: IsoDay,
  timezone: string,
): Promise<MethodTotal[]> {
  return sql<MethodTotal[]>`
    select p.method, sum(p.amount_cents)::int as total, count(*)::int as count
      from payment p
      join appointment a on a.id = p.appointment_id
     where a.unit_id = ${unitId}
       and (p.received_at at time zone ${timezone})::date = ${day}::date
     group by p.method
  `
}

const KIND_TONE: Record<CashKind, 'neutral' | 'accent' | 'ok' | 'warn'> = {
  sale: 'ok',
  reinforcement: 'accent',
  withdrawal: 'warn',
  adjustment: 'neutral',
}

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
  const [movements, methods] = await Promise.all([
    session ? loadMovements(session.id) : Promise.resolve([]),
    session
      ? methodTotals(unit.id, session.business_date, unit.timezone)
      : Promise.resolve([] as MethodTotal[]),
  ])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">{unit.name}</p>
          <h1 className="display text-3xl text-[var(--ink)]">Caixa</h1>
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
          methods={methods}
          unitSlug={unit.slug}
          timezone={unit.timezone}
        />
      ) : (
        <Card className="px-4 py-6">
          <Empty
            title="Caixa fechada"
            hint="Conte o que está na gaveta e abra o dia. Enquanto a caixa estiver fechada não se pode receber em dinheiro."
          />
          <div className="mx-auto max-w-sm pb-4">
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
  methods,
  unitSlug,
  timezone,
}: {
  session: CashSession
  movements: CashMovement[]
  methods: MethodTotal[]
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
    <div className="space-y-6">
      {/* --- o estado da sessão, à cabeça ---------------------------- */}
      <Card className="px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-1.5">
              {formatDayLong(session.business_date, timezone)}
            </p>
            <p className="display text-xl text-[var(--ink)]">
              Aberta desde as {formatTime(session.opened_at, timezone)}
            </p>
            <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
              {session.opened_by ? `Por ${session.opened_by}, ` : ''}
              com um fundo de abertura de{' '}
              <span className="tabular text-[var(--ink)]">
                {formatCents(session.opening_cents)}
              </span>
              .
            </p>
          </div>
          <Badge tone="ok">Caixa aberta</Badge>
        </div>

        <Divider className="my-4" />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Figure label="Fundo de abertura" cents={session.opening_cents} />
          <Figure label="Entradas" cents={entries} />
          <Figure label="Sangrias" cents={exits} />
          <Figure label="Esperado na gaveta" cents={expected} strong />
        </dl>
      </Card>

      {/* --- o dia por método de pagamento --------------------------- */}
      <section>
        <h2 className="titulo-seccao mb-2">Recebido no dia, por método</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METHODS.map((method) => {
            const found = methods.find((m) => m.method === method)
            const total = found?.total ?? 0
            const count = found?.count ?? 0
            return (
              <Card key={method} className="px-4 py-3">
                <p className="text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                  {PAYMENT_METHOD_LABEL[method]}
                </p>
                <p
                  className={
                    total > 0
                      ? 'tabular mt-1 text-lg text-[var(--ink)]'
                      : 'tabular mt-1 text-lg text-[var(--ink-faint)]'
                  }
                >
                  {formatCents(total)}
                </p>
                <p className="tabular mt-0.5 text-[0.6875rem] text-[var(--ink-faint)]">
                  {count === 0
                    ? 'Sem pagamentos'
                    : `${count} pagamento${count === 1 ? '' : 's'}`}
                </p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* --- o que passou pela gaveta -------------------------------- */}
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
          <h2 className="titulo-seccao">Movimentos da gaveta</h2>
          <span className="tabular text-[0.75rem] text-[var(--ink-faint)]">
            {movements.length === 0
              ? ''
              : `${movements.length} movimento${movements.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {movements.length === 0 ? (
          <p className="px-5 py-6 text-[0.8125rem] text-[var(--ink-muted)]">
            Ainda não passou nada pela gaveta hoje.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="tabular w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                  <th className="px-5 py-2 font-normal">Hora</th>
                  <th className="px-3 py-2 font-normal">Tipo</th>
                  <th className="px-3 py-2 font-normal">Detalhe</th>
                  <th className="px-5 py-2 text-right font-normal">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-soft)]">
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="w-16 px-5 py-2.5 text-[0.8125rem] text-[var(--ink-muted)]">
                      {formatTime(movement.created_at, timezone)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={KIND_TONE[movement.kind]}>
                        {KIND_LABEL[movement.kind]}
                      </Badge>
                    </td>
                    <td className="max-w-0 px-3 py-2.5">
                      <span className="block truncate text-[0.8125rem] text-[var(--ink-muted)]">
                        {movement.appointment_id ? (
                          <Link
                            href={`/agenda/${unitSlug}/comanda/${movement.appointment_id}`}
                            className="text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                          >
                            {movement.client_name ?? 'Comanda'}
                          </Link>
                        ) : (
                          (movement.note ?? '—')
                        )}
                        {movement.by_staff ? ` · ${movement.by_staff}` : ''}
                      </span>
                    </td>
                    <td
                      className="px-5 py-2.5 text-right"
                      style={{
                        color:
                          movement.amount_cents < 0
                            ? 'var(--bad)'
                            : 'var(--ink)',
                      }}
                    >
                      {movement.amount_cents > 0 ? '+' : ''}
                      {formatCents(movement.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Divider className="my-0" />

        <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
          <MovementForm unitSlug={unitSlug} kind="reinforcement" />
          <MovementForm unitSlug={unitSlug} kind="withdrawal" />
        </div>
      </Card>

      {/* --- fechar é contar ----------------------------------------- */}
      <Card className="px-5 py-5">
        <h2 className="titulo-seccao mb-1.5">Fecho com contagem</h2>
        <p className="mb-4 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
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
      <dt className="text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
        {label}
      </dt>
      <dd
        className={
          strong
            ? 'tabular mt-0.5 text-xl text-[var(--accent)]'
            : 'tabular mt-0.5 text-base text-[var(--ink)]'
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
    <section className="mt-10">
      <h2 className="titulo-seccao mb-2">Dias fechados</h2>
      <Card className="overflow-x-auto">
        <table className="tabular w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
              <th className="px-5 py-2.5 font-normal">Dia</th>
              <th className="px-3 py-2.5 text-right font-normal">Abertura</th>
              <th className="px-3 py-2.5 text-right font-normal">Esperado</th>
              <th className="px-3 py-2.5 text-right font-normal">Contado</th>
              <th className="px-5 py-2.5 text-right font-normal">Diferença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-soft)]">
            {sessions.map((session) => {
              const difference = session.difference_cents ?? 0
              return (
                <tr key={session.id}>
                  <td className="px-5 py-2.5 text-[var(--ink)]">
                    {formatDayShort(session.business_date, timezone)}
                    {session.closed_by ? (
                      <span className="ml-2 text-[0.6875rem] text-[var(--ink-faint)]">
                        {session.closed_by}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[var(--ink-muted)]">
                    {formatCents(session.opening_cents)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[var(--ink-muted)]">
                    {formatCents(session.expected_cents ?? 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[var(--ink)]">
                    {formatCents(session.counted_cents ?? 0)}
                  </td>
                  <td
                    className="px-5 py-2.5 text-right"
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
