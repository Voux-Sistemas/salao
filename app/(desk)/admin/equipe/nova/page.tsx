import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { can, requireManagement, unitsFor } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { listSkills, listSkillSources } from '@/lib/team'
import { today } from '@/lib/time'
import { openWeekdaysFor } from '@/lib/hours'
import { Ficha } from '@/components/team-ficha'
import { BackLink } from '@/components/gestao-panel'

export const metadata: Metadata = { title: 'Nova pessoa' }

/**
 * É A MESMA PÁGINA DA FICHA, POR PREENCHER.
 *
 * Antes eram dois ecrãs: um pedia meia dúzia de campos, e o outro —
 * logo a seguir a gravar — voltava a pedir os mesmos mais sete painéis.
 * A repetição é que dava a sensação de formulário gigante, não o
 * tamanho. Agora escreve-se tudo uma vez, e o servidor cria a pessoa, as
 * lojas, o papel, a escala e as habilidades numa transacção só.
 */
export default async function NovaPessoaPage() {
  const actor = await requireManagement()
  const units = await unitsFor(actor)
  if (units.length === 0) redirect('/admin/equipe')

  const org = await requireOrg()
  const [groups, sources, abertura] = await Promise.all([
    listSkills(actor.orgId, null),
    listSkillSources(actor, null),
    openWeekdaysFor(units.map((unit) => unit.id)),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <BackLink href="/admin/equipe" label="Equipa" />
      </div>

      <h2 className="display mb-1 text-[1.75rem] leading-tight text-[var(--ink)]">
        Nova pessoa
      </h2>
      <p className="mb-6 text-[0.8125rem] text-[var(--ink-muted)]">
        Preenche o que sabes. O que ficar por dizer diz-se depois — a página
        é a mesma.
      </p>

      <Ficha
        member={null}
        units={units.map((unit) => ({
          id: unit.id,
          name: unit.name,
          openWeekdays: abertura.get(unit.id) ?? [],
        }))}
        memberUnits={[]}
        roles={[{ role: 'professional', unitId: null }]}
        groups={groups}
        schedule={[]}
        sources={sources}
        today={today(org.timezone)}
        canGrantNetwork={actor.orgScope && actor.role !== 'manager'}
        canGrantMaster={can.manageMasters(actor)}
      />
    </div>
  )
}
