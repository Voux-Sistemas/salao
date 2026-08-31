import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { Search } from 'lucide-react'
import { requireManagement } from '@/lib/auth/actor'
import { listTags, searchClients, type ClientRow } from '@/lib/clients'
import { sql } from '@/lib/db'
import {
  daysBetween,
  formatDayShort,
  formatMonthShort,
  formatTime,
  formatWeekdayShort,
  isoDay,
  today,
  type IsoDay,
} from '@/lib/time'
import { requireOrg } from '@/lib/org'
import { Monogram } from '@/components/brand'
import { formatPhone } from '@/lib/text'
import { ButtonLink, Card, Empty, Input } from '@/components/ui'

export const metadata: Metadata = { title: 'Clientes' }

const PAGE = 50

/** "Ana Sofia Marques" -> "AM", para o monograma do avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '·'
}

/**
 * A LETRA DE UM NOME, SEM ACENTO. «Álvaro» e «Alvaro» vão para a mesma
 * secção — separá-los daria duas letras «A» na mesma página, e ninguém
 * procura um nome pelo acento da primeira letra.
 */
function letraDe(row: ClientRow): string {
  if (row.no_name) return '—'
  const inicial = row.name.trim().charAt(0)
  if (!inicial) return '—'
  const limpa = inicial
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  return /[A-Z]/.test(limpa) ? limpa : '#'
}

/**
 * Corta a página em secções, pela letra. As linhas já vêm ordenadas da
 * base — isto só as agrupa, e por isso uma letra nunca aparece duas
 * vezes na mesma página.
 */
function seccoes(rows: ClientRow[]): { letra: string; linhas: ClientRow[] }[] {
  const fora: { letra: string; linhas: ClientRow[] }[] = []
  for (const row of rows) {
    const letra = letraDe(row)
    const ultima = fora[fora.length - 1]
    if (ultima && ultima.letra === letra) ultima.linhas.push(row)
    else fora.push({ letra, linhas: [row] })
  }
  return fora
}

/**
 * QUANDO VOLTA, EM DUAS PALAVRAS.
 *
 * Estava «22 de setembro às 15:00» — metade da linha do telemóvel para
 * uma data que, na maior parte das vezes, é esta semana. Perto diz-se
 * pelo nome («hoje», «amanhã»); dentro da semana basta o dia («qui 4»);
 * mais longe entra o mês, senão «ter 7» de outubro lê-se como setembro.
 */
function quando(
  next: Date,
  timezone: string,
  hoje: IsoDay,
): { dia: string; hora: string; perto: boolean } {
  const dia = isoDay(next, timezone)
  const faltam = daysBetween(hoje, dia)
  const hora = formatTime(next, timezone)

  if (faltam <= 0) return { dia: 'hoje', hora, perto: true }
  if (faltam === 1) return { dia: 'amanhã', hora, perto: true }
  if (faltam <= 6) {
    return {
      dia: `${formatWeekdayShort(dia, timezone)} ${Number(dia.slice(8, 10))}`,
      hora,
      perto: false,
    }
  }
  return {
    dia: `${Number(dia.slice(8, 10))} ${formatMonthShort(dia, timezone)}`,
    hora,
    perto: false,
  }
}

