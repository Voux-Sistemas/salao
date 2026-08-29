import Link from 'next/link'
import { formatCents } from '@/lib/money'
import { formatDayLong, formatDuration, formatTime, isoDay } from '@/lib/time'
import {
  nextStatuses,
  type AppointmentItemRow,
  type AppointmentRow,
} from '@/lib/booking'
import { MOTIVO_LABEL, SOURCE_LABEL, STATUS_LABEL } from '@/lib/status'
import { composeMessage, loadTemplates } from '@/lib/notify'
import { Badge, ButtonLink, Notice } from '@/components/ui'
import {
  CancelAction,
  SendWhatsApp,
  StatusAction,
} from '@/components/desk-actions'
import { AGENDA_TONE } from '@/components/agenda-grid'
import { IconClose } from '@/components/desk-icons'
import type { Actor } from '@/lib/auth/actor'
import { can } from '@/lib/auth/actor'
import { formatPhone } from '@/lib/text'

/**
 * O painel lateral: cliente, serviços, valor — e UMA acção que manda.
 *
 * Tinha nove saídas à vista — check-in, iniciar, concluir, dois
 * cancelares, falta, confirmação, comanda, remarcar — três a vermelho e
 * quase todas do mesmo tamanho. Com nove saídas nenhuma é a saída, e a
 * que ficava em grande era a única que ninguém dá.
 *
 * O QUE O RELÓGIO SABE NÃO PRECISA DE BOTÃO. A cadeia é marcada →
 * confirmada → chegou → em atendimento → concluída, e os dois estados
 * do meio descrevem o que o relógio já sabe: às 13:05, uma marcação das
 * 13:00 está a decorrer. Ninguém precisa de o vir dizer ao sistema — e
 * é por isso que ninguém o faz. Saem os dois botões; o selo lá em cima
 * passa a dizer «Em curso» por conta do relógio.
 *
 * Fica o que precisa mesmo de um dedo, porque o relógio não sabe:
 * concluída, faltou, cancelada. Concluir é o botão grande, e num balcão
 * vai até ao fim — dá por concluída E abre a comanda, que era o segundo
 * toque de sempre.
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

  /*
    Os estados que o relógio conta sozinho não se oferecem. Continuam a
    existir na base e no modelo: o que sai daqui é a OFERTA deles, e as
    marcações antigas que lá estão continuam a ler-se.
  */
  const options = nextStatuses(appointment.status).filter(
    (to) => to !== 'checked_in' && to !== 'in_service',
  )

  const podeConcluir = options.includes('completed')
  const motivos = options
    .filter((to) => MOTIVO_LABEL[to])
    .map((to) => ({ to, label: MOTIVO_LABEL[to]! }))

  const total = appointment.total_cents - appointment.discount_cents
  const whenDay = capitalise(
    formatDayLong(isoDay(appointment.starts_at, tz), tz),
  )
  const closeTab =
    can.seeCash(actor) &&
    appointment.status === 'completed' &&
    !appointment.closed_at
  /*
    APAGAR — SÓ A DONA, E SÓ ENQUANTO NÃO HOUVER DINHEIRO.

    Desmarcar é trabalho de balcão e fica na história da cliente; apagar
    é dizer que aquilo nunca devia ter existido. Com um pagamento pelo
    meio deixa de ser uma opção: os pagamentos vão atrás por cascata da
    base, e o movimento de caixa fica sem dono.

    Isto decide o que se DESENHA. Quem manda a sério é a acção do
    servidor, que volta a verificar tudo com a linha travada.
  */
  const dono = actor.role === 'master'
  const temDinheiro =
    appointment.closed_at !== null || appointment.paid_cents > 0
  const podeApagar = dono && !temDinheiro

  /*
    EM CURSO — QUEM O DIZ É O RELÓGIO.

    Não há aqui nenhum estado a ser lido: se a marcação não acabou de
    uma das maneiras que a fecham, e as horas dela contêm este instante,
    ela está a decorrer. A página do balcão é dinâmica, portanto isto
    recalcula-se a cada visita.
  */
  const agora = new Date()
  const acabada =
    appointment.status === 'completed' ||
    appointment.status === 'no_show' ||
    appointment.status === 'cancelled_by_client' ||
    appointment.status === 'cancelled_by_salon'
  const aDecorrer =
    !acabada && agora >= appointment.starts_at && agora < appointment.ends_at
  const faltam = Math.max(
    0,
    Math.round((appointment.ends_at.getTime() - agora.getTime()) / 60000),
  )

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
          {aDecorrer ? (
            <Badge tone="warn">
              Em curso ·{' '}
              {faltam > 0 ? `faltam ${formatDuration(faltam)}` : 'a terminar'}
            </Badge>
          ) : (
            <Badge tone={AGENDA_TONE[appointment.status]}>
              {STATUS_LABEL[appointment.status]}
            </Badge>
          )}
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

      {/*
        TRÊS BOTÕES, E MAIS NADA.

        Chegou a ter nove saídas à vista, depois um menu de cinco linhas
        sempre aberto. Num painel que já tem cabeçalho, data, serviços e
        total, o rodapé não pode ser a maior coisa lá dentro — e de tudo
        o que lá estava, o que se faz num dia normal são três coisas:
        dar por concluída, avisar a cliente, e desmarcar.

        A comanda e a remarcação ficam por baixo, em texto: são portas
        que têm de existir — é daqui que se chega às duas — mas não são
        o trabalho do dia.
      */}
      <footer className="space-y-2.5 border-t border-[var(--line-soft)] px-5 py-4">
        {/*
          O RECIBO DE QUE FICOU FEITO.

          Ao concluir, o botão azul desaparece e um selo lá em cima muda
          de palavra — é pouco para quem carregou e está à espera de
          saber se pegou. Esta linha fica no sítio onde o botão estava, e
          não é uma mensagem que passa: vem do estado da marcação, e por
          isso continua lá amanhã.
        */}
        {appointment.status === 'completed' ? (
          <Notice tone="ok">
            Marcação concluída
            {appointment.closed_at ? ' e cobrada' : ''}.
          </Notice>
        ) : null}

        {/* Já concluída e por cobrar: o que falta é o dinheiro. */}
        {closeTab ? (
          <ButtonLink
            href={`/agenda/${appointment.unit_slug}/comanda/${appointment.id}`}
            className="w-full"
          >
            Fechar comanda
          </ButtonLink>
        ) : null}

        {podeConcluir ? (
          <StatusAction
            appointmentId={appointment.id}
            to="completed"
            label="Concluir"
            variant="primary"
            size="md"
            full
          />
        ) : null}

        <SendWhatsApp
          appointmentId={appointment.id}
          routine="confirm"
          href={message.href}
          message={message.text}
          label="Enviar confirmação"
          variant="ok"
          size="md"
          done={confirmSent}
          className="w-full"
        />

        {/* Há alguma coisa a perguntar, ou há alguma coisa a apagar:
            numa marcação concluída só a segunda é verdade. */}
        {motivos.length > 0 || podeApagar ? (
          <CancelAction
            appointmentId={appointment.id}
            options={motivos}
            itens={appointment.items.length}
            podeApagar={podeApagar}
            avisoDinheiro={dono && temDinheiro}
          />
        ) : null}

        {!podeConcluir && !closeTab && motivos.length === 0 ? (
          <p className="text-[0.75rem] text-[var(--ink-faint)]">
            Esta marcação já não muda de estado.
          </p>
        ) : null}

        {can.seeCash(actor) ? (
          <p className="flex items-center gap-4 pt-1 text-[0.75rem] text-[var(--ink-muted)]">
            {!closeTab ? (
              <Link
                href={`/agenda/${appointment.unit_slug}/comanda/${appointment.id}`}
                className="underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
              >
                Comanda
              </Link>
            ) : null}
            <Link
              href={`/agenda/${appointment.unit_slug}/remarcar/${appointment.id}`}
              className="underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
            >
              Remarcar
            </Link>
          </p>
        ) : null}
      </footer>
    </div>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
