import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import {
  can,
  noticesStaffId,
  requireActor,
  resolveUnit,
  unitsFor,
} from '@/lib/auth/actor'
import { loadQueues, type NoticeRow } from '@/lib/notices'
import { composeMessage, loadTemplates } from '@/lib/notify'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/status'
import { formatDayShort, formatTime, isoDay } from '@/lib/time'
import { ROUTINES, ROUTINE_HINT, ROUTINE_LABEL, type Routine } from '@/lib/whatsapp'
import { Sprig } from '@/components/brand'
import { SendWhatsApp } from '@/components/desk-actions'
import { UnitSwitcher } from '@/components/unit-switcher'
import { Badge, Card, Empty } from '@/components/ui'
import { formatPhone } from '@/lib/text'

export const metadata: Metadata = { title: 'Avisos' }

/**
 * A FILA. Uma aba por rotina, e em cada linha um botão que abre a
 * conversa com a mensagem escrita.
 *
 * Carregar no botão faz duas coisas de uma vez: abre o WhatsApp e grava
 * o envio — e é o registo que tira a linha da fila. O que não faz é
 * mudar o estado da marcação: mandar a confirmação não é a cliente
 * confirmar.
 *
 * A FILA TEM DONO. A profissional avisa as clientes que marcaram com
 * ela e não vê as das colegas — quem conhece a conversa é quem lhe vai
 * pegar no cabelo. Por cima dela a fila é da casa toda, e a tira de
 * nomes serve para ver o trabalho de cada uma sem trocar de conta.
 */
