import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { requireManagement, unitsFor } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { ABSENCE_LABEL, LEVEL_LABEL } from '@/lib/status'
import {
  getMember,
  listAbsences,
  listMemberUnits,
  listRoles,
  listSchedule,
  listSkills,
} from '@/lib/team'
import { formatDateTime, today } from '@/lib/time'
import {
  AbsenceForm,
  MemberExit,
  MemberForm,
  MemberUnits,
  OpenScheduleForm,
  PasswordForm,
  RemoveAbsence,
  RolesPanel,
  ScheduleLine,
  SkillsPanel,
} from '@/components/team-forms'
import { BackLink, Panel } from '@/components/gestao-panel'
import { Badge, Divider, Notice } from '@/components/ui'
import { formatPhone } from '@/lib/text'

export const metadata: Metadata = { title: 'Ficha' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * UMA PESSOA POR DENTRO.
 *
 * Papéis, lojas, habilidades, escala e ausências. A escala é o único
 * sítio do sistema onde uma linha se fecha em vez de se corrigir: mudar
 * as horas de uma vigência que já correu mudaria o passado da agenda.
 */
export default async function PessoaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireManagement()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const member = await getMember(actor, id)
  if (!member) notFound()

  const org = await requireOrg()
  const todayIso = today(org.timezone)

  const [units, roles, memberUnits, skills, schedule, absences] =
    await Promise.all([
      unitsFor(actor),
      listRoles(member.id),
      listMemberUnits(member.id),
      listSkills(actor.orgId, member.id),
      listSchedule(member.id, todayIso),
      listAbsences(member.id),
    ])

  const options = units.map((unit) => ({ id: unit.id, name: unit.name }))
  const timezones = new Map(units.map((unit) => [unit.id, unit.timezone]))
  const isOwner = actor.orgScope && actor.role !== 'manager'

  const skillCount = skills.reduce(
    (total, group) => total + group.services.filter((s) => s.has).length,
    0,
  )
  const mine = memberUnits.filter((unitId) => timezones.has(unitId))

  const warnings: string[] = []
  if (!member.has_password) {
    warnings.push(
      'Ainda não tem palavra-passe — e sem ela não entra no sistema.',
    )
  }
  if (mine.length === 0) {
    warnings.push(
      'Não atende em loja nenhuma. Enquanto assim for, não aparece em agenda nenhuma.',
    )
  }
  if (member.accepts_online_booking && skillCount === 0) {
    warnings.push(
      'Aceita marcação online mas não tem habilidade nenhuma: no funil público não há serviço que a ofereça.',
    )
  }
  if (mine.length > 0 && schedule.length === 0) {
    warnings.push(
      'Sem escala aberta. A loja pode estar de portas abertas — se ela não está escalada, não há horário para dar.',
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="mb-4">
          <BackLink href="/admin/equipe" label="Equipa" />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span
              aria-hidden
              className="h-8 w-1 shrink-0 rounded-[1px]"
              style={{ background: member.display_color }}
            />
            <h2 className="display text-[1.75rem] leading-tight text-[var(--ink)]">
              {member.name}
            </h2>
            {roles.map((role) => (
              <Badge
                key={role.id}
                tone={role.role === 'owner' ? 'accent' : 'neutral'}
              >
                {LEVEL_LABEL[role.role]}
                {role.unit_name ? ` · ${role.unit_name}` : ''}
              </Badge>
            ))}
            {member.is_active ? null : <Badge tone="bad">Saiu</Badge>}
          </div>
          <p className="tabular text-sm text-[var(--ink-muted)]">
            {formatPhone(member.phone)}
          </p>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <Notice key={warning} tone="warn">
              {warning}
            </Notice>
          ))}
        </div>
      ) : null}

      <MemberForm
        member={{
          id: member.id,
          name: member.name,
          phone: member.phone,
          email: member.email,
          bio: member.bio,
          display_color: member.display_color,
          accepts_online_booking: member.accepts_online_booking,
        }}
      />

      {/* --- papéis -------------------------------------------------- */}
      <Panel
        title="Papéis"
        hint="Um papel guarda-se com uma loja. Sem loja associada vale a rede toda."
        flush
      >
        <RolesPanel
          staffId={member.id}
          roles={roles}
          units={options}
          canGrantNetwork={isOwner}
        />
      </Panel>

      {/* --- lojas --------------------------------------------------- */}
      <Panel
        title="Lojas onde atende"
        hint="Onde põe os pés — coisa diferente do papel. É daqui que a escala pode partir."
      >
        <MemberUnits staffId={member.id} units={options} current={memberUnits} />
      </Panel>

      {/* --- habilidades --------------------------------------------- */}
      <Panel
        title="Habilidades"
        hint="Quem não tem a habilidade nunca aparece como opção nesse serviço — nem no site, nem ao balcão."
      >
        {skills.length === 0 ? (
          <p className="text-[0.8125rem] text-[var(--ink-faint)]">
            O catálogo ainda está vazio.
          </p>
        ) : (
          <SkillsPanel staffId={member.id} groups={skills} />
        )}
      </Panel>

      {/* --- escala -------------------------------------------------- */}
      <Panel
        title="Escala"
        hint="Cada linha vale de uma data até outra. Mudar de escala é fechar a antiga com um último dia e abrir uma nova — nunca corrigir a que já correu."
        flush
      >
        {schedule.length > 0 ? (
          <div className="divide-y divide-[var(--line-soft)]">
            {schedule.map((row) => (
              <ScheduleLine
                key={row.id}
                staffId={member.id}
                row={row}
                today={todayIso}
              />
            ))}
          </div>
        ) : null}

        {mine.length > 0 ? (
          <div
            className={`bg-[var(--surface-2)] px-5 py-4 sm:px-6 ${
              schedule.length > 0 ? 'border-t border-[var(--line-soft)]' : ''
            }`}
          >
            <OpenScheduleForm
              staffId={member.id}
              units={options.filter((unit) => memberUnits.includes(unit.id))}
              today={todayIso}
            />
          </div>
        ) : (
          <p className="px-5 py-4 text-[0.8125rem] text-[var(--ink-faint)] sm:px-6">
            Primeiro a loja, depois a escala.
          </p>
        )}
      </Panel>

      {/* --- ausências ----------------------------------------------- */}
      <Panel
        title="Ausências"
        hint="Folga, férias, formação ou um bloqueio avulso. Fecha o horário, mas não desmarca ninguém: as marcações que já lá estiverem tratam-se na agenda."
        flush
      >
        <div className="px-5 py-5 sm:px-6">
          <AbsenceForm staffId={member.id} units={options} today={todayIso} />
        </div>

        {absences.length > 0 ? (
          <div className="divide-y divide-[var(--line-soft)] border-t border-[var(--line-soft)]">
            {absences.map((row) => {
              const timezone =
                (row.unit_id ? timezones.get(row.unit_id) : null) ??
                org.timezone
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 sm:px-6"
                >
                  <Badge className="w-24 justify-center">
                    {ABSENCE_LABEL[row.kind]}
                  </Badge>
                  <span className="tabular shrink-0 text-[0.8125rem] text-[var(--ink)]">
                    {formatDateTime(row.starts_at, timezone)} →{' '}
                    {formatDateTime(row.ends_at, timezone)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
                      {row.unit_name ?? 'Todas as lojas'}
                      {row.reason ? ` · ${row.reason}` : ''}
                      {row.author ? ` · ${row.author}` : ''}
                    </p>
                  </div>
                  <RemoveAbsence staffId={member.id} id={row.id} />
                </div>
              )
            })}
          </div>
        ) : (
          <p className="border-t border-[var(--line-soft)] px-5 py-3 text-[0.8125rem] text-[var(--ink-faint)] sm:px-6">
            Nada marcado. Quando faltar, diz-se aqui — e a agenda fecha
            sozinha.
          </p>
        )}
      </Panel>

      {/* --- entrada e saída ----------------------------------------- */}
      <Panel
        title="Entrada no sistema"
        hint="Entra com o telefone e a palavra-passe. Repô-la fecha todas as sessões abertas em nome dela."
      >
        <PasswordForm staffId={member.id} hasPassword={member.has_password} />
      </Panel>

      <Divider />

      <MemberExit staffId={member.id} isActive={member.is_active} />
    </div>
  )
}
