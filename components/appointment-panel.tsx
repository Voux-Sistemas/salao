import Link from 'next/link'
import { formatCents } from '@/lib/money'
import { formatDayLong, formatDuration, formatTime, isoDay } from '@/lib/time'
import {
  nextStatuses,
  type AppointmentItemRow,
  type AppointmentRow,
} from '@/lib/booking'
import { SOURCE_LABEL, STATUS_LABEL } from '@/lib/status'
import { composeMessage, loadTemplates } from '@/lib/notify'
import { Badge, Notice } from '@/components/ui'
import {
  CancelAction,
  SendWhatsApp,
  StatusAction,
} from '@/components/desk-actions'
import { AGENDA_TONE } from '@/components/agenda-grid'
import { IconClose } from '@/components/desk-icons'
import type { Actor } from '@/lib/auth/actor'
import { can } from '@/lib/auth/actor'
import { foiFeita } from '@/lib/booking'
import { formatPhone } from '@/lib/text'

/**
 * O painel lateral: cliente, serviços, valor — e UMA acção que manda.
 *
 * Tinha nove saídas à vista — check-in, iniciar, concluir, dois
 * cancelares, falta, confirmação, comanda, remarcar — três a vermelho e
 * quase todas do mesmo tamanho. Com nove saídas nenhuma é a saída, e a
 * que ficava em grande era a única que ninguém dá.
 *
 * A comanda foi a última a cair, e não por desenho: ninguém a abria.
 *
 * O QUE O RELÓGIO SABE NÃO PRECISA DE BOTÃO. A cadeia é marcada →
 * confirmada → chegou → em atendimento → concluída, e os dois estados
 * do meio descrevem o que o relógio já sabe: às 13:05, uma marcação das
 * 13:00 está a decorrer. Ninguém precisa de o vir dizer ao sistema — e
 * é por isso que ninguém o faz. Saem os dois botões; o selo lá em cima
 * passa a dizer «Em curso» por conta do relógio.
 *
 * E O «CONCLUIR» SEGUIU O MESMO CAMINHO. Era o último que restava da
 * família dos gestos que ninguém dá — a caixa, a comanda, e ele — e
 * sobreviveu por ser o mais barato dos três. Continuava a ser trinta
 * toques por semana, e enquanto ninguém os desse o dinheiro do painel
 * não existia. Agora a hora manda: passada a hora, a marcação conta.
 *
 * O QUE FICA É A EXCEPÇÃO. Numa marcação que já passou há uma coisa só
 * que alguém pode precisar de vir dizer, porque o relógio não a sabe: a
 * cliente não veio. Essa leva a cor cheia; o cancelar fica ao lado, em
 * papel, porque cancelar o que já aconteceu é raro.
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
      clientPhone: appointment.client_phone ?? '',
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

  /*
    JÁ ACONTECEU? É a mesma pergunta que as contas fazem, feita com o
    mesmo gémeo — `foiFeita` é a versão em JavaScript do `marcacaoFeita`
    que soma o dinheiro. Duas leituras da mesma regra divergem sempre;
    estas vivem coladas uma à outra.
  */
  const feita = foiFeita(appointment.status, appointment.ends_at)
  const podeFaltar = options.includes('no_show')
  /*
    UMA DESMARCAÇÃO SÓ, EM NOME DO SALÃO.

    Havia três — a cliente desmarcou, o salão desmarcou, não apareceu —
    e ao balcão, com a cliente à frente, eram três decisões onde só há
    uma vontade. Fica uma, e fica em nome da casa: entre pôr a culpa na
    cliente por omissão ou na casa que escolheu não perguntar, é a casa
    que a leva.

    Os outros dois estados continuam a existir na base e no modelo. Se
    um dia a diferença fizer falta a quem lê as contas do ano, volta a
    pergunta — não é preciso mexer em mais nada.
  */
  const cancelTo = options.includes('cancelled_by_salon')
    ? ('cancelled_by_salon' as const)
    : options.includes('cancelled_by_client')
      ? ('cancelled_by_client' as const)
      : null

  const total = appointment.total_cents - appointment.discount_cents
  const whenDay = capitalise(
    formatDayLong(isoDay(appointment.starts_at, tz), tz),
  )
  /*
    APAGAR — SÓ A DONA, E SÓ ENQUANTO NÃO TIVER ACONTECIDO.

    Desmarcar é trabalho de balcão e fica na história da cliente; apagar
    é dizer que aquilo nunca devia ter existido.

    A trava era o dinheiro: uma marcação com pagamento lançado não se
    apagava, porque os pagamentos iam atrás por cascata da base. Sem
    comanda não há pagamentos a lançar — mas a trava faz mais falta
    agora, não menos: o que o painel fatura passou a SER a marcação que
    já aconteceu. Apagá-la é apagar a receita do dia, e é por isso que
    a palavra que tranca deixou de ser «concluída» e passou a ser «já
    passou» — que é a mesma coisa em português mais honesto.

    Isto decide o que se DESENHA. Quem manda a sério é a acção do
    servidor, que volta a verificar tudo com a linha travada.
  */
  const dono = actor.role === 'master'
  const podeApagar = dono && !feita

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
        {/*
          SEM NÚMERO, O LUGAR DO NÚMERO NÃO FICA EM BRANCO.

          O telemóvel passou a ser opcional na marcação. Uma ficha sem
          ele não é um campo por preencher: é uma cliente que a casa não
          consegue contactar — nem para confirmar, nem para avisar de um
          atraso. Quem está ao balcão tem de o saber sem ir procurar, e
          por isso a linha do telefone passa a dizê-lo com todas as
          letras, na cor de aviso.
        */}
        {appointment.client_phone ? (
          <a
            href={`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir conversa no WhatsApp"
            className="tabular text-[0.75rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
          >
            {formatPhone(appointment.client_phone)}
          </a>
        ) : (
          <p className="text-[0.75rem] font-semibold text-[var(--warn)]">
            Sem contacto — marcou sem deixar telefone
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {aDecorrer ? (
            <Badge tone="warn">
              Em curso ·{' '}
              {faltam > 0 ? `faltam ${formatDuration(faltam)}` : 'a terminar'}
            </Badge>
          ) : feita && agora >= appointment.ends_at ? (
            /*
              O SELO É O ÚNICO SÍTIO QUE EXPLICA A MUDANÇA. Sem a hora
              lá, quem abre o painel fica sem saber se alguém carregou em
              alguma coisa — e a resposta é que ninguém carregou, foi o
              relógio.
            */
            <Badge tone="ok">
              Feita às {formatTime(appointment.ends_at, tz)}
            </Badge>
          ) : (
            <Badge tone={AGENDA_TONE[appointment.status]}>
              {STATUS_LABEL[appointment.status]}
            </Badge>
          )}
          {confirmSent ? <Badge tone="ok">Confirmação enviada</Badge> : null}
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

        A remarcação fica por baixo, em texto: é uma porta que tem de
        existir — é daqui que se lá chega — mas não é o trabalho do dia.
      */}
      <footer className="space-y-2.5 border-t border-[var(--line-soft)] px-5 py-4">
        {/*
          O «ENVIAR CONFIRMAÇÃO» SAI DAS QUE JÁ PASSARAM.

          Estava a ocupar o sítio mais visível do painel — um botão verde
          da altura de um dedo — para avisar de uma hora que já foi. O
          tamanho do botão passa a dizer se há trabalho ou não: nas que
          ainda vêm há, e ele fica; nas que passaram não há, e sai.
        */}
        {feita ? null : (
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
        )}

        {/*
          OS DOIS PEQUENOS, LADO A LADO.

          `flex-1` divide a fila em duas metades iguais. O cancelar,
          quando alguém lhe toca, abre uma pergunta que não cabe em meia
          coluna — e por isso põe `basis-full` em si próprio e a fila,
          que dobra, manda-o para uma linha só dele.
        */}
        {podeFaltar || cancelTo !== null || podeApagar ? (
          <div className="flex flex-wrap items-start gap-2">
            {podeFaltar ? (
              <StatusAction
                appointmentId={appointment.id}
                to="no_show"
                label="Não veio"
                variant="bad"
                size="md"
                full
                className="min-w-0 flex-1"
              />
            ) : null}

            {cancelTo !== null || podeApagar ? (
              <CancelAction
                appointmentId={appointment.id}
                cancelTo={cancelTo}
                itens={appointment.items.length}
                podeApagar={podeApagar}
                avisoConcluida={dono && feita}
                variant={feita ? 'quiet' : 'danger'}
                className="min-w-0 flex-1"
              />
            ) : null}
          </div>
        ) : (
          <p className="text-[0.75rem] text-[var(--ink-faint)]">
            Esta marcação já não muda de estado.
          </p>
        )}
      </footer>
    </div>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
