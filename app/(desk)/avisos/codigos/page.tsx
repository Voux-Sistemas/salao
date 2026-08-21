import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { pendingCodes } from '@/lib/account'
import { requireManagement } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { formatTime } from '@/lib/time'
import { ACCESS_CODE_TEMPLATE, renderTemplate, waLink } from '@/lib/whatsapp'
import { ButtonLink, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Códigos' }

export const dynamic = 'force-dynamic'

/**
 * OS CÓDIGOS À ESPERA.
 *
 * A cliente pediu para entrar na área dela. O sistema NÃO manda o
 * código sozinho — gera-o e deixa-o aqui, legível, para que uma pessoa
 * abra a conversa e o escreva. É a mesma regra de todos os avisos.
 *
 * A lista é da rede, não da loja: a ficha da cliente é uma só e o
 * telefone é a identidade.
 */
export default async function CodigosPage() {
  const actor = await requireManagement()
  const [org, codes] = await Promise.all([
    requireOrg(),
    pendingCodes(actor.orgId),
  ])
  const now = Date.now()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/avisos"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={14} />
        Avisos
      </Link>

      <h1 className="display text-2xl text-[var(--ink)]">Códigos de acesso</h1>
      <p className="mt-1 mb-6 max-w-lg text-[0.8125rem] text-[var(--ink-muted)]">
        Quem pediu para entrar na área de conta. Cada código vale 10 minutos e
        pedir outro apaga o anterior — mande o que está aqui, não um de trás.
      </p>

      {codes.length === 0 ? (
        <Empty
          title="Nada à espera"
          hint="Ninguém pediu código nos últimos minutos."
        />
      ) : (
        <Card className="divide-y divide-[var(--line-soft)]">
          {codes.map((row) => {
            const minutes = Math.max(
              0,
              Math.round((row.expires_at.getTime() - now) / 60_000),
            )
            const text = renderTemplate(ACCESS_CODE_TEMPLATE[row.language], {
              cliente: row.client_name,
              codigo: row.code,
            })

            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <span className="tabular display shrink-0 text-xl tracking-[0.2em] text-[var(--accent)]">
                  {row.code}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/clientes/${row.client_id}`}
                    className="truncate text-sm text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                  >
                    {row.client_name}
                  </Link>
                  <p className="tabular truncate text-[0.75rem] text-[var(--ink-muted)]">
                    {row.target} · pedido às{' '}
                    {formatTime(row.created_at, org.timezone)} · expira em{' '}
                    {minutes} min
                  </p>
                </div>

                <ButtonLink
                  href={waLink(row.target, text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="sm"
                >
                  Enviar
                  <ExternalLink size={13} />
                </ButtonLink>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
