import type { Metadata } from 'next'
import { requireMaster } from '@/lib/auth/actor'
import { howLong, maintenance } from '@/lib/maintenance'
import { MaintenanceSwitch } from '@/components/system-forms'
import { Panel } from '@/components/gestao-panel'
import { Badge } from '@/components/ui'

export const metadata: Metadata = { title: 'Sistema' }

/**
 * O SEPARADOR DE QUEM MONTA O SISTEMA.
 *
 * `requireMaster` responde `notFound` a quem não é — e não «não pode».
 * A dona não precisa de saber que existe uma porta que não é dela; é o
 * mesmo critério que já guarda o abrir e fechar de lojas.
 */
export default async function SistemaPage() {
  await requireMaster()
  const state = await maintenance()

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="display text-[1.75rem] leading-tight text-[var(--ink)]">
            Sistema
          </h2>
          {state.since ? (
            <Badge tone="bad">Fechada {howLong(state.since)}</Badge>
          ) : (
            <Badge tone="ok">Aberta</Badge>
          )}
        </div>
        <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
          Esta página é de quem monta o sistema. A dona não a vê.
        </p>
      </div>

      <Panel
        title="Fechar a casa para obras"
        hint="Para um deploy, uma migração, ou qualquer coisa que não deva apanhar ninguém a meio."
      >
        <MaintenanceSwitch
          since={state.since ? state.since.toISOString() : null}
          note={state.note}
        />
      </Panel>

      <Panel title="Porque é que isto existe">
        <div className="space-y-3 text-sm leading-relaxed text-[var(--ink-muted)]">
          <p>
            O funil de marcação guarda passos entre pedidos. Uma cliente que
            esteja a meio dele quando o servidor troca de versão fica com meia
            marcação feita e sem resposta — e é a pior altura para isso
            acontecer, porque já escolheu serviço, pessoa e hora.
          </p>
          <p>
            Fechar antes de publicar transforma esse acidente numa página que
            diz &laquo;voltamos já&raquo;.
          </p>
        </div>
      </Panel>
    </div>
  )
}
