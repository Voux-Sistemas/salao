import Link from 'next/link'
import type { Metadata } from 'next'
import { can, requireManagement, type Actor } from '@/lib/auth/actor'
import { sql } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { Card } from '@/components/ui'

export const metadata: Metadata = { title: 'Gestão' }

type Counts = {
  units: number
  services: number
  staff: number
  pending_cents: number
}

/** O que há em cada separador, em número — para se saber por onde ir. */
async function counts(actor: Actor): Promise<Counts> {
  const rows = await sql<Counts[]>`
    select
      (select count(*)::int from unit where org_id = ${actor.orgId} and is_active) as units,
      (select count(*)::int from service where org_id = ${actor.orgId} and is_active) as services,
      (select count(*)::int from staff s
        where s.org_id = ${actor.orgId} and s.is_active
          and (${actor.orgScope}::boolean or exists (
                select 1 from staff_unit su
                 where su.staff_id = s.id
                   and su.unit_id = any(${actor.unitIds}::uuid[])
              ))) as staff,
      (select coalesce(sum(amount_cents), 0)::int from commission_entry
        where org_id = ${actor.orgId} and status = 'pending') as pending_cents
  `
  return rows[0] ?? { units: 0, services: 0, staff: 0, pending_cents: 0 }
}

export default async function AdminPage() {
  const actor = await requireManagement()
  const total = await counts(actor)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {can.manageUnits(actor) ? (
        <Tile
          href="/admin/unidades"
          title="Unidades"
          value={`${total.units} loja${total.units === 1 ? '' : 's'}`}
          hint="Horário, feriados, regras de marcação e recursos físicos."
        />
      ) : null}

      {can.manageCatalog(actor) ? (
        <Tile
          href="/admin/servicos"
          title="Serviços"
          value={`${total.services} no catálogo`}
          hint="Preço, duração, folgas e exceções por loja ou profissional."
        />
      ) : null}

      {can.manageCommissions(actor) ? (
        <Tile
          href="/admin/comissoes"
          title="Comissões"
          value={`${formatCents(total.pending_cents)} por pagar`}
          hint="Regras em percentagem e pagamento em lote por profissional."
        />
      ) : null}

      {can.manageTeam(actor) ? (
        <Tile
          href="/admin/equipe"
          title="Equipa"
          value={`${total.staff} pessoa${total.staff === 1 ? '' : 's'}`}
          hint="Papéis, lojas, habilidades, escala e ausências."
        />
      ) : null}
    </div>
  )
}

function Tile({
  href,
  title,
  value,
  hint,
}: {
  href: string
  title: string
  value: string
  hint: string
}) {
  return (
    <Link href={href}>
      <Card className="h-full px-4 py-5 transition-colors hover:border-[var(--accent)]">
        <p className="eyebrow mb-1">{title}</p>
        <p className="display text-lg text-[var(--ink)]">{value}</p>
        <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">{hint}</p>
      </Card>
    </Link>
  )
}
