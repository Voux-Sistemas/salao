import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
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
import { Badge, Card, Divider, Notice } from '@/components/ui'

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

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/equipe"
          className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]"
        >
          <ArrowLeft size={14} />
          Equipa
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden
            className="h-7 w-1 rounded-[1px]"
            style={{ background: member.display_color }}
          />
          <h2 className="display text-xl text-[var(--ink)]">{member.name}</h2>
          {roles.map((role) => (
            <Badge key={role.id} tone={role.role === 'owner' ? 'accent' : 'neutral'}>
              {LEVEL_LABEL[role.role]}
              {role.unit_name ? ` · ${role.unit_name}` : ''}
            </Badge>
          ))}
          {member.is_active ? null : <Badge tone="bad">Saiu</Badge>}
        </div>
      </div>

      {member.has_password ? null : (
        <Notice tone="warn">
          Ainda não tem palavra-passe — e sem ela não entra no sistema.
        </Notice>
      )}
      {mine.length === 0 ? (
        <Notice tone="warn">
          Não atende em loja nenhuma. Enquanto assim for, não aparece em
          agenda nenhuma.
        </Notice>
      ) : null}
      {member.accepts_online_booking && skillCount === 0 ? (
        <Notice tone="warn">
          Aceita marcação online mas não tem habilidade nenhuma: no funil
          público não há serviço que a ofereça.
        </Notice>
      ) : null}
      {mine.length > 0 && schedule.length === 0 ? (
        <Notice tone="warn">
          Sem escala aberta. A loja pode estar de portas abertas — se ela não
          está escalada, não há horário para dar.
        </Notice>
      ) : null}

      <Card className="px-4 py-5 sm:px-6">
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
      </Card>

      {/* --- papéis -------------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Papéis</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Um papel guarda-se com uma loja. Sem loja associada significa a rede
          toda.
        </p>
        <Card className="px-4 py-5 sm:px-6">
          <RolesPanel
            staffId={member.id}
            roles={roles}
            units={options}
            canGrantNetwork={isOwner}
          />
        </Card>
      </section>

      {/* --- lojas --------------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Lojas onde atende</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Onde põe os pés — coisa diferente do papel. É daqui que a escala
          pode partir.
        </p>
        <Card className="px-4 py-5 sm:px-6">
          <MemberUnits
            staffId={member.id}
            units={options}
            current={memberUnits}
          />
        </Card>
      </section>

      {/* --- habilidades --------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Habilidades</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Quem não tem a habilidade nunca aparece como opção nesse serviço —
          nem no site, nem ao balcão.
        </p>
        {skills.length === 0 ? (
          <p className="text-[0.8125rem] text-[var(--ink-faint)]">
            O catálogo ainda está vazio.
          </p>
        ) : (
          <Card className="px-4 py-5 sm:px-6">
            <SkillsPanel staffId={member.id} groups={skills} />
          </Card>
        )}
      </section>

      {/* --- escala -------------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Escala</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Cada linha vale de uma data até outra. Mudar de escala é fechar a
          antiga com um último dia e abrir uma nova — nunca corrigir a que já
          correu.
        </p>

        {schedule.length > 0 ? (
          <Card className="mb-3 divide-y divide-[var(--line-soft)]">
            {schedule.map((row) => (
              <ScheduleLine
                key={row.id}
                staffId={member.id}
                row={row}
                today={todayIso}
              />
            ))}
          </Card>
        ) : null}

        {mine.length > 0 ? (
          <Card className="px-4 py-5 sm:px-6">
            <OpenScheduleForm
              staffId={member.id}
              units={options.filter((unit) => memberUnits.includes(unit.id))}
              today={todayIso}
            />
          </Card>
        ) : (
          <p className="text-[0.8125rem] text-[var(--ink-faint)]">
            Primeiro a loja, depois a escala.
          </p>
        )}
      </section>

      {/* --- ausências ----------------------------------------------- */}
      <section>
        <h3 className="eyebrow mb-1">Ausências</h3>
        <p className="mb-3 max-w-xl text-[0.8125rem] text-[var(--ink-muted)]">
          Folga, férias, formação ou um bloqueio avulso. Fecha o horário, mas
          não desmarca ninguém: as marcações que já lá estiverem tratam-se na
          agenda.
        </p>

        <Card className="mb-3 px-4 py-5 sm:px-6">
          <AbsenceForm
            staffId={member.id}
            units={options}
            today={todayIso}
          />
        </Card>

        {absences.length > 0 ? (
          <Card className="divide-y divide-[var(--line-soft)]">
            {absences.map((row) => {
              const timezone =
                (row.unit_id ? timezones.get(row.unit_id) : null) ??
                org.timezone
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                >
                  <Badge>{ABSENCE_LABEL[row.kind]}</Badge>
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
          </Card>
        ) : null}
      </section>

      <Divider />

      {/* --- entrada e saída ----------------------------------------- */}
      <section className="space-y-6">
        <div>
          <h3 className="eyebrow mb-3">Palavra-passe</h3>
          <PasswordForm
            staffId={member.id}
            hasPassword={member.has_password}
          />
        </div>

        <MemberExit staffId={member.id} isActive={member.is_active} />
      </section>
    </div>
  )
}
