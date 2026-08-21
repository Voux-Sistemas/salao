import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { requireManagement, resolveUnit } from '@/lib/auth/actor'
import {
  buildPlan,
  loadDayContext,
  slotsFrom,
  type CartLine,
  type Plan,
} from '@/lib/availability'
import {
  CART_PARAM,
  DAY_PARAM,
  TIME_PARAM,
  addLine,
  cartToParam,
  first,
  parseCart,
  removeAt,
  setStaffAt,
  MAX_CART_LINES,
} from '@/lib/cart'
import { sql } from '@/lib/db'
import { formatCents } from '@/lib/money'
import {
  addDays,
  atMinutes,
  formatDayLong,
  formatDuration,
  formatMinutes,
  formatTime,
  minutesOfDay,
  parseMinutes,
  today,
  type IsoDay,
} from '@/lib/time'
import { Badge, Card, Empty, Input, Notice } from '@/components/ui'
import { EncaixeForm } from '@/components/encaixe-form'

export const metadata: Metadata = { title: 'Encaixe' }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CLIENT_PARAM = 'cli'
const SEARCH_PARAM = 'q'
const HAND_PARAM = 'hm'

type ServiceRow = {
  category_id: string
  category_name: string
  id: string
  name: string
  duration_minutes: number
  price_cents: number
  bookable_online: boolean
}

type SkillRow = { service_id: string; staff_id: string; staff_name: string }
type PriceRow = { ord: number; price_cents: number; duration_minutes: number }
type ClientRow = { id: string; name: string; phone: string; visits: number }

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * O ENCAIXE — marcar do balcão.
 *
 * Aqui não há filtro de online: entra o catálogo todo e a equipa toda, e
 * as regras de antecedência não se aplicam. A hora pode até ser escrita
 * à mão, fora da grelha. O que continua a mandar é a base de dados:
 * ninguém fica com duas clientes à mesma hora.
 *
 * Tudo o que se escolhe vive na barra de endereços — o retrocesso do
 * navegador funciona e a ligação pode passar de mão em mão.
 */