/**
 * A LISTA. Procura-se pelo nome ou pelo telefone — e o telefone acha-se
 * escrito de qualquer maneira, porque a comparação é só por dígitos.
 *
 * A ficha é uma só na rede: quem vem às duas lojas aparece aqui uma vez.
 */
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; p?: string }>
}) {
  const actor = await requireManagement()
  const { q, tag, p } = await searchParams

  const term = (q ?? '').trim()
  const chosenTag = (tag ?? '').trim()
  const page = Math.max(0, Number.parseInt(p ?? '0', 10) || 0)

  const [{ rows, total }, tags, org] = await Promise.all([
    searchClients(actor.orgId, {
      term,
      tag: chosenTag,
      offset: page * PAGE,
    }),
    listTags(actor.orgId),
    requireOrg(),
  ])

  const pages = Math.ceil(total / PAGE)

  /* A ficha pode ainda não ter a última visita gravada — a agenda sabe.
     Uma leitura só, para as fichas desta página. */
  const missing = rows.filter((row) => !row.last_visit_at).map((row) => row.id)
  const found =
    missing.length > 0
      ? await sql<{ client_id: string; last_at: Date }[]>`
          select a.client_id, max(a.starts_at) as last_at
            from appointment a
           where a.client_id = any(${missing}::uuid[])
             and a.status = 'completed'
           group by a.client_id
        `
      : []
  const lastVisits = new Map(found.map((row) => [row.client_id, row.last_at]))
  const hoje = today(org.timezone)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/*
        O CABEÇALHO ENCOLHEU, E ISSO NO TELEMÓVEL É LISTA.

        Tinha título, subtítulo de duas linhas, dois botões grandes, o
        campo e ainda um botão «Procurar» de linha inteira: cinco blocos
        antes da primeira cliente, que num ecrã de 844 píxeis deixavam
        ver três fichas.

        O subtítulo explicava uma regra do sistema — a ficha é uma só na
        rede — que se aprende à primeira e depois pesa todos os dias.
        Fica a contagem. O «Importar» é coisa de uma vez por ano, e
        passa a texto ao lado dela.
      */}
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl text-[var(--ink)]">Clientes</h1>
          <p className="tabular mt-1.5 text-[0.8125rem] text-[var(--ink-faint)]">
            {total === 0 ? (
              'Ainda ninguém.'
            ) : (
              <>
                {total} ficha{total === 1 ? '' : 's'}
                {' · '}
                <Link
                  href="/clientes/importar"
                  className="font-semibold text-[var(--accent)] underline underline-offset-2 transition-colors hover:text-[var(--accent-strong)]"
                >
                  importar
                </Link>
              </>
            )}
          </p>
        </div>
        <ButtonLink href="/clientes/novo" size="md" className="shrink-0">
          + Nova ficha
        </ButtonLink>
      </header>

      {/*
        SEM BOTÃO «PROCURAR».

        O campo vive dentro de um formulário: a tecla de ir já submete,
        e no telemóvel o teclado mostra a lupa. Aquele bloco existia
        para repetir o que o teclado faz, e custava uma linha de lista.
      */}
      <form method="get" className="mb-4 flex items-center gap-3">
        {chosenTag ? (
          <input type="hidden" name="tag" value={chosenTag} />
        ) : null}
        <div className="relative min-w-0 flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
          />
          <Input
            name="q"
            defaultValue={term}
            placeholder="Nome ou telefone"
            autoComplete="off"
            className="pl-11"
          />
        </div>
        {term || chosenTag ? (
          <Link
            href="/clientes"
            className="shrink-0 text-[0.8125rem] text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
          >
            Limpar
          </Link>
        ) : null}
      </form>

      {tags.length > 0 ? (
        <nav className="mb-5 flex flex-wrap gap-1.5" aria-label="Etiquetas">
          {tags.map(({ tag: value, count }) => {
            const active = value === chosenTag
            const query = new URLSearchParams()
            if (term) query.set('q', term)
            if (!active) query.set('tag', value)
            const href = query.size ? `/clientes?${query}` : '/clientes'
            return (
              <Link
                key={value}
                href={href}
                className={clsx(
                  'rounded-full border px-3 py-1 text-[0.75rem] font-medium transition-colors',
                  active
                    ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]'
                    : 'border-[var(--line-soft)] text-[var(--ink-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                )}
              >
                {value}
                <span className="tabular ml-1.5 text-[var(--ink-faint)]">
                  {count}
                </span>
              </Link>
            )
          })}
        </nav>
      ) : null}

      {rows.length === 0 ? (
        <Empty
          title={term || chosenTag ? 'Nada encontrado' : 'Sem clientes'}
          hint={
            term || chosenTag
              ? 'Experimente outro pedaço do nome ou os últimos dígitos do telefone.'
              : 'Crie a primeira ficha ou traga a lista que já tem.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {seccoes(rows).map((seccao) => (
            <div key={seccao.letra}>
              {/*
                A LETRA MARCA A SECÇÃO E CALA-SE.

                Teve ao lado quantas fichas tinha — «A 21» — e era um
                número que ninguém usa: não se decide nada com ele, e
                pedia leitura em cada paragem. Fica a letra e um fio
                até à margem.
              */}
              <div className="flex items-center gap-2.5 border-y border-[var(--line-soft)] bg-[var(--surface)] px-4 py-1.5 first:border-t-0">
                <span className="display text-[0.875rem] leading-none text-[var(--accent)]">
                  {seccao.letra}
                </span>
                <span aria-hidden className="h-px flex-1 bg-[var(--line-soft)]" />
              </div>
              {seccao.linhas.map((row) => (
                <ClientLine
                  key={row.id}
                  row={row}
                  lastVisitAt={row.last_visit_at ?? lastVisits.get(row.id) ?? null}
                  timezone={org.timezone}
                  hoje={hoje}
                />
              ))}
            </div>
          ))}
        </Card>
      )}

      {pages > 1 ? (
        <nav className="mt-5 flex items-center justify-between text-[0.8125rem]">
          <PageLink
            term={term}
            tag={chosenTag}
            page={page - 1}
            disabled={page === 0}
          >
            Anteriores
          </PageLink>
          {/*
            «1 de 3» obrigava a fazer a conta de cabeça para saber onde
            se estava na lista. O intervalo diz o mesmo e diz-se
            sozinho: «51–100 de 137».
          */}
          <span className="tabular text-[var(--ink-faint)]">
            {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} de {total}
          </span>
          <PageLink
            term={term}
            tag={chosenTag}
            page={page + 1}
            disabled={page + 1 >= pages}
          >
            Seguintes
          </PageLink>
        </nav>
      ) : null}
    </div>
  )
}