export default async function AvisosPage({
  params,
  searchParams,
}: {
  params: Promise<{ loja: string }>
  searchParams: Promise<{ r?: string; p?: string }>
}) {
  const actor = await requireActor()
  const { loja } = await params
  const { r, p } = await searchParams

  const unit = await resolveUnit(actor, loja)
  const routine: Routine =
    r && (ROUTINES as string[]).includes(r) ? (r as Routine) : 'confirm'

  const mine = noticesStaffId(actor)
  const [queues, units, templates] = await Promise.all([
    loadQueues(unit, { staffId: mine }),
    unitsFor(actor),
    loadTemplates(actor.orgId),
  ])

  /*
   * Quem aparece na tira de nomes vem das cinco filas juntas, não só da
   * que está aberta: uma lista que muda de tamanho ao mudar de aba não
   * se consegue usar. Os números, esses, são da aba que está à frente.
   */
  const everyone = new Map<string, string>()
  for (const list of Object.values(queues)) {
    for (const row of list) {
      for (const person of row.staff) everyone.set(person.id, person.name)
    }
  }
  const chosen = p && everyone.has(p) ? p : null
  const people = [...everyone]
    .map(([id, name]) => ({
      id,
      name,
      count: queues[routine].filter((row) =>
        row.staff.some((s) => s.id === id),
      ).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))

  const only = (list: NoticeRow[]) =>
    chosen ? list.filter((row) => row.staff.some((s) => s.id === chosen)) : list

  const rows = only(queues[routine])
  const showPeople = !mine && people.length > 1
  const here = `/avisos/${unit.slug}`
  const linkTo = (value: Routine, person: string | null) => {
    const query = new URLSearchParams()
    if (value !== 'confirm') query.set('r', value)
    if (person) query.set('p', person)
    const tail = query.toString()
    return tail ? `${here}?${tail}` : here
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">{unit.name}</p>
          <h1 className="display text-3xl text-[var(--ink)]">
            {mine ? 'Os meus avisos' : 'Avisos'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Os códigos de acesso não são de loja nenhuma: a ficha da
              cliente é uma só na rede. Por isso ficam aqui, ao lado do
              selector, e não entre as abas — lá, um sexto botão que não
              filtrava nada só enganava. */}
          {can.seeClients(actor) ? (
            <Link
              href="/avisos/codigos"
              className="link-slide text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
            >
              Códigos de acesso
            </Link>
          ) : null}
          {units.length > 1 ? (
            <UnitSwitcher
              units={units}
              current={unit.slug}
              base="/avisos"
              showAll={false}
            />
          ) : null}
        </div>
      </header>

      {/* --- a regra sagrada da casa --------------------------------- */}
      <div className="mb-6 flex items-start gap-3 rounded-[2px] border border-[var(--line-soft)] bg-[var(--surface-raised)] px-4 py-3">
        <Sprig size={30} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        <p className="text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          <span className="font-medium text-[var(--ink)]">
            O sistema nunca envia nada sozinho.
          </span>{' '}
          {mine
            ? 'Prepara a mensagem e abre a conversa — quem carrega no botão é você. Estas são as clientes que marcaram consigo.'
            : 'Prepara a mensagem e abre a conversa — quem carrega no botão é uma pessoa, e é o registo do envio que tira a linha da fila.'}
        </p>
      </div>

      {/* --- as abas ------------------------------------------------ */}
      <nav
        className={clsx('flex flex-wrap gap-1.5', showPeople ? 'mb-3' : 'mb-6')}
        aria-label="Rotinas"
      >
        {ROUTINES.map((value) => {
          const count = only(queues[value]).length
          const active = value === routine
          return (
            <Link
              key={value}
              href={linkTo(value, chosen)}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-2 rounded-[2px] border px-3 py-1.5 text-[0.8125rem] transition-colors',
                active
                  ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]'
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
      </nav>

      {/* --- de quem é cada fila ------------------------------------ */}
      {showPeople ? (
        <nav
          className="mb-6 flex flex-wrap items-center gap-x-1 gap-y-1.5"
          aria-label="Por profissional"
        >
          <span className="mr-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-[var(--ink-faint)]">
            Quem avisa
          </span>
          <Link
            href={linkTo(routine, null)}
            aria-current={chosen ? undefined : 'page'}
            className={clsx(
              'rounded-full px-2.5 py-1 text-[0.75rem] transition-colors',
              chosen
                ? 'text-[var(--ink-muted)] hover:text-[var(--accent)]'
                : 'bg-[var(--surface-sunken)] text-[var(--ink)]',
            )}
          >
            Todas
          </Link>
          {people.map((person) => {
            const active = person.id === chosen
            return (
              <Link
                key={person.id}
                href={linkTo(routine, person.id)}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] transition-colors',
                  active
                    ? 'bg-[var(--surface-sunken)] text-[var(--ink)]'
                    : 'text-[var(--ink-muted)] hover:text-[var(--accent)]',
                )}
              >
                {person.name}
                <span
                  className={clsx(
                    'tabular text-[0.6875rem]',
                    person.count > 0
                      ? 'text-[var(--ink)]'
                      : 'text-[var(--ink-faint)]',
                  )}
                >
                  {person.count}
                </span>
              </Link>
            )
          })}
        </nav>
      ) : null}

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow">{ROUTINE_LABEL[routine]}</h2>
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">
          {ROUTINE_HINT[routine]}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <Empty
            title="Fila vazia"
            hint={
              chosen
                ? 'Esta profissional não tem ninguém à espera nesta rotina.'
                : 'Ninguém se enquadra nesta rotina neste momento. Nada a fazer.'
            }
          />
        </Card>
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
              linkClient={can.seeClients(actor)}
              hideStaffId={mine}
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
  linkClient,
  hideStaffId,
}: {
  row: NoticeRow
  routine: Routine
  unitName: string
  unitSlug: string
  timezone: string
  templates: Awaited<ReturnType<typeof loadTemplates>>
  linkClient: boolean
  /** Na fila dela própria o nome dela não informa nada — sai. */
  hideStaffId: string | null
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
  /* Na fila da profissional o nome dela repete-se em todas as linhas e
     só rouba espaço ao serviço. Fica só quem mais lá está — uma colega
     no mesmo atendimento é coisa que ela precisa de ver. */
  const staff = row.staff
    .filter((person) => person.id !== hideStaffId)
    .map((person) => person.name)
    .sort((a, b) => a.localeCompare(b, 'pt'))
    .join(', ')

  return (
    /* No telemóvel o botão do WhatsApp comia metade da linha e o resto
       ficava espremido a três palmos: o nome truncado, o telefone
       partido ao meio e os serviços cortados. Aqui ele desce para uma
       linha só sua, a toda a largura — que é como se carrega num botão
       com o polegar. A partir de `sm` volta ao fim da linha. */
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      {/* --- a hora, à cabeça da linha ------------------------------- */}
      <Link
        href={`/agenda/${unitSlug}?d=${day}&m=${row.appointment_id}`}
        className="w-14 shrink-0 text-center transition-colors hover:text-[var(--accent)]"
      >
        <span className="tabular block text-base leading-tight text-[var(--ink)]">
          {formatTime(row.starts_at, timezone)}
        </span>
        <span className="tabular block text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--ink-faint)]">
          {formatDayShort(day, timezone)}
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {linkClient ? (
            <Link
              href={`/clientes/${row.client_id}`}
              className="truncate text-sm text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
            >
              {row.client_name}
            </Link>
          ) : (
            <span className="truncate text-sm text-[var(--ink)]">
              {row.client_name}
            </span>
          )}
          <span className="tabular text-[0.75rem] text-[var(--ink-muted)]">
            {formatPhone(row.client_phone)}
          </span>
          {routine === 'winback' ? (
            <Badge tone={STATUS_TONE[row.status]}>
              {STATUS_LABEL[row.status]}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
          {services || 'Sem serviços'}
          {staff ? ` · ${staff}` : ''}
        </p>
      </div>

      <SendWhatsApp
        appointmentId={row.appointment_id}
        routine={routine}
        href={message.href}
        message={message.text}
        label="Abrir WhatsApp"
        className="w-full sm:w-auto"
      />
    </div>
  )
}