export default async function EncaixePage({ params, searchParams }: Params) {
  const actor = await requireManagement()
  const { loja } = await params
  const query = await searchParams

  const unit = await resolveUnit(actor, loja)
  const tz = unit.timezone
  const now = new Date()

  const askedDay = first(query[DAY_PARAM])
  const day: IsoDay =
    askedDay && DAY_RE.test(askedDay) ? askedDay : today(tz, now)

  const [services, skills] = await Promise.all([
    sql<ServiceRow[]>`
      select c.id as category_id, c.name as category_name,
             s.id, s.name, s.bookable_online,
             e.duration_minutes, e.price_cents
        from service s
        join service_category c on c.id = s.category_id and c.is_active
        cross join lateral effective_service_pricing(s.id, ${unit.id}::uuid, null::uuid) e
       where s.org_id = ${actor.orgId} and s.is_active
       order by c.sort_order, c.name, s.sort_order, s.name
    `,
    // Sem filtro de marcação online: ao balcão marca-se com quem faz.
    sql<SkillRow[]>`
      select ss.service_id, s.id as staff_id, s.name as staff_name
        from staff_skill ss
        join staff s on s.id = ss.staff_id
        join staff_unit su on su.staff_id = s.id and su.unit_id = ${unit.id}
       where s.org_id = ${actor.orgId} and s.is_active
       order by s.sort_order, s.name
    `,
  ])

  const byId = new Map(services.map((s) => [s.id, s]))
  const staffByService = new Map<string, SkillRow[]>()
  for (const row of skills) {
    const list = staffByService.get(row.service_id) ?? []
    list.push(row)
    staffByService.set(row.service_id, list)
  }

  const cart: CartLine[] = parseCart(query[CART_PARAM])
    .filter((line) => byId.has(line.serviceId))
    .map((line) => {
      if (!line.staffId) return line
      const eligible = staffByService.get(line.serviceId) ?? []
      return eligible.some((s) => s.staff_id === line.staffId)
        ? line
        : { ...line, staffId: null }
    })

  // --- a cliente ----------------------------------------------------
  const search = first(query[SEARCH_PARAM])?.trim() ?? ''
  const clientId = first(query[CLIENT_PARAM])
  const [client, matches] = await Promise.all([
    clientId && UUID_RE.test(clientId) ? getClient(actor.orgId, clientId) : null,
    search.length >= 2 ? searchClients(actor.orgId, search) : [],
  ])

  // --- horas --------------------------------------------------------
  const context =
    cart.length > 0
      ? await loadDayContext(unit, day, cart, 'counter', now)
      : null
  const ctx = typeof context === 'string' ? null : context
  const problem = typeof context === 'string' ? context : null

  const slots = ctx ? slotsFrom(ctx) : []

  const hand = first(query[HAND_PARAM])
  const handMinutes = hand ? parseMinutes(hand) : null
  const askedTime = first(query[TIME_PARAM])
  const chosenAt: Date | null =
    handMinutes !== null
      ? atMinutes(day, handMinutes, tz)
      : askedTime && !Number.isNaN(Date.parse(askedTime))
        ? new Date(askedTime)
        : null

  const plan: Plan | null =
    ctx && chosenAt ? buildPlan(ctx, chosenAt.getTime()) : null

  // --- endereços ----------------------------------------------------
  const here = `/agenda/${unit.slug}/encaixe`
  const link = (next: {
    cart?: CartLine[]
    day?: IsoDay
    time?: string | null
    hand?: string | null
    client?: string | null
    search?: string | null
  }): string => {
    const value = new URLSearchParams()
    const nextCart = next.cart ?? cart
    if (nextCart.length > 0) value.set(CART_PARAM, cartToParam(nextCart))
    value.set(DAY_PARAM, next.day ?? day)
    const time = next.time === undefined ? askedTime : next.time
    if (time) value.set(TIME_PARAM, time)
    const handValue = next.hand === undefined ? hand : next.hand
    if (handValue) value.set(HAND_PARAM, handValue)
    const who = next.client === undefined ? clientId : next.client
    if (who) value.set(CLIENT_PARAM, who)
    const q = next.search === undefined ? search : next.search
    if (q) value.set(SEARCH_PARAM, q)
    return `${here}?${value.toString()}`
  }

  // Mudar o carrinho invalida a hora escolhida: o plano é outro.
  const withCart = (nextCart: CartLine[]) =>
    link({ cart: nextCart, time: null, hand: null })

  const prices =
    cart.length === 0
      ? []
      : await sql<PriceRow[]>`
          select p.ord::int as ord, e.price_cents, e.duration_minutes
            from unnest(
                   ${cart.map((l) => l.serviceId)}::uuid[],
                   ${cart.map((l) => l.staffId)}::uuid[]
                 ) with ordinality as p(service_id, staff_id, ord)
           cross join lateral effective_service_pricing(
                   p.service_id, ${unit.id}::uuid, p.staff_id) e
           order by p.ord
        `
  const priceAt = new Map(prices.map((p) => [p.ord, p]))
  const totalCents = prices.reduce((sum, p) => sum + p.price_cents, 0)
  const totalMinutes =
    prices.reduce((sum, p) => sum + p.duration_minutes, 0) +
    Math.max(0, cart.length - 1) * unit.gap_between_services_minutes

  const categories = new Map<string, { name: string; services: ServiceRow[] }>()
  for (const row of services) {
    const entry = categories.get(row.category_id) ?? {
      name: row.category_name,
      services: [],
    }
    entry.services.push(row)
    categories.set(row.category_id, entry)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href={`/agenda/${unit.slug}?d=${day}`}
        className="mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à agenda
      </Link>

      <header className="mb-8">
        <p className="eyebrow mb-1">{unit.name}</p>
        <h1 className="display text-2xl text-[var(--ink)]">Encaixe</h1>
        <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
          Do balcão marca-se tudo: serviços fechados ao online, quem não
          aceita marcação online, e sem regras de antecedência.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-10">
          {/* --- cliente ------------------------------------------- */}
          <section>
            <h2 className="eyebrow mb-3">Cliente</h2>
            {client ? (
              <Card className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--ink)]">
                    {client.name}
                  </p>
                  <p className="tabular text-[0.75rem] text-[var(--ink-muted)]">
                    {client.phone} · {client.visits} visitas
                  </p>
                </div>
                <Link
                  href={link({ client: null, search: null })}
                  className="shrink-0 text-[0.75rem] text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                >
                  trocar
                </Link>
              </Card>
            ) : (
              <div className="space-y-3">
                <form method="get" action={here} className="flex gap-2">
                  <input type="hidden" name={DAY_PARAM} value={day} />
                  {cart.length > 0 ? (
                    <input
                      type="hidden"
                      name={CART_PARAM}
                      value={cartToParam(cart)}
                    />
                  ) : null}
                  {askedTime ? (
                    <input type="hidden" name={TIME_PARAM} value={askedTime} />
                  ) : null}
                  <Input
                    name={SEARCH_PARAM}
                    defaultValue={search}
                    placeholder="Nome ou telefone"
                    autoComplete="off"
                    className="max-w-xs"
                  />
                  <button
                    type="submit"
                    className="h-10 shrink-0 border border-[var(--line)] px-4 text-[0.8125rem] text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    Procurar
                  </button>
                </form>

                {search.length >= 2 ? (
                  matches.length === 0 ? (
                    <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                      Nenhuma ficha com isso. Escreva o nome e o telefone em
                      baixo — a ficha nasce ao marcar.
                    </p>
                  ) : (
                    <Card className="divide-y divide-[var(--line-soft)]">
                      {matches.map((row) => (
                        <Link
                          key={row.id}
                          href={link({ client: row.id, search: null })}
                          className="flex items-baseline justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-[var(--ink)]">
                              {row.name}
                            </span>
                            <span className="tabular block text-[0.75rem] text-[var(--ink-muted)]">
                              {row.phone}
                            </span>
                          </span>
                          <span className="shrink-0 text-[0.75rem] text-[var(--ink-faint)]">
                            {row.visits} visitas
                          </span>
                        </Link>
                      ))}
                    </Card>
                  )
                ) : null}
              </div>
            )}
          </section>

          {/* --- catálogo ------------------------------------------ */}
          <section>
            <h2 className="eyebrow mb-3">Serviços</h2>
            {services.length === 0 ? (
              <Empty
                title="Catálogo vazio"
                hint="Ainda não há serviços na rede."
              />
            ) : (
              <div className="space-y-8">
                {[...categories.values()].map((category) => (
                  <div key={category.name}>
                    <h3 className="display text-base text-[var(--accent)]">
                      {category.name}
                    </h3>
                    <ul className="mt-2 border-t border-[var(--line-soft)]">
                      {category.services.map((service) => {
                        const chosen = cart.some(
                          (l) => l.serviceId === service.id,
                        )
                        const full = cart.length >= MAX_CART_LINES
                        return (
                          <li
                            key={service.id}
                            className="flex items-center gap-4 border-b border-[var(--line-soft)] py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-[var(--ink)]">
                                {service.name}
                                {service.bookable_online ? null : (
                                  <span className="ml-2 align-middle">
                                    <Badge>Só ao balcão</Badge>
                                  </span>
                                )}
                              </p>
                              <p className="tabular text-[0.75rem] text-[var(--ink-faint)]">
                                {formatDuration(service.duration_minutes)} ·{' '}
                                {formatCents(service.price_cents)}
                              </p>
                            </div>
                            {chosen || full ? (
                              <span
                                className={clsx(
                                  'shrink-0 text-[0.75rem]',
                                  chosen
                                    ? 'text-[var(--accent)]'
                                    : 'text-[var(--ink-faint)]',
                                )}
                              >
                                {chosen ? 'na visita' : 'cheio'}
                              </span>
                            ) : (
                              <Link
                                href={withCart(addLine(cart, service.id))}
                                aria-label={`Juntar ${service.name}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center border border-[var(--line)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* --- a visita ------------------------------------------- */}
        <aside className="space-y-6 lg:sticky lg:top-20">
          <Card className="px-4 py-4">
            <h2 className="eyebrow mb-3">A visita</h2>
            {cart.length === 0 ? (
              <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                Escolha os serviços à esquerda.
              </p>
            ) : (
              <ul className="space-y-3">
                {cart.map((line, index) => {
                  const service = byId.get(line.serviceId)
                  const price = priceAt.get(index + 1)
                  const eligible = staffByService.get(line.serviceId) ?? []
                  if (!service) return null
                  return (
                    <li
                      key={`${line.serviceId}-${index}`}
                      className="border-b border-[var(--line-soft)] pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                          {service.name}
                        </span>
                        <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink)]">
                          {formatCents(price?.price_cents ?? service.price_cents)}
                        </span>
                        <Link
                          href={withCart(removeAt(cart, index))}
                          aria-label={`Tirar ${service.name}`}
                          className="shrink-0 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <StaffChip
                          href={withCart(setStaffAt(cart, index, null))}
                          label="Sem preferência"
                          active={line.staffId === null}
                        />
                        {eligible.map((option) => (
                          <StaffChip
                            key={option.staff_id}
                            href={withCart(
                              setStaffAt(cart, index, option.staff_id),
                            )}
                            label={option.staff_name}
                            active={line.staffId === option.staff_id}
                          />
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {cart.length > 0 ? (
              <p className="tabular mt-4 border-t border-[var(--line-soft)] pt-3 text-[0.8125rem] text-[var(--ink-muted)]">
                {formatDuration(totalMinutes)} · {formatCents(totalCents)}
              </p>
            ) : null}
          </Card>

          {/* --- dia e hora --------------------------------------- */}
          {cart.length > 0 ? (
            <Card className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="eyebrow">Quando</h2>
                <div className="flex items-center gap-1">
                  <DayArrow
                    href={link({
                      day: addDays(day, -1),
                      time: null,
                      hand: null,
                    })}
                    label="Dia anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </DayArrow>
                  <DayArrow
                    href={link({ day: addDays(day, 1), time: null, hand: null })}
                    label="Dia seguinte"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </DayArrow>
                </div>
              </div>

              <p className="mb-3 text-[0.8125rem] text-[var(--ink-muted)]">
                {capitalise(formatDayLong(day, tz))}
              </p>

              {problem === 'closed' ? (
                <Notice tone="warn">
                  A loja não abre neste dia. Um encaixe também precisa de porta
                  aberta.
                </Notice>
              ) : null}

              {slots.length > 0 ? (
                <ul className="grid grid-cols-4 gap-1.5">
                  {slots.map((slot) => {
                    const iso = slot.startsAt.toISOString()
                    const active =
                      chosenAt !== null &&
                      chosenAt.getTime() === slot.startsAt.getTime()
                    return (
                      <li key={iso}>
                        <Link
                          href={link({ time: iso, hand: null })}
                          className={clsx(
                            'tabular flex h-9 items-center justify-center border text-[0.8125rem] transition-colors',
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                              : 'border-[var(--line-soft)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                          )}
                        >
                          {formatMinutes(slot.minutesOfDay)}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : problem === null ? (
                <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                  Nenhuma hora certa está livre neste dia. Ainda pode escrever
                  uma à mão.
                </p>
              ) : null}

              {/* A hora à mão: fora da grelha, que é o que faz um encaixe
                  ser um encaixe. */}
              <form method="get" action={here} className="mt-4 flex gap-2">
                <input type="hidden" name={DAY_PARAM} value={day} />
                <input
                  type="hidden"
                  name={CART_PARAM}
                  value={cartToParam(cart)}
                />
                {clientId ? (
                  <input type="hidden" name={CLIENT_PARAM} value={clientId} />
                ) : null}
                <Input
                  type="time"
                  name={HAND_PARAM}
                  step={300}
                  defaultValue={
                    chosenAt ? formatMinutes(minutesOfDay(chosenAt, tz)) : ''
                  }
                  className="tabular max-w-[8rem]"
                  aria-label="Hora à mão"
                />
                <button
                  type="submit"
                  className="h-10 shrink-0 border border-[var(--line)] px-3 text-[0.8125rem] text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Usar
                </button>
              </form>
            </Card>
          ) : null}

          {/* --- fechar ------------------------------------------- */}
          {cart.length > 0 && chosenAt ? (
            <Card className="px-4 py-4">
              <h2 className="eyebrow mb-3">Confirmar</h2>
              {plan ? (
                <>
                  <ul className="mb-4 space-y-1.5">
                    {plan.items.map((item) => (
                      <li
                        key={`${item.serviceId}-${item.startsAt.toISOString()}`}
                        className="flex items-baseline gap-2 text-[0.8125rem]"
                      >
                        <span className="tabular w-11 shrink-0 text-[var(--ink-muted)]">
                          {formatTime(item.startsAt, tz)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[var(--ink)]">
                          {item.serviceName}
                        </span>
                        <span className="shrink-0 truncate text-[var(--ink-muted)]">
                          {item.staffName}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <EncaixeForm
                    unitSlug={unit.slug}
                    cartParam={cartToParam(cart)}
                    timeIso={plan.startsAt.toISOString()}
                    client={
                      client
                        ? {
                            id: client.id,
                            name: client.name,
                            phone: client.phone,
                          }
                        : null
                    }
                  />
                </>
              ) : (
                <Notice tone="warn">
                  Nessa hora não dá: alguém ou algum recurso não está livre, ou
                  a loja está fechada. Escolha outra.
                </Notice>
              )}
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function StaffChip({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'border px-2 py-0.5 text-[0.6875rem] transition-colors',
        active
          ? 'border-[var(--accent)] text-[var(--accent)]'
          : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {label}
    </Link>
  )
}

function DayArrow({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center border border-[var(--line)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {children}
    </Link>
  )
}

async function getClient(
  orgId: string,
  id: string,
): Promise<ClientRow | null> {
  const rows = await sql<ClientRow[]>`
    select c.id, c.name, c.phone,
           (select count(*) from appointment a
             where a.client_id = c.id and a.status = 'completed')::int as visits
      from client c
     where c.id = ${id} and c.org_id = ${orgId}
  `
  return rows[0] ?? null
}

async function searchClients(
  orgId: string,
  term: string,
): Promise<ClientRow[]> {
  const digits = term.replace(/\D/g, '')
  return sql<ClientRow[]>`
    select c.id, c.name, c.phone,
           (select count(*) from appointment a
             where a.client_id = c.id and a.status = 'completed')::int as visits
      from client c
     where c.org_id = ${orgId}
       and (
         c.name ilike ${'%' + term + '%'}
         or (${digits} <> '' and regexp_replace(c.phone, '\\D', '', 'g') like ${'%' + digits + '%'})
       )
     order by c.name
     limit 8
  `
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