function PageLink({
  term,
  tag,
  page,
  disabled,
  children,
}: {
  term: string
  tag: string
  page: number
  disabled: boolean
  children: string
}) {
  if (disabled) {
    return <span className="text-[var(--ink-faint)]">{children}</span>
  }
  const query = new URLSearchParams()
  if (term) query.set('q', term)
  if (tag) query.set('tag', tag)
  if (page > 0) query.set('p', String(page))
  return (
    <Link
      href={query.size ? `/clientes?${query}` : '/clientes'}
      className="text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
    >
      {children}
    </Link>
  )
}

/**
 * UMA LINHA DA LISTA.
 *
 * O NOME E O TELEFONE DEIXARAM DE COMPETIR. O telefone andava colado ao
 * nome, em cinzento pequeno, e a segunda linha dizia o histórico — que
 * em oito fichas de nove era «Ainda não veio». Uma frase que está
 * sempre lá deixa de se ler e continua a pagar-se em altura.
 *
 * Agora a segunda linha é O TELEFONE, que é diferente em cada ficha e é
 * o que distingue duas «Ana». Não é decoração: o sistema já trata o
 * número como a identidade — é por ele que a mesma pessoa nas duas
 * lojas é uma ficha só. E quando falta, di-lo a cor de aviso, porque é
 * essa falta que faz nascer fichas repetidas.
 *
 * As visitas só aparecem quando existem.
 *
 * A PARTIR DE `sm` A LINHA VIRA COLUNAS. Num monitor o meio era
 * elástico e empurrava a data para um sítio diferente em cada linha; a
 * vista andava aos ziguezagues em vez de descer. Com larguras fixas
 * comparam-se duas clientes sem as procurar.
 */
