import Link from 'next/link'
import Form from 'next/form'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { ArrowLeft, ChevronDown, X } from 'lucide-react'
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
  daysBetween,
  formatDayLong,
  formatDuration,
  formatMinutes,
  formatTime,
  isoDay,
  isoRange,
  minutesOfDay,
  parseMinutes,
  today,
  type IsoDay,
} from '@/lib/time'
import { Monogram } from '@/components/brand'
import { Card, Empty, Input, Notice, buttonClass } from '@/components/ui'
import { ClientPicker, type PickerClient } from '@/components/client-picker'
import { DayJump } from '@/components/day-jump'
import { DeskDayStrip } from '@/components/desk-day-strip'
import {
  DeskServicePicker,
  type PickerCategory,
} from '@/components/desk-service-picker'
import { EncaixeForm } from '@/components/encaixe-form'
import { ScrollHere } from '@/components/scroll-here'
import { formatPhone } from '@/lib/text'

export const metadata: Metadata = { title: 'Encaixe' }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CLIENT_PARAM = 'cli'
const HAND_PARAM = 'hm'
/** A marcação que acabou de nascer, para o «marcar e continuar». */
const DONE_PARAM = 'ok'

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
type DoneRow = {
  id: string
  starts_at: Date
  client_name: string
  services: string | null
}

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
 * OS PASSOS SEGUEM AS DEPENDÊNCIAS, NÃO O PROTOCOLO. Era «1 Cliente»
 * primeiro, por delicadeza — mas as horas livres precisam dos serviços,
 * e a cliente não é precisa para nada até ao momento de confirmar. Com
 * ela à cabeça, quem vinha da agenda com uma hora na mão tinha de
 * atravessar um passo que ainda não lhe servia. Agora é 1 Serviços,
 * 2 Quando, 3 Cliente e confirmar — cada passo abre o seguinte.
 *
 * Tudo o que se escolhe vive na barra de endereços — o retrocesso do
 * navegador funciona e a ligação pode passar de mão em mão. A hora à
 * mão (`hm`) SOBREVIVE a mudanças no carrinho: é o que faz o toque num
 * buraco da agenda valer alguma coisa — chega-se cá com a hora, e ela
 * espera que se escolham os serviços.
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
  const clientId = first(query[CLIENT_PARAM])
  const hasClient = Boolean(clientId && UUID_RE.test(clientId))
  const doneId = first(query[DONE_PARAM])
  const [client, done, allClients] = await Promise.all([
    hasClient ? getClient(actor.orgId, clientId!) : null,
    // Vai na mesma leva: entre esta página e a base há um oceano, e um
    // recibo não vale uma viagem só para ele.
    doneId && UUID_RE.test(doneId) ? getJustBooked(actor.orgId, doneId) : null,
    // As fichas vêm todas com a página, como o catálogo: a procura
    // passa a correr no navegador, a cada letra, sem ir ao servidor.
    hasClient ? [] : loadClients(actor.orgId),
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
    return `${here}?${value.toString()}`
  }

  /*
    Mudar o carrinho invalida a hora ESCOLHIDA DA GRELHA (`time`): era
    uma hora certa de um plano que já não existe. A hora À MÃO (`hm`)
    fica — é uma intenção («às 14:30»), não um cálculo, e é ela que o
    toque num buraco da agenda traz. Se com o carrinho novo deixar de
    caber, o passo de confirmar di-lo com todas as letras.
  */
  const withCart = (nextCart: CartLine[]) =>
    link({ cart: nextCart, time: null })

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

  // A fita de dias: sete de cada vez, ancorada em hoje.
  const todayDay = today(tz, now)
  const stripAnchor = addDays(
    todayDay,
    Math.max(0, Math.floor(daysBetween(todayDay, day) / 7)) * 7,
  )
  const stripDays = isoRange(stripAnchor, 7)
  const stripPrev =
    stripAnchor > todayDay ? maxDay(addDays(stripAnchor, -7), todayDay) : null

  // O catálogo vai inteiro para o navegador, com os endereços já feitos
  // deste lado: a peneira que lá está só esconde e mostra, nunca decide
  // o que é que se junta à visita.
  const cartFull = cart.length >= MAX_CART_LINES
  const inCart = new Set(cart.map((line) => line.serviceId))
  const catalogue: PickerCategory[] = []
  const byCategory = new Map<string, PickerCategory>()
  for (const row of services) {
    let entry = byCategory.get(row.category_id)
    if (!entry) {
      entry = { id: row.category_id, name: row.category_name, services: [] }
      byCategory.set(row.category_id, entry)
      catalogue.push(entry)
    }
    const chosen = inCart.has(row.id)
    entry.services.push({
      id: row.id,
      name: row.name,
      duration: formatDuration(row.duration_minutes),
      price: formatCents(row.price_cents),
      onlyDesk: !row.bookable_online,
      href: chosen || cartFull ? null : withCart(addLine(cart, row.id)),
      state: chosen ? 'chosen' : cartFull ? 'full' : 'free',
    })
  }

  const pickerClients: PickerClient[] = allClients

  return (
    // O respiro de baixo é para a barra fixa: sem ele, a última linha
    // da página morria escondida atrás do total.
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:py-8">
      <Link
        href={`/agenda/${unit.slug}?d=${day}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)] lg:mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à agenda
      </Link>

      {/* No telemóvel o cabeçalho é uma linha: o nome da página e a
          casa. A explicação fica para o monitor — quem marca vinte
          encaixes por dia já a sabe de cor, e ela custava um dedo de
          ecrã antes do primeiro passo. */}
      <header className="mb-5 lg:mb-8">
        <p className="titulo-seccao mb-1 lg:mb-2">{unit.name} · Balcão</p>
        <h1 className="display text-2xl text-[var(--ink)] lg:text-3xl">
          Encaixe
        </h1>
        <p className="mt-1.5 hidden max-w-xl text-[0.8125rem] text-[var(--ink-muted)] lg:block">
          Do balcão marca-se tudo: serviços fechados ao online, quem não
          aceita marcação online, e sem regras de antecedência.
        </p>
      </header>

      {/* O recibo da anterior. Some-se ao primeiro toque, porque o `ok`
          não viaja em nenhuma das ligações desta página — e é isso que
          se quer: fica à vista enquanto a página está parada, e sai do
          caminho assim que se começa a marcação seguinte. */}
      {done ? (
        <div className="mb-6 lg:mb-8">
          <Notice tone="ok">
            Ficou marcado: {done.client_name}, {formatTime(done.starts_at, tz)}
            {done.services ? ` · ${done.services}` : ''}.{' '}
            <Link
              href={`/agenda/${unit.slug}?d=${isoDay(done.starts_at, tz)}&m=${done.id}`}
              className="underline underline-offset-4"
            >
              ver na agenda
            </Link>
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        {/* --- catálogo -------------------------------------------- */}
        <section id="servicos" className="min-w-0 scroll-mt-20">
          <StepTitle step="1">Serviços</StepTitle>
          {services.length === 0 ? (
            <Empty
              title="Catálogo vazio"
              hint="Ainda não há serviços na rede."
            />
          ) : (
            <DeskServicePicker categories={catalogue} total={services.length} />
          )}
        </section>

        {/* --- a visita, o quando, o fecho -------------------------- */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-20">
          <Card className="px-4 py-4 shadow-[var(--shadow-soft)]">
            <h2 className="mb-3 flex items-baseline gap-2.5">
              <span className="titulo-seccao shrink-0">A visita</span>
              <span
                aria-hidden
                className="h-px flex-1 translate-y-[-0.2em] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--house)_34%,transparent),transparent)]"
              />
            </h2>
            {cart.length === 0 ? (
              /* «À esquerda» só é verdade no ecrã largo: no telemóvel a
                 lista está por cima deste cartão, e a frase mandava a
                 pessoa olhar para uma margem vazia. */
              <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                Escolha os serviços
                <span className="lg:hidden"> na lista acima.</span>
                <span className="hidden lg:inline"> à esquerda.</span>
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
                          scroll={false}
                          aria-label={`Tirar ${service.name}`}
                          className="shrink-0 text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                      {/*
                        NINGUÉM NESTA LOJA O FAZ.

                        Sem isto a linha mostrava só «Sem preferência» e
                        o encaixe não dava hora nenhuma — sem nunca dizer
                        porquê. A recepção ficava a mudar de dia à espera
                        de uma vaga que não podia existir. A habilidade
                        dá-se na ficha da pessoa, em Equipa.
                      */}
                      {eligible.length === 0 ? (
                        <p className="mt-1.5 text-[0.75rem] text-[var(--warn)]">
                          Ninguém nesta loja faz este serviço — não vai
                          haver horas até alguém ganhar a habilidade.
                        </p>
                      ) : (
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
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {cart.length > 0 ? (
              <div className="mt-4 flex items-baseline justify-between border-t border-[var(--line-soft)] pt-3">
                <span className="text-[0.8125rem] text-[var(--ink-muted)]">
                  {formatDuration(totalMinutes)}
                </span>
                <span className="display tabular text-xl text-[var(--ink)]">
                  {formatCents(totalCents)}
                </span>
              </div>
            ) : null}
          </Card>

          {/* --- dia e hora --------------------------------------- */}
          {/*
            O DIA ESCOLHE-SE SEMPRE, MESMO COM A VISITA VAZIA.

            Quem está a passar o livro de papel para o sistema lê a linha
            pela ordem em que ela lá está: «terça, 10h, Maria, corte».
            Obrigar a montar a visita antes de se poder sequer ver o
            calendário era pôr essa ordem ao contrário de quem escreve.
            As horas livres é que precisam de saber o que se vai fazer —
            essas continuam a aparecer só depois dos serviços.
          */}
          <Card id="quando" className="scroll-mt-20 px-4 py-4">
            <StepTitle step="2">Quando</StepTitle>

            <DeskDayStrip
              dense
              days={stripDays}
              active={day}
              today={todayDay}
              timezone={tz}
              hrefFor={(value) => link({ day: value, time: null, hand: null })}
              prevHref={
                stripPrev
                  ? link({ day: stripPrev, time: null, hand: null })
                  : null
              }
              nextHref={link({
                day: addDays(stripAnchor, 7),
                time: null,
                hand: null,
              })}
            />

            {/* A fita anda de semana em semana: uma marcação de daqui a
                mês e meio eram seis setas. O nome do dia é o próprio
                calendário — como o título da agenda — e salta lá
                directo. A hora não vai atrás: pertencia ao dia que se
                deixou. */}
            <DayJump
              day={day}
              hrefTemplate={link({ day: '{d}', time: null, hand: null })}
              className="mb-3 mt-3 block"
            >
              <p className="flex items-center gap-1 text-[0.8125rem] text-[var(--ink-muted)]">
                <span className="truncate">
                  {capitalise(formatDayLong(day, tz))}
                </span>
                <ChevronDown
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
                />
              </p>
            </DayJump>

            {cart.length === 0 ? (
              <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                Escolha os serviços para ver as horas livres deste dia.
              </p>
            ) : (
              <>
                {problem === 'closed' ? (
                  <Notice tone="warn">
                    A loja não abre neste dia. Um encaixe também precisa de
                    porta aberta.
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
                            scroll={false}
                            className={clsx(
                              'tabular flex h-9 items-center justify-center rounded-[var(--radius-sm)] border text-[0.8125rem] font-medium transition-colors',
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
                    Nenhuma hora certa está livre neste dia. Ainda pode
                    escrever uma à mão.
                  </p>
                ) : null}

                {/* A hora à mão: fora da grelha, que é o que faz um
                    encaixe ser um encaixe. */}
                <Form
                  action={here}
                  scroll={false}
                  className="mt-4 border-t border-[var(--line-soft)] pt-3"
                >
                  <p className="titulo-seccao mb-2">Ou uma hora à mão</p>
                  <input type="hidden" name={DAY_PARAM} value={day} />
                  <input
                    type="hidden"
                    name={CART_PARAM}
                    value={cartToParam(cart)}
                  />
                  {clientId ? (
                    <input type="hidden" name={CLIENT_PARAM} value={clientId} />
                  ) : null}
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      name={HAND_PARAM}
                      step={300}
                      defaultValue={
                        chosenAt
                          ? formatMinutes(minutesOfDay(chosenAt, tz))
                          : ''
                      }
                      className="tabular max-w-[8rem]"
                      aria-label="Hora à mão"
                    />
                    <button
                      type="submit"
                      className={buttonClass('outline', 'md', 'shrink-0')}
                    >
                      Usar
                    </button>
                  </div>
                </Form>
                <p className="mt-2 text-[0.6875rem] text-[var(--ink-faint)]">
                  A hora à mão pode cair fora da grelha — é isso que faz um
                  encaixe.
                </p>
              </>
            )}
          </Card>

          {/* --- a cliente e o fecho ------------------------------- */}
          {/*
            UM PASSO SÓ PARA OS DOIS. A cliente não é precisa para
            escolher serviços nem horas — só para fechar. Dantes era o
            passo 1, e quem vinha da agenda com uma hora na mão tinha de
            passar por cima dela para chegar ao que interessava.
          */}
          {cart.length > 0 && chosenAt ? (
            <Card id="confirmar" className="scroll-mt-20 px-4 py-4">
              <ScrollHere chave={chosenAt.toISOString()} />
              <StepTitle step="3">Cliente e confirmar</StepTitle>
              {plan ? (
                <>
                  <ul className="mb-4 space-y-1.5">
                    {plan.items.map((item) => (
                      <li
                        key={`${item.serviceId}-${item.startsAt.toISOString()}`}
                        className="flex items-baseline gap-2 text-[0.8125rem]"
                      >
                        <span className="tabular w-11 shrink-0 text-[var(--accent)]">
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

                  {client ? (
                    <div className="mb-4 flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface)] px-3.5 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--house)_40%,transparent)] bg-[color-mix(in_srgb,var(--house)_12%,var(--surface-raised))] text-sm font-semibold text-[var(--house)]">
                          <Monogram initials={initialsOf(client.name)} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-[var(--ink)]">
                            {client.name}
                          </p>
                          <p className="tabular text-[0.75rem] text-[var(--ink-muted)]">
                            {formatPhone(client.phone)} · {client.visits}{' '}
                            {client.visits === 1 ? 'visita' : 'visitas'}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={link({ client: null })}
                        scroll={false}
                        className="shrink-0 text-[0.75rem] text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                      >
                        trocar
                      </Link>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <ClientPicker
                        clients={pickerClients}
                        hrefTemplate={link({ client: '__ID__' })}
                      />
                    </div>
                  )}

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

      {/*
        A BARRA QUE NUNCA SE PERDE — só no telemóvel, onde os passos se
        empilham e o total fica fora do ecrã. Diz o que a visita já é
        (total, tempo, hora) e leva ao próximo passo em falta. Pousa em
        cima da barra de navegação do balcão (4.5rem), nunca atrás dela.
      */}
      {cart.length > 0 ? (
        <div
          className="fixed inset-x-0 z-30 border-t border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2.5 shadow-[0_-6px_18px_-12px_rgba(46,38,28,0.45)] lg:hidden"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1 leading-tight">
              <p className="tabular text-sm font-semibold text-[var(--ink)]">
                {formatCents(totalCents)}{' '}
                <span className="font-normal text-[var(--ink-muted)]">
                  · {formatDuration(totalMinutes)}
                </span>
              </p>
              <p className="tabular truncate text-[0.6875rem] text-[var(--ink-faint)]">
                {chosenAt
                  ? `${capitalise(formatDayLong(day, tz))} · ${formatTime(chosenAt, tz)}`
                  : 'Falta escolher a hora'}
              </p>
            </div>
            <a
              href={chosenAt ? '#confirmar' : '#quando'}
              className={buttonClass('primary', 'sm', 'shrink-0')}
            >
              {chosenAt ? 'Confirmar' : 'Escolher a hora'}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StepTitle({
  step,
  flush = false,
  children,
}: {
  step: string
  flush?: boolean
  children: React.ReactNode
}) {
  /*
    O PASSO É UM ALGARISMO DA CASA, NÃO UM NÚMERO DE SENHA.

    Era azul, no mesmo tom dos dados e dos botões — e a numeração de um
    formulário não é um dado, é arrumação. Passa para o ouro do
    logótipo, em serifa, ao lado do nome do passo em versaletes e de um
    fio que se desvanece. São as mesmas três peças dos títulos da
    gestão, e é o que dá a esta página uma casa a que pertencer.

    O número aqui É informação: estes três passos são mesmo uma
    sequência — não se escolhe a hora antes de haver serviços, nem se
    confirma antes de haver hora.
  */
  return (
    <h2
      className={clsx('flex items-baseline gap-2.5', flush ? null : 'mb-3.5')}
    >
      <span className="algarismo-casa shrink-0 text-[1.25rem] leading-none text-[var(--house)]">
        {step}
      </span>
      <span className="titulo-seccao shrink-0">{children}</span>
      <span
        aria-hidden
        className="h-px flex-1 translate-y-[-0.2em] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--house)_34%,transparent),transparent)]"
      />
    </h2>
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
      scroll={false}
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] transition-colors',
        active
          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]'
          : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {label}
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

/**
 * As fichas para a peneira do navegador, das mais recentes para as mais
 * paradas. O tecto de quinhentas é rede, não porta: uma casa deste
 * tamanho não lá chega, e se um dia chegar, a procura continua a
 * encontrar tudo o que veio — só as fichas mais antigas e paradas é que
 * teriam de nascer pelo formulário.
 */
async function loadClients(orgId: string): Promise<ClientRow[]> {
  return sql<ClientRow[]>`
    select c.id, c.name, c.phone,
           (select count(*) from appointment a
             where a.client_id = c.id and a.status = 'completed')::int as visits
      from client c
     where c.org_id = ${orgId} and c.is_active
     order by coalesce((select max(a.starts_at) from appointment a
                         where a.client_id = c.id), c.created_at) desc,
              c.name
     limit 500
  `
}

/** O recibo do «marcar e continuar»: o que acabou de ficar registado. */
async function getJustBooked(
  orgId: string,
  id: string,
): Promise<DoneRow | null> {
  const rows = await sql<DoneRow[]>`
    select a.id, a.starts_at, c.name as client_name,
           (select string_agg(i.service_name, ' + '
                              order by i.sort_order, i.starts_at)
              from appointment_item i
             where i.appointment_id = a.id) as services
      from appointment a
      join client c on c.id = a.client_id
     where a.id = ${id} and a.org_id = ${orgId}
  `
  return rows[0] ?? null
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  const head = parts[0]?.[0] ?? ''
  const tail = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (head + tail).toUpperCase() || 'NR'
}

const maxDay = (a: IsoDay, b: IsoDay): IsoDay => (a > b ? a : b)

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
