import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { Search } from 'lucide-react'
import { requireManagement } from '@/lib/auth/actor'
import { listTags, searchClients, type ClientRow } from '@/lib/clients'
import { sql } from '@/lib/db'
import {
  formatDayShort,
  formatDateTime,
  formatDateTimeShort,
  isoDay,
} from '@/lib/time'
import { LANGUAGE_SHORT } from '@/lib/i18n/config'
import { requireOrg } from '@/lib/org'
import { Monogram } from '@/components/brand'
import { formatPhone } from '@/lib/text'
import {
  ButtonLink,
  Badge,
  buttonClass,
  Card,
  Empty,
  Input,
} from '@/components/ui'

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl text-[var(--ink)]">Clientes</h1>
          <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
            {total === 0
              ? 'Ainda ninguém.'
              : `${total} ficha${total === 1 ? '' : 's'} na rede — a mesma pessoa nas duas lojas é uma só.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/clientes/importar" variant="quiet" size="md">
            Importar
          </ButtonLink>
          <ButtonLink href="/clientes/novo" size="md">
            Nova ficha
          </ButtonLink>
        </div>
      </header>

      {/* --- procurar, em grande ------------------------------------- */}
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {chosenTag ? (
          <input type="hidden" name="tag" value={chosenTag} />
        ) : null}
        <div className="relative min-w-64 flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
          />
          <Input
            name="q"
            defaultValue={term}
            placeholder="Nome ou telefone — basta um pedaço"
            autoComplete="off"
            className="h-12 pl-11 text-[0.9375rem]"
          />
        </div>
        <button type="submit" className={buttonClass('primary', 'md', 'h-12 px-6')}>
          Procurar
        </button>
        {term || chosenTag ? (
          <Link
            href="/clientes"
            className="text-[0.8125rem] text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
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
                  'rounded-[2px] border px-2.5 py-1 text-[0.75rem] uppercase tracking-[0.06em] transition-colors',
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
        <Card className="divide-y divide-[var(--line-soft)]">
          {rows.map((row) => (
            <ClientLine
              key={row.id}
              row={row}
              lastVisitAt={row.last_visit_at ?? lastVisits.get(row.id) ?? null}
              timezone={org.timezone}
            />
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
          <span className="tabular text-[var(--ink-faint)]">
            {page + 1} de {pages}
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

function ClientLine({
  row,
  lastVisitAt,
  timezone,
}: {
  row: ClientRow
  lastVisitAt: Date | null
  timezone: string
}) {
  return (
    <Link
      href={`/clientes/${row.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-[var(--line-soft)] bg-[var(--surface-2)] text-[var(--accent)]">
        <Monogram initials={initialsOf(row.name)} className="text-base" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="truncate text-[0.9375rem] text-[var(--ink)]">
            {row.name}
          </span>
          <span className="tabular text-[0.75rem] text-[var(--ink-muted)]">
            {formatPhone(row.phone)}
          </span>
          {row.language !== 'pt' ? (
            <Badge>{LANGUAGE_SHORT[row.language]}</Badge>
          ) : null}
          {row.no_show_count > 0 ? (
            <Badge tone="warn">
              {row.no_show_count} falta{row.no_show_count === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {row.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} tone="accent">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-faint)]">
          {row.visits > 0
            ? `${row.visits} visita${row.visits === 1 ? '' : 's'}`
            : 'Ainda não veio'}
          {lastVisitAt
            ? ` · última a ${formatDayShort(isoDay(lastVisitAt, timezone), timezone)}`
            : ''}
          {/* A casa preferida é o que se sacrifica primeiro: no telemóvel
              esta linha não chega ao fim e cortava a meio da palavra. Quem
              precisa dela abre a ficha. */}
          {row.preferred_unit_name ? (
            <span className="hidden sm:inline">
              {' '}
              · {row.preferred_unit_name}
            </span>
          ) : null}
        </p>
      </div>

      {/* Sem legenda, esta data à direita tanto podia ser a última
          visita como a próxima — e a linha da esquerda já fala de
          visitas passadas. */}
      {row.next_at ? (
        <span className="shrink-0 text-right leading-snug">
          <span className="block text-[0.625rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Volta
          </span>
          {/* A data por extenso ocupa metade da linha num telemóvel, e o
              que se perde do outro lado é o nome e o «última visita a».
              Aqui vai encurtada; a partir de `sm` volta ao normal. */}
          <span className="tabular mt-0.5 block text-[0.75rem] text-[var(--accent)] sm:hidden">
            {formatDateTimeShort(row.next_at, timezone)}
          </span>
          <span className="tabular mt-0.5 hidden text-[0.75rem] text-[var(--accent)] sm:block">
            {formatDateTime(row.next_at, timezone)}
          </span>
        </span>
      ) : null}
    </Link>
  )
}
