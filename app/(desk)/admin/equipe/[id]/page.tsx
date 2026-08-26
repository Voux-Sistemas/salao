import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { can, requireManagement, unitsFor } from '@/lib/auth/actor'
import { requireOrg } from '@/lib/org'
import { ABSENCE_LABEL, LEVEL_LABEL } from '@/lib/status'
import {
  getMember,
  listAbsences,
  listMemberUnits,
  listRoles,
  listSchedule,
  listSkills,
  listSkillSources,
} from '@/lib/team'
import { formatDateTime, today } from '@/lib/time'
import { openWeekdaysFor } from '@/lib/hours'
import {
  AbsenceForm,
  MemberExit,
  PasswordForm,
  RemoveAbsence,
} from '@/components/team-forms'
import { Ficha } from '@/components/team-ficha'
import { BackLink } from '@/components/gestao-panel'
import { Badge, Divider } from '@/components/ui'
import { formatPhone } from '@/lib/text'

export const metadata: Metadata = { title: 'Ficha' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * UMA PESSOA POR DENTRO — TRÊS CARTÕES.
 *
 * Colaborador, escala e serviços. Os oito painéis de antes eram oito
 * assuntos e nove botões de guardar; isto são três assuntos e um.
 *
 * A escala continua a ser o único sítio do sistema onde uma linha se
 * fecha em vez de se corrigir: mudar as horas de uma vigência que já
 * correu mudaria o passado da agenda. A diferença é que agora essa
 * regra é trabalho do servidor, não de quem preenche.
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

  const [units, roles, memberUnits, skills, schedule, absences, sources] =
    await Promise.all([
      unitsFor(actor),
      listRoles(member.id),
      listMemberUnits(member.id),
      listSkills(actor.orgId, member.id),
      listSchedule(member.id, todayIso),
      listAbsences(member.id),
      listSkillSources(actor, member.id),
    ])

  // A escala precisa de saber quando a casa abre, para avisar de um
  // turno em dia de porta fechada.
  const abertura = await openWeekdaysFor(units.map((unit) => unit.id))
  const options = units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    openWeekdays: abertura.get(unit.id) ?? [],
  }))
  const timezones = new Map(units.map((unit) => [unit.id, unit.timezone]))

  const skillCount = skills.reduce(
    (total, group) => total + group.services.filter((s) => s.has).length,
    0,
  )
  const mine = memberUnits.filter((unitId) => timezones.has(unitId))
  const current = schedule.filter((row) => row.is_current)

  /*
   * OS AVISOS CABEM NUMA LINHA.
   *
   * Eram três faixas empilhadas, cada uma do tamanho de um parágrafo, a
   * empurrar a ficha para fora do ecrã antes de se chegar ao primeiro
   * campo. O que uma pessoa precisa de saber é o que falta — e isso
   * escreve-se em cinco palavras.
   */
  const gaps: string[] = []
  if (!member.has_password) gaps.push('palavra-passe')
  if (mine.length === 0) gaps.push('loja')
  else if (current.length === 0) gaps.push('escala')
  if (member.accepts_online_booking && skillCount === 0) gaps.push('serviços')

  const resumo = [
    mine.length > 0
      ? options
          .filter((unit) => mine.includes(unit.id))
          .map((unit) => unit.name)
          .join(' · ')
      : null,
    skillCount > 0
      ? `${skillCount} ${skillCount === 1 ? 'serviço' : 'serviços'}`
      : null,
  ].filter(Boolean)

  return (
    <div className="max-w-3xl space-y-5">
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

        {resumo.length > 0 ? (
          <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
            {resumo.join(' · ')}
          </p>
        ) : null}

        {gaps.length > 0 ? (
          <p className="mt-3 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3 py-2 text-[0.8125rem] text-[var(--warn)]">
            Falta {gaps.join(', ')} — e sem isso não entra na agenda nem no
            funil.
          </p>
        ) : null}
      </div>

      <Ficha
        member={{
          id: member.id,
          name: member.name,
          public_alias: member.public_alias,
          login: member.login,
          phone: member.phone,
          email: member.email,
          bio: member.bio,
          display_color: member.display_color,
          accepts_online_booking: member.accepts_online_booking,
        }}
        units={options}
        memberUnits={memberUnits}
        roles={roles.map((role) => ({ role: role.role, unitId: role.unit_id }))}
        groups={skills}
        schedule={current.map((row) => ({
          unit_id: row.unit_id,
          weekday: row.weekday,
          starts_min: row.starts_min,
          ends_min: row.ends_min,
          is_current: row.is_current,
        }))}
        sources={sources}
        today={todayIso}
        canGrantNetwork={actor.orgScope && actor.role !== 'manager'}
        canGrantMaster={can.manageMasters(actor)}
        self={member.id === actor.id}
        aside={{
          /* Acontecimentos, não campos: gravam na hora. */
          password: (
            <PasswordForm
              staffId={member.id}
              hasPassword={member.has_password}
            />
          ),
          absences: (
            <div className="space-y-3">
              <AbsenceForm
                staffId={member.id}
                units={options}
                today={todayIso}
              />
              {absences.length > 0 ? (
                <div className="divide-y divide-[var(--line-soft)] border-t border-[var(--line-soft)]">
                  {absences.map((row) => {
                    const timezone =
                      (row.unit_id ? timezones.get(row.unit_id) : null) ??
                      org.timezone
                    return (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
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
                          </p>
                        </div>
                        <RemoveAbsence staffId={member.id} id={row.id} />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[0.75rem] text-[var(--ink-faint)]">
                  Nada marcado. Fecha o horário, mas não desmarca ninguém —
                  isso trata-se na agenda.
                </p>
              )}
            </div>
          ),
        }}
      />

      <Divider />

      <MemberExit staffId={member.id} isActive={member.is_active} />
    </div>
  )
}
