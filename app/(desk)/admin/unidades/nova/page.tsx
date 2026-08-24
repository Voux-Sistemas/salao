import type { Metadata } from 'next'
import { requireMaster } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { UnitDetailsForm } from '@/components/unit-forms'
import { BackLink } from '@/components/gestao-panel'

export const metadata: Metadata = { title: 'Nova loja' }

/**
 * Primeiro a loja existe; o horário, as regras e o equipamento vêm a
 * seguir, dentro dela.
 */
export default async function NovaUnidadePage() {
  // Abrir uma loja arrasta catálogo, equipa, horários, comissões e caixa
  // atrás dela. Não é gerir o salão, é mudar a forma do sistema.
  await requireMaster()
  const org = await requireOrg()

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <BackLink href="/admin/unidades" label="Unidades" />
      </div>

      <h2 className="display mb-1 text-[1.75rem] leading-tight text-[var(--ink)]">
        Nova loja
      </h2>
      <p className="mb-6 text-[0.8125rem] text-[var(--ink-muted)]">
        Depois de criada abre-se o horário da semana — sem ele não há nada
        para marcar.
      </p>

      <UnitDetailsForm defaultTimezone={org.timezone} />
    </div>
  )
}
