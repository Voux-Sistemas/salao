import Link from 'next/link'
import type { Metadata } from 'next'
import clsx from 'clsx'
import { Search } from 'lucide-react'
import { requireManagement } from '@/lib/auth/actor'
import { listTags, searchClients, type ClientRow } from '@/lib/clients'
import { formatDayShort, formatDateTime, isoDay } from '@/lib/time'
import { LANGUAGE_SHORT } from '@/lib/i18n/config'
import { requireOrg } from '@/lib/org'
import { ButtonLink, Badge, Card, Empty, Input } from '@/components/ui'

export const metadata: Metadata = { title: 'Clientes' }

const PAGE = 50

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl text-[var(--ink)]">Clientes</h1>
          <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
            {total === 0
              ? 'Ainda ninguém.'
              : `${total} ficha${total === 1 ? '' : 's'} na rede.`}
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

      {/* --- procurar ------------------------------------------------ */}
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {chosenTag ? (
          <input type="hidden" name="tag" value={chosenTag} />
        ) : null}
        <div className="relative min-w-56 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
          />
          <Input
            name="q"
            defaultValue={term}
            placeholder="Nome ou telefone"
            autoComplete="off"
            className="pl-9"
          />
        </div>
        <button
          type="submit"
          className="h-10 border border-[var(--line)] px-4 text-[0.8125rem] text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Procurar
        </button>
        {term || chosenTag ? (
          <Link
            href="/clientes"
            className="text-[0.8125rem] text-[var(--ink-muted)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
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
                  'border px-2.5 py-1 text-[0.75rem] transition-colors',
                  active
                    ? 'border-[var(--accent)] text-[var(--accent)]'
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
            <ClientLine key={row.id} row={row} timezone={org.timezone} />
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

function ClientLine({ row, timezone }: { row: ClientRow; timezone: string }) {
  return (
    <Link
      href={`/clientes/${row.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="truncate text-sm text-[var(--ink)]">{row.name}</span>
          <span className="tabular text-[0.75rem] text-[var(--ink-muted)]">
            {row.phone}
          </span>
          {row.language !== 'pt' ? (
            <Badge>{LANGUAGE_SHORT[row.language]}</Badge>
          ) : null}
          {row.no_show_count > 0 ? (
            <Badge tone="bad">
              {row.no_show_count} falta{row.no_show_count === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {row.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} tone="accent">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="truncate text-[0.75rem] text-[var(--ink-faint)]">
          {row.visits > 0
            ? `${row.visits} visita${row.visits === 1 ? '' : 's'}`
            : 'Ainda não veio'}
          {row.last_visit_at
            ? ` · última a ${formatDayShort(isoDay(row.last_visit_at, timezone), timezone)}`
            : ''}
          {row.preferred_unit_name ? ` · ${row.preferred_unit_name}` : ''}
        </p>
      </div>

      {row.next_at ? (
        <span className="tabular shrink-0 text-[0.75rem] text-[var(--accent)]">
          {formatDateTime(row.next_at, timezone)}
        </span>
      ) : null}
    </Link>
  )
}
