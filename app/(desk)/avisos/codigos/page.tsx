import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { pendingCodes } from '@/lib/account'
import { requireManagement } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { formatTime } from '@/lib/time'
import { ACCESS_CODE_TEMPLATE, renderTemplate, waLink } from '@/lib/whatsapp'
import { Badge, ButtonLink, Card, Empty } from '@/components/ui'

export const metadata: Metadata = { title: 'Códigos' }

export const dynamic = 'force-dynamic'

/**
 * OS CÓDIGOS À ESPERA.
 *
 * A cliente pediu para entrar na área dela. O sistema NÃO manda o
 * código sozinho — gera-o e deixa-o aqui, legível, para que uma pessoa
 * o dite ao telefone ou o mande pela conversa. É a mesma regra de todos
 * os avisos.
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

      <h1 className="display text-3xl text-[var(--ink)]">Códigos de acesso</h1>
      <p className="mb-6 mt-1 max-w-lg text-[0.8125rem] text-[var(--ink-muted)]">
        Quem pediu para entrar na área de conta. O código está aqui legível
        para se ditar à cliente — cada um vale 10 minutos, e pedir outro apaga
        o anterior: mande o que está aqui, não um de trás.
      </p>

      {codes.length === 0 ? (
        <Card>
          <Empty
            title="Nada à espera"
            hint="Ninguém pediu código nos últimos minutos."
          />
        </Card>
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
                className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5"
              >
                <span className="tabular display shrink-0 rounded-[2px] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-1.5 text-xl tracking-[0.3em] text-[var(--accent)]">
                  {row.code}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/clientes/${row.client_id}`}
                      className="truncate text-sm text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                    >
                      {row.client_name}
                    </Link>
                    <span className="tabular text-[0.75rem] text-[var(--ink-muted)]">
                      {row.target}
                    </span>
                  </div>
                  <p className="tabular truncate text-[0.75rem] text-[var(--ink-faint)]">
                    Pedido às {formatTime(row.created_at, org.timezone)}
                  </p>
                </div>

                <Badge tone={minutes <= 3 ? 'warn' : 'neutral'}>
                  Expira em {minutes} min
                </Badge>

                <ButtonLink
                  href={waLink(row.target, text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="sm"
                >
                  Abrir WhatsApp
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
