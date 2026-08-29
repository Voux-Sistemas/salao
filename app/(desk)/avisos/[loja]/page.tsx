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
import {
  addDays,
  formatDayLong,
  formatTime,
  isoDay,
  today,
  type IsoDay,
} from '@/lib/time'
import { isSunday } from '@/lib/sunday'
import {
  ROUTINES,
  ROUTINE_ACTION,
  ROUTINE_HINT,
  ROUTINE_LABEL,
  ROUTINE_SHORT,
  type Routine,
} from '@/lib/whatsapp'
import { Info } from 'lucide-react'
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
    <div className="mx-auto max-w-4xl px-4 pt-5 pb-8 sm:px-6 lg:py-8">
      {/*
        NO TELEMÓVEL O TOPO É UMA FAIXA, E FICA PRESA.

        O cabeçalho desta página valia o ecrã inteiro: o nome da loja, o
        título em corpo trinta, o par de lojas, um parágrafo de cinco
        linhas e as rotinas em duas filas de pastilhas. Para ver o
        primeiro aviso era preciso rolar — numa página cujo trabalho é
        despachar avisos.

        É a mesma peça do encaixe: branca, encostada à barra da casa,
        fechada por um fio, presa ao rolar. O nome da página, a loja num
        botão pequeno, e as rotinas numa fila que anda de lado.
      */}
      <div className="sticky top-14 z-20 -mx-4 -mt-5 mb-4 border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <p className="display truncate text-lg text-[var(--ink)]">
            {mine ? 'Os meus avisos' : 'Avisos'}
          </p>
          {units.length > 1 ? (
            <UnitSwitcher
              units={units}
              current={unit.slug}
              base="/avisos"
              showAll={false}
            />
          ) : (
            <span className="titulo-seccao shrink-0">{unit.name}</span>
          )}
        </div>

        {/* A fila anda de lado em vez de crescer para baixo: cinco
            rotinas não cabem em 390px, e três filas de pastilhas eram
            o mesmo muro do catálogo, por outro caminho. */}
        <nav
          aria-label="Rotinas"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6"
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
                  'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
                  active
                    ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]'
                    : 'border-[var(--line-soft)] text-[var(--ink-muted)]',
                )}
              >
                {ROUTINE_SHORT[value]}
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
      </div>

      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 max-lg:hidden">
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
      {/* Continua a ser verdade e continua a ser importante — mas é para
          se ler UMA vez, não quinze por dia. No telemóvel valia cinco
          linhas do primeiro ecrã, e quem lá vai já sabe que é ela a
          carregar no botão: acabou de o fazer trinta vezes esta semana.
          Fica no monitor, onde não custa nada. */}
      <div className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] px-4 py-3.5 max-lg:hidden">
        <span
          aria-hidden
          className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-[var(--accent)]"
        >
          <Info size={16} strokeWidth={2} />
        </span>
        <p className="text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          <span className="font-medium text-[var(--ink)]">
            O sistema nunca envia nada sozinho.
          </span>{' '}
          {mine
            ? 'Prepara a mensagem e abre a conversa — quem carrega no botão é você. Estas são as clientes que marcaram consigo, mais as de domingo, que são da casa toda.'
            : 'Prepara a mensagem e abre a conversa — quem carrega no botão é uma pessoa, e é o registo do envio que tira a linha da fila.'}
        </p>
      </div>

      {/* --- as abas ------------------------------------------------ */}
      <nav
        className={clsx(
          'flex flex-wrap gap-1.5 max-lg:hidden',
          showPeople ? 'mb-3' : 'mb-6',
        )}
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
                'flex items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5 text-[0.8125rem] transition-colors',
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
          <span className="mr-1.5 text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
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
        <h2 className="titulo-seccao">{ROUTINE_LABEL[routine]}</h2>
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
        <Card className="overflow-hidden">
          {porDia(rows, unit.timezone).map((grupo) => (
            <div key={grupo.dia}>
              {/*
                O DIA É O QUE ARRUMA ESTA FILA.

                As linhas vinham em fila única com a data repetida em
                cada uma, na coluna mais estreita do ecrã: catorze
                marcações de três dias diferentes, e o dia — que é o que
                divide o trabalho — escrito em corpo dez ao lado da
                hora. Passa a haver um título por dia, com a conta do
                dia à direita, e a data sai de dentro das linhas.

                O primeiro dia diz «Hoje» ou «Amanhã» em vez do nome:
                é como se fala ao balcão, e é a informação que faz
                decidir se aquilo é para agora ou para depois.
              */}
              <div className="flex items-center gap-3 border-t border-[var(--line-soft)] bg-[var(--surface)] px-4 py-2 first:border-t-0">
                <h3 className="titulo-seccao shrink-0">
                  {nomeDoDia(grupo.dia, unit.timezone)}
                </h3>
                <span
                  aria-hidden
                  className="h-px flex-1 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--house)_34%,transparent),transparent)]"
                />
                <span className="tabular shrink-0 text-[0.6875rem] text-[var(--ink-faint)]">
                  {grupo.linhas.length}
                </span>
              </div>
              <div className="divide-y divide-[var(--line-soft)]">
                {grupo.linhas.map((row) => (
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
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

/**
 * A FILA PARTIDA POR DIA, PELA ORDEM EM QUE JÁ VEM.
 *
 * Não ordena nada: as filas já vêm ordenadas do `loadQueue` — a maioria
 * por hora, a de recuperar clientes ao contrário — e um agrupamento que
 * reordenasse desmentia a fila que o servidor escolheu. Só corta onde o
 * dia muda.
 */
function porDia(
  linhas: NoticeRow[],
  timezone: string,
): { dia: IsoDay; linhas: NoticeRow[] }[] {
  const grupos: { dia: IsoDay; linhas: NoticeRow[] }[] = []
  for (const linha of linhas) {
    const dia = isoDay(linha.starts_at, timezone)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === dia) ultimo.linhas.push(linha)
    else grupos.push({ dia, linhas: [linha] })
  }
  return grupos
}

/** «Hoje», «Amanhã», ou o nome do dia por extenso. */
function nomeDoDia(dia: IsoDay, timezone: string): string {
  const hoje = today(timezone)
  if (dia === hoje) return 'Hoje'
  if (dia === addDays(hoje, 1)) return 'Amanhã'
  if (dia === addDays(hoje, -1)) return 'Ontem'
  const nome = formatDayLong(dia, timezone)
  return nome.charAt(0).toUpperCase() + nome.slice(1)
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
     no mesmo atendimento é coisa que ela precisa de ver.

     AO DOMINGO OS NOMES FICAM TODOS. A fila de domingo é de todas, e
     por isso traz linhas que não são dela: sem nome nenhum, ela não
     distinguia o trabalho que é seu do que é da casa. */
  const hide = isSunday(day) ? null : hideStaffId
  const staff = row.staff
    .filter((person) => person.id !== hide)
    .map((person) => person.name)
    .sort((a, b) => a.localeCompare(b, 'pt'))
    .join(', ')

  return (
    /*
      A LINHA CABE NUMA LINHA.

      O botão descia para uma linha só sua, a toda a largura, porque ao
      lado do nome não cabia. Só que isso, mais o telefone, mais os
      serviços em duas linhas, dava duzentos píxeis por aviso: quatro
      por ecrã, numa página que existe para os despachar.

      Agora cabe tudo numa linha porque saiu o que lá não fazia falta —
      ver o telefone e o corte dos serviços aqui em baixo — e porque o
      botão passa a dizer só «Enviar» no telemóvel. O alvo continua a
      ter trinta e dois píxeis de altura, que é o que um polegar pede.
    */
    <div className="flex items-center gap-3 px-3 py-2.5 lg:gap-x-4 lg:px-4 lg:py-3">
      {/* --- a hora, à cabeça da linha ------------------------------- */}
      <Link
        href={`/agenda/${unitSlug}?d=${day}&m=${row.appointment_id}`}
        className="w-12 shrink-0 text-center transition-colors hover:text-[var(--accent)] lg:w-14"
      >
        <span className="tabular block text-[0.9375rem] leading-tight text-[var(--ink)] lg:text-base">
          {formatTime(row.starts_at, timezone)}
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
          {/* O telefone não se marca à mão a partir daqui: quem o usa é
              o botão, e o botão está ao lado. No telemóvel é o que sai
              primeiro, para o nome e o serviço caberem. */}
          <span className="tabular text-[0.75rem] text-[var(--ink-muted)] max-lg:hidden">
            {formatPhone(row.client_phone)}
          </span>
          {routine === 'winback' ? (
            <Badge tone={STATUS_TONE[row.status]}>
              {STATUS_LABEL[row.status]}
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-[0.75rem] text-[var(--ink-muted)] lg:line-clamp-2 lg:whitespace-normal">
          {services || 'Sem serviços'}
          {staff ? ` · ${staff}` : ''}
        </p>
      </div>

      <SendWhatsApp
        appointmentId={row.appointment_id}
        routine={routine}
        href={message.href}
        message={message.text}
        label={
          <>
            <span className="lg:hidden">Enviar</span>
            <span className="max-lg:hidden">{ROUTINE_ACTION[routine]}</span>
          </>
        }
        className="w-auto shrink-0"
      />
    </div>
  )
}
