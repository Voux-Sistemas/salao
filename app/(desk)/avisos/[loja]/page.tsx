import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { requireManagement, resolveUnit, unitsFor } from '@/lib/auth/actor'
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
 */
export default async function AvisosPage({
  params,
  searchParams,
}: {
  params: Promise<{ loja: string }>
  searchParams: Promise<{ r?: string }>
}) {
  const actor = await requireManagement()
  const { loja } = await params
  const { r } = await searchParams

  const unit = await resolveUnit(actor, loja)
  const routine: Routine =
    r && (ROUTINES as string[]).includes(r) ? (r as Routine) : 'confirm'

  const [queues, units, templates] = await Promise.all([
    loadQueues(unit),
    unitsFor(actor),
    loadTemplates(actor.orgId),
  ])

  const rows = queues[routine]
  const here = `/avisos/${unit.slug}`

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">{unit.name}</p>
          <h1 className="display text-3xl text-[var(--ink)]">Avisos</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Os códigos de acesso não são de loja nenhuma: a ficha da
              cliente é uma só na rede. Por isso ficam aqui, ao lado do
              selector, e não entre as abas — lá, um sexto botão que não
              filtrava nada só enganava. */}
          <Link
            href="/avisos/codigos"
            className="link-slide text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
          >
            Códigos de acesso
          </Link>
          <UnitSwitcher
            units={units}
            current={unit.slug}
            base="/avisos"
            showAll={false}
          />
        </div>
      </header>

      {/* --- a regra sagrada da casa --------------------------------- */}
      <div className="mb-6 flex items-start gap-3 rounded-[2px] border border-[var(--line-soft)] bg-[var(--surface-raised)] px-4 py-3">
        <Sprig size={30} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        <p className="text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          <span className="font-medium text-[var(--ink)]">
            O sistema nunca envia nada sozinho.
          </span>{' '}
          Prepara a mensagem e abre a conversa — quem carrega no botão é uma
          pessoa, e é o registo do envio que tira a linha da fila.
        </p>
      </div>

      {/* --- as abas ------------------------------------------------ */}
      <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Rotinas">
        {ROUTINES.map((value) => {
          const count = queues[value].length
          const active = value === routine
          return (
            <Link
              key={value}
              href={value === 'confirm' ? here : `${here}?r=${value}`}
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
            hint="Ninguém se enquadra nesta rotina neste momento. Nada a fazer."
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
}: {
  row: NoticeRow
  routine: Routine
  unitName: string
  unitSlug: string
  timezone: string
  templates: Awaited<ReturnType<typeof loadTemplates>>
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
          <Link
            href={`/clientes/${row.client_id}`}
            className="truncate text-sm text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
          >
            {row.client_name}
          </Link>
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
          {row.staff_names ? ` · ${row.staff_names}` : ''}
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