function ClientLine({
  row,
  lastVisitAt,
  timezone,
  hoje,
}: {
  row: ClientRow
  lastVisitAt: Date | null
  timezone: string
  hoje: IsoDay
}) {
  const volta = row.next_at ? quando(row.next_at, timezone, hoje) : null
  const historico = [
    row.visits > 0 ? `${row.visits} visita${row.visits === 1 ? '' : 's'}` : null,
    lastVisitAt
      ? `última a ${formatDayShort(isoDay(lastVisitAt, timezone), timezone)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/clientes/${row.id}`}
      className="flex items-center gap-3 border-t border-[var(--line-soft)] px-4 py-2.5 transition-colors first:border-t-0 hover:bg-[var(--surface-2)] sm:gap-3.5"
    >
      <span
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.8125rem]',
          row.no_name
            ? 'border border-dashed border-[var(--line)] text-[var(--ink-faint)]'
            : 'bg-[color-mix(in_srgb,var(--accent)_11%,transparent)] text-[var(--accent)]',
        )}
      >
        {row.no_name ? (
          <span aria-hidden>?</span>
        ) : (
          <Monogram initials={initialsOf(row.name)} className="text-[0.8125rem]" />
        )}
      </span>

      <span className="min-w-0 flex-1 sm:w-[13rem] sm:flex-none">
        <span
          className={clsx(
            'block truncate text-[0.9375rem]',
            row.no_name
              ? 'italic text-[var(--ink-faint)]'
              : 'font-semibold text-[var(--ink)]',
          )}
        >
          {row.no_name ? 'Sem nome' : row.name}
        </span>
        {/* No telemóvel não há colunas: o telefone e o histórico descem
            para aqui, e a casa fica de fora — quem precisa dela abre a
            ficha. */}
        <span className="mt-0.5 block truncate text-[0.75rem] text-[var(--ink-faint)] sm:hidden">
          <Telefone row={row} />
          {historico ? ` · ${historico}` : ''}
          <Faltas n={row.no_show_count} />
        </span>
      </span>

      <span className="tabular max-sm:hidden w-[8.5rem] shrink-0 truncate text-[0.8125rem] text-[var(--ink-muted)]">
        <Telefone row={row} />
      </span>
      <span className="max-sm:hidden min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--ink-faint)]">
        {historico || '—'}
        <Faltas n={row.no_show_count} />
      </span>
      <span className="max-sm:hidden w-[5.5rem] shrink-0">
        {row.preferred_unit_name ? (
          <span className="inline-flex items-center rounded-full bg-[var(--surface)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--ink-muted)]">
            {row.preferred_unit_name}
          </span>
        ) : null}
      </span>

      {/* A data da próxima marcação. Tinha por cima a palavra «VOLTA» em
          versalete, em todas as linhas que a tinham — e uma data já se
          lê como data. O que fica é a cor: o que é hoje ou amanhã acende,
          o resto é cinzento. */}
      <span className="w-[4.75rem] shrink-0 text-right leading-tight sm:w-[7rem]">
        {volta ? (
          <>
            <span
              className={clsx(
                'block text-[0.75rem]',
                volta.perto ? 'text-[var(--warn)]' : 'text-[var(--ink-faint)]',
              )}
            >
              {volta.dia}
            </span>
            <span
              className={clsx(
                'tabular block text-[0.8125rem] font-bold',
                volta.perto ? 'text-[var(--accent)]' : 'text-[var(--ink-muted)]',
              )}
            >
              {volta.hora}
            </span>
          </>
        ) : null}
      </span>
    </Link>
  )
}

/** O número, ou a falta dele — que é a raiz das fichas repetidas. */
function Telefone({ row }: { row: ClientRow }) {
  if (!row.phone) {
    return (
      <span className="font-semibold text-[var(--warn)]">sem telefone</span>
    )
  }
  return <span className="tabular">{formatPhone(row.phone)}</span>
}

/**
 * As faltas eram um selo com fundo próprio, na mesma fila das
 * etiquetas douradas — e ali confundiam-se com elas. São texto, na cor
 * do que corre mal, e só existem quando são mais do que zero.
 */
function Faltas({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="font-semibold text-[var(--bad)]">
      {' · '}
      {n} falta{n === 1 ? '' : 's'}
    </span>
  )
}
