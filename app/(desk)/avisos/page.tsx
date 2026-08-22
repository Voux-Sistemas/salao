import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { loadQueue } from '@/lib/notices'
import { Empty } from '@/components/ui'
import { StoreChooser } from '@/components/store-chooser'

export const metadata: Metadata = { title: 'Avisos' }

/** O ecrã sem loja é um seletor, não um ecrã vazio. */
export default async function AvisosChooser() {
  const actor = await requireManagement()
  const units = await unitsFor(actor)

  const only = units[0]
  if (units.length === 1 && only) redirect(`/avisos/${only.slug}`)

  if (units.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Empty
          title="Sem lojas"
          hint="Ainda não há loja atribuída a esta conta. Fale com quem gere a rede."
        />
      </div>
    )
  }

  /* A fila de amanhã, por casa — é o aviso que mais evita faltas. */
  const reminders = await Promise.all(
    units.map((unit) => loadQueue(unit, 'reminder_eve')),
  )

  return (
    <StoreChooser
      eyebrow="Avisos"
      title="Que loja?"
      hint="O sistema nunca envia nada sozinho — prepara a mensagem e uma pessoa carrega no botão. Cada loja tem a sua fila."
      cta="Ver a fila"
      stores={units.map((unit, index) => {
        const pending = reminders[index]?.length ?? 0
        return {
          href: `/avisos/${unit.slug}`,
          name: unit.name,
          meta: unit.city ?? unit.address_line ?? unit.timezone,
          badge: {
            label: pending > 0 ? `${pending} por enviar` : 'Em dia',
            tone: pending > 0 ? ('warn' as const) : ('ok' as const),
          },
          line:
            pending > 0
              ? `${pending} lembrete${pending === 1 ? '' : 's'} da véspera para amanhã.`
              : 'Sem lembretes da véspera pendentes.',
        }
      })}
    />
  )
}
