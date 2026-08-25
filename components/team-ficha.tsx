'use client'

import { useActionState, useMemo, useState, useTransition } from 'react'
import { clsx } from 'clsx'
import {
  copySkillsAction,
  saveFichaAction,
  type TeamState,
} from '@/app/(desk)/admin/equipe/actions'
import { Field, Input, Select, Textarea } from '@/components/ui'
import { PhoneInput } from '@/components/phone-input'
import { formatMinutes, parseMinutes, WEEKDAY_NAMES_PT } from '@/lib/time'
import type { Level, SkillSource } from '@/lib/team'

/**
 * A FICHA DE UMA PESSOA — TRÊS CARTÕES E UM BOTÃO.
 *
 * O ecrã antigo tinha oito painéis e nove maneiras de guardar: o nome
 * tinha a sua, cada loja tinha a sua, cada habilidade gravava sozinha
 * ao ser tocada, e a escala pedia um dia de cada vez. Pôr uma manicure
 * a trabalhar custava vinte e duas idas ao servidor.
 *
 * A regra que passou a valer: CAMPOS GUARDAM-SE COM O BOTÃO,
 * ACONTECIMENTOS GRAVAM NA HORA. Nome, usuário, papel, lojas, escala e
 * habilidades são campos — mexe-se no que for preciso e grava-se uma
 * vez. Marcar uma ausência, definir uma palavra-passe ou marcar a saída
 * da equipa são acontecimentos, e esses continuam com acção própria:
 * não são um estado que se edita, é uma coisa que aconteceu.
 *
 * Este ficheiro serve as duas pontas — a ficha de quem já existe e o
 * ecrã de quem ainda não existe. É o mesmo ecrã: o segundo é o primeiro
 * por preencher.
 */

// A semana começa à segunda; domingo (0) fica para o fim, como no resto
// da casa (ver `hours-table`).
const ORDER = [1, 2, 3, 4, 5, 6, 0]

const LEVEL_NAME: Record<Level, string> = {
  master: 'Sistema',
  owner: 'Dona',
  manager: 'Gerente',
  professional: 'Profissional',
}

const LEVEL_HINT: Record<Level, string> = {
  master: 'Vê tudo, em todas as redes.',
  owner: 'Abre a rede inteira.',
  manager: 'Manda na loja do papel.',
  professional: 'Vê a agenda dela e mais nada.',
}

export type WeekSlot = { on: boolean; starts: string; ends: string }

export type FichaMember = {
  id: string
  name: string
  public_alias: string | null
  login: string | null
  phone: string
  email: string | null
  bio: string | null
  display_color: string
  accepts_online_booking: boolean
}

export type UnitOption = { id: string; name: string }

export type SkillGroupView = {
  category: string
  services: { id: string; name: string; has: boolean }[]
}

const EMPTY: TeamState = { error: null }

const NEW_MEMBER: FichaMember = {
  id: '',
  name: '',
  public_alias: null,
  login: null,
  phone: '',
  email: null,
  bio: null,
  display_color: '#C6A96B',
  accepts_online_booking: true,
}

function emptyWeek(): WeekSlot[] {
  return Array.from({ length: 7 }, () => ({
    on: false,
    starts: '09:00',
    ends: '18:00',
  }))
}

/** A semana que está em vigor numa loja, lida das vigências abertas. */
export type ScheduleSlice = {
  unit_id: string
  weekday: number
  starts_min: number
  ends_min: number
  is_current: boolean
}

function weekOf(rows: ScheduleSlice[], unitId: string): WeekSlot[] {
  const week = emptyWeek()
  for (const row of rows) {
    if (row.unit_id !== unitId) continue
    const slot = week[row.weekday]
    if (!slot) continue
    slot.on = true
    slot.starts = formatMinutes(row.starts_min)
    slot.ends = formatMinutes(row.ends_min)
  }
  return week
}

function sameWeek(a: WeekSlot[], b: WeekSlot[]): boolean {
  return a.every((slot, index) => {
    const other = b[index]
    if (!other) return false
    if (slot.on !== other.on) return false
    if (!slot.on) return true
    return slot.starts === other.starts && slot.ends === other.ends
  })
}

// ---------------------------------------------------------------------

export function Ficha({
  member,
  units,
  memberUnits,
  roles,
  groups,
  schedule,
  sources,
  today,
  canGrantNetwork,
  canGrantMaster,
  aside,
}: {
  /** Nulo: é uma pessoa a nascer. */
  member: FichaMember | null
  units: UnitOption[]
  memberUnits: string[]
  roles: { role: Level; unitId: string | null }[]
  groups: SkillGroupView[]
  schedule: ScheduleSlice[]
  sources: SkillSource[]
  today: string
  canGrantNetwork: boolean
  /** Só de dentro do degrau se dá o degrau. */
  canGrantMaster: boolean
  /** O que vive dentro do cartão da escala mas grava na hora: ausências. */
  aside?: { password?: React.ReactNode; absences?: React.ReactNode }
}) {
  const [state, action, saving] = useActionState<TeamState, FormData>(
    saveFichaAction,
    EMPTY,
  )

  const start = member ?? NEW_MEMBER
  const novo = member === null

  // --- o que a pessoa é ---------------------------------------------
  const [name, setName] = useState(start.name)
  const [alias, setAlias] = useState(start.public_alias ?? '')
  const [login, setLogin] = useState(start.login ?? '')
  const [phone, setPhone] = useState(start.phone)
  const [email, setEmail] = useState(start.email ?? '')
  const [bio, setBio] = useState(start.bio ?? '')
  const [colour, setColour] = useState(start.display_color)
  const [online, setOnline] = useState(start.accepts_online_booking)

  const first = roles[0]
  const [level, setLevel] = useState<Level>(first?.role ?? 'professional')
  const [scope, setScope] = useState(first?.unitId ?? '')
  // Papéis a mais do que o primeiro não se perdem por eu ter simplificado
  // o ecrã: viajam intactos e voltam para a base como estavam.
  const extras = useMemo(() => roles.slice(1), [roles])

  // --- onde põe os pés ----------------------------------------------
  const [mine, setMine] = useState<string[]>(memberUnits)

  // --- a semana ------------------------------------------------------
  const firstUnit = mine[0] ?? units[0]?.id ?? ''
  const [weekUnit, setWeekUnit] = useState(firstUnit)
  const base = useMemo(
    () => weekOf(schedule, weekUnit),
    [schedule, weekUnit],
  )
  const [week, setWeek] = useState<WeekSlot[]>(base)
  const [shown, setShown] = useState(weekUnit)
  const [from, setFrom] = useState(today)

  // Trocar de loja troca a semana à vista. Fazê-lo aqui, e não num
  // efeito, evita o piscar de uma semana errada antes da certa.
  if (shown !== weekUnit) {
    setShown(weekUnit)
    setWeek(base)
  }

  const weekChanged = !sameWeek(week, base)

  // --- o que sabe fazer ----------------------------------------------
  const started = useMemo(() => {
    const set = new Set<string>()
    for (const group of groups) {
      for (const service of group.services) if (service.has) set.add(service.id)
    }
    return set
  }, [groups])

  const [skills, setSkills] = useState<Set<string>>(() => new Set(started))
  const [open, setOpen] = useState<string[]>(() =>
    groups
      .filter((g) => g.services.some((s) => s.has))
      .map((g) => g.category),
  )
  const [needle, setNeedle] = useState('')
  const [copying, copy] = useTransition()

  const total = groups.reduce((sum, g) => sum + g.services.length, 0)

  function toggleSkill(id: string) {
    setSkills((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setGroup(group: SkillGroupView, on: boolean) {
    setSkills((current) => {
      const next = new Set(current)
      for (const service of group.services) {
        if (on) next.add(service.id)
        else next.delete(service.id)
      }
      return next
    })
  }

  // --- o que está por guardar ----------------------------------------
  const dirty: string[] = []
  if (
    name !== start.name ||
    alias !== (start.public_alias ?? '') ||
    login !== (start.login ?? '') ||
    phone !== start.phone ||
    email !== (start.email ?? '') ||
    bio !== (start.bio ?? '') ||
    colour !== start.display_color ||
    online !== start.accepts_online_booking
  ) {
    dirty.push('a ficha')
  }
  if (level !== (first?.role ?? 'professional') || scope !== (first?.unitId ?? '')) {
    dirty.push('o papel')
  }
  if (
    mine.length !== memberUnits.length ||
    mine.some((id) => !memberUnits.includes(id))
  ) {
    dirty.push('as lojas')
  }
  if (weekChanged) dirty.push('a escala')
  const moved =
    skills.size !== started.size ||
    [...skills].some((id) => !started.has(id))
  if (moved) {
    const diff = Math.abs(skills.size - started.size)
    dirty.push(diff === 1 ? '1 serviço' : `${diff || 'os'} serviços`)
  }

  const payload = JSON.stringify({
    member: {
      name,
      publicAlias: alias,
      login,
      phone,
      email,
      bio,
      displayColor: colour,
      acceptsOnline: online,
    },
    unitIds: mine,
    // Uma profissional não manda em loja nenhuma: o papel dela guarda-se
    // sempre sem unidade, mesmo que o campo tenha ficado com um valor
    // antigo por baixo do desactivado.
    roles: [
      {
        role: level,
        // Só a gerente se prende a uma loja. A base recusa o resto:
        // master e dona são sempre escopo rede, e uma profissional não
        // manda em sítio nenhum.
        unitId: level === 'manager' ? scope || null : null,
      },
      ...extras.map((r) => ({
        role: r.role,
        unitId: r.unitId,
      })),
    ],
    skillIds: [...skills],
    week:
      weekUnit && mine.includes(weekUnit) && (weekChanged || novo)
        ? {
            unitId: weekUnit,
            from,
            days: week.map((slot) => ({
              on: slot.on,
              startsMin: parseMinutes(slot.starts) ?? 0,
              endsMin: parseMinutes(slot.ends) ?? 0,
            })),
          }
        : null,
  })

  const falta = !name.trim()
    ? 'Falta o nome.'
    : !phone.trim()
      ? 'Falta o telemóvel.'
      : null

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="staff" value={member?.id ?? ''} />
      <input type="hidden" name="ficha" value={payload} />

      {state.error ? (
        <p className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-sm text-[var(--bad)]">
          {state.error}
        </p>
      ) : null}
      {state.done ? (
        <p className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,transparent)] px-3 py-2 text-sm text-[var(--ok)]">
          {state.done}
        </p>
      ) : null}

      {/* ---------- Colaborador ---------- */}
      <Bloco title="Colaborador">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="f-name">
            <Input
              id="f-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
          </Field>

          <Field
            label="Nome público"
            htmlFor="f-alias"
            hint="O que a cliente vê no site. Em branco, vê o nome de cima."
          >
            <Input
              id="f-alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={80}
              autoComplete="off"
            />
          </Field>

          {/* A ENTRADA E O TELEFONE SÃO COISAS DIFERENTES.
              O telefone é para falar com a pessoa — muda de operadora,
              muda de país. O usuário é dela e não muda. */}
          <Field
            label="Usuário"
            htmlFor="f-login"
            hint="Como entra no sistema. Deixe vazio para entrar pelo telefone."
          >
            <Input
              id="f-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              placeholder="ariadna"
            />
          </Field>

          <Field label="Telefone" htmlFor="f-phone">
            <PhoneInput
              id="f-phone"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              required
            />
          </Field>

          <Field label="Papel" htmlFor="f-level" hint={LEVEL_HINT[level]}>
            <Select
              id="f-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
            >
              {(['professional', 'manager', 'owner', 'master'] as Level[])
                .filter(
                  (l) =>
                    l !== 'master' || canGrantMaster || level === 'master',
                )
                .filter((l) => l !== 'owner' || canGrantNetwork)
                .map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_NAME[l]}
                  </option>
                ))}
            </Select>
          </Field>

          <Field
            label="Onde manda"
            htmlFor="f-scope"
            hint={
              level === 'professional'
                ? 'Uma profissional não manda em loja nenhuma.'
                : 'Sem loja, o papel vale a rede toda.'
            }
          >
            <Select
              id="f-scope"
              value={scope}
              disabled={level !== 'manager'}
              onChange={(e) => setScope(e.target.value)}
            >
              {canGrantNetwork ? <option value="">Rede toda</option> : null}
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="E-mail"
            htmlFor="f-email"
            hint="Opcional. Serve para recuperar a palavra-passe."
          >
            <Input
              id="f-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field
            label="Cor na agenda"
            htmlFor="f-colour"
            hint="É como se distingue à distância numa coluna cheia."
          >
            <input
              id="f-colour"
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-11 w-20 cursor-pointer rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-1 sm:h-10"
            />
          </Field>
        </div>

        <Faixa title="O que a cliente vê no site">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Uma linha ou duas. Fica visível à cliente."
          />
          <Caixa
            on={online}
            onClick={() => setOnline(!online)}
            label="Aceita marcação online"
            hint="Desligado, deixa de aparecer no funil público — mas continua a receber marcações feitas ao balcão."
          />
        </Faixa>

        {aside?.password ? (
          <Faixa title="Palavra-passe">{aside.password}</Faixa>
        ) : null}
      </Bloco>

      {/* ---------- Escala ---------- */}
      <Bloco title="Escala">
        <div className="flex flex-wrap gap-2">
          {units.map((unit) => {
            const on = mine.includes(unit.id)
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() =>
                  setMine((current) =>
                    on
                      ? current.filter((id) => id !== unit.id)
                      : [...current, unit.id],
                  )
                }
                className={clsx(
                  'rounded-full border px-3.5 py-1.5 text-[0.8125rem] transition-colors',
                  on
                    ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] font-semibold text-[var(--accent-strong)]'
                    : 'border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--ink-faint)]',
                )}
              >
                {on ? '✓ ' : ''}
                {unit.name}
              </button>
            )
          })}
        </div>

        {mine.length === 0 ? (
          <p className="mt-4 text-[0.8125rem] text-[var(--ink-faint)]">
            Primeiro a loja, depois a escala. Sem loja, não aparece em agenda
            nenhuma.
          </p>
        ) : (
          <Faixa
            title={
              mine.length > 1
                ? 'A semana'
                : `A semana em ${units.find((u) => u.id === weekUnit)?.name ?? ''}`
            }
          >
            {mine.length > 1 ? (
              <Select
                value={weekUnit}
                onChange={(e) => setWeekUnit(e.target.value)}
                className="mb-3 max-w-[16rem]"
              >
                {units
                  .filter((unit) => mine.includes(unit.id))
                  .map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
              </Select>
            ) : null}

            <div>
              {ORDER.map((weekday) => {
                const slot = week[weekday]
                if (!slot) return null
                return (
                  <div
                    key={weekday}
                    className="grid grid-cols-[7.5rem_1fr] items-center gap-3 border-b border-[var(--line-soft)] py-2 last:border-0"
                  >
                    <Caixa
                      on={slot.on}
                      onClick={() =>
                        setWeek((current) =>
                          current.map((day, index) =>
                            index === weekday ? { ...day, on: !day.on } : day,
                          ),
                        )
                      }
                      label={WEEKDAY_NAMES_PT[weekday] ?? ''}
                    />
                    {slot.on ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          value={slot.starts}
                          aria-label={`Entra — ${WEEKDAY_NAMES_PT[weekday]}`}
                          onChange={(e) =>
                            setWeek((current) =>
                              current.map((day, index) =>
                                index === weekday
                                  ? { ...day, starts: e.target.value }
                                  : day,
                              ),
                            )
                          }
                          className="tabular w-28"
                        />
                        <span className="text-[var(--ink-faint)]">→</span>
                        <Input
                          type="time"
                          value={slot.ends}
                          aria-label={`Sai — ${WEEKDAY_NAMES_PT[weekday]}`}
                          onChange={(e) =>
                            setWeek((current) =>
                              current.map((day, index) =>
                                index === weekday
                                  ? { ...day, ends: e.target.value }
                                  : day,
                              ),
                            )
                          }
                          className="tabular w-28"
                        />
                      </div>
                    ) : (
                      <span className="text-[0.8125rem] text-[var(--ink-faint)]">
                        Não trabalha
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setWeek((current) => {
                    const monday = current[1]
                    if (!monday) return current
                    return current.map((day, index) =>
                      index === 0 ? day : { ...monday },
                    )
                  })
                }
                className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink-muted)] hover:border-[var(--ink-faint)]"
              >
                Copiar segunda para os outros dias
              </button>
            </div>

            {/* UMA VIGÊNCIA NÃO SE CORRIGE. Mudar a semana fecha a que
                está em vigor na véspera e abre outra por cima — e é
                aqui que se diz a partir de quando. */}
            {weekChanged || novo ? (
              <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-4 py-3">
                <Field
                  label="A escala nova entra a partir de"
                  htmlFor="f-from"
                  className="w-44"
                >
                  <Input
                    id="f-from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="tabular"
                  />
                </Field>
                <p className="max-w-sm pb-2 text-[0.75rem] text-[var(--ink-muted)]">
                  A que está em vigor fecha na véspera. O que já correu fica
                  intacto — o passado da agenda tem de continuar a
                  explicar-se sozinho.
                </p>
              </div>
            ) : null}
          </Faixa>
        )}

        {aside?.absences ? (
          <Faixa title="Ausências">{aside.absences}</Faixa>
        ) : null}
      </Bloco>

      {/* ---------- Serviços ---------- */}
      <Bloco title="Serviços">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder="Procurar serviço…"
            className="min-w-48 flex-1"
            aria-label="Procurar serviço"
          />
          {sources.length > 0 ? (
            <Select
              value=""
              disabled={copying}
              aria-label="Copiar habilidades de outra pessoa"
              onChange={(e) => {
                const who = e.target.value
                if (!who) return
                e.target.value = ''
                copy(async () => {
                  const { ids } = await copySkillsAction(who)
                  setSkills(new Set(ids))
                  setOpen(
                    groups
                      .filter((g) => g.services.some((s) => ids.includes(s.id)))
                      .map((g) => g.category),
                  )
                })
              }}
              className="w-auto min-w-44"
            >
              <option value="">Copiar de…</option>
              {sources.map((who) => (
                <option key={who.id} value={who.id}>
                  {who.name} · {who.count} serviços
                  {who.top ? ` · ${who.top.toLowerCase()}` : ''}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <p className="pb-1 pt-3.5 text-[0.8125rem] text-[var(--ink-muted)]">
          Aparece em{' '}
          <strong className="font-semibold text-[var(--ink)]">
            {skills.size}
          </strong>{' '}
          {total === 1 ? 'do serviço' : `dos ${total} serviços`} do preçário.
        </p>

        {groups.length === 0 ? (
          <p className="text-[0.8125rem] text-[var(--ink-faint)]">
            O catálogo ainda está vazio.
          </p>
        ) : null}

        {groups.map((group) => {
          const matching = needle.trim()
            ? group.services.filter((service) =>
                service.name.toLowerCase().includes(needle.trim().toLowerCase()),
              )
            : group.services
          if (matching.length === 0) return null

          const marked = group.services.filter((s) => skills.has(s.id)).length
          const all = marked === group.services.length && marked > 0
          const expanded = open.includes(group.category) || Boolean(needle.trim())

          return (
            <div key={group.category}>
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-[var(--line-soft)] py-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setOpen((current) =>
                      current.includes(group.category)
                        ? current.filter((c) => c !== group.category)
                        : [...current, group.category],
                    )
                  }
                  className="flex items-center gap-2.5 text-left text-sm"
                >
                  <span className="text-[0.625rem] text-[var(--ink-faint)]">
                    {expanded ? '▾' : '▸'}
                  </span>
                  <span
                    className={clsx(
                      marked > 0
                        ? 'font-semibold text-[var(--ink)]'
                        : 'text-[var(--ink-muted)]',
                    )}
                  >
                    {group.category}
                  </span>
                </button>

                <span
                  className={clsx(
                    'tabular text-[0.75rem]',
                    marked > 0
                      ? 'font-bold text-[var(--accent)]'
                      : 'text-[var(--ink-faint)]',
                  )}
                >
                  {marked === 0
                    ? `nenhuma de ${group.services.length}`
                    : `${marked} de ${group.services.length}`}
                </span>

                <Tri
                  state={all ? 'full' : marked > 0 ? 'part' : 'none'}
                  onClick={() => setGroup(group, !all)}
                  label={`Marcar tudo em ${group.category}`}
                />
              </div>

              {expanded ? (
                <div className="grid gap-2 pb-4 pl-6 sm:grid-cols-2">
                  {matching.map((service) => (
                    <Caixa
                      key={service.id}
                      on={skills.has(service.id)}
                      onClick={() => toggleSkill(service.id)}
                      label={service.name}
                      small
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </Bloco>

      {/* ---------- a barra que guarda tudo ---------- */}
      <div
        className={clsx(
          'sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border bg-[var(--surface-raised)] px-4 py-3',
          dirty.length > 0
            ? 'border-[var(--accent)] shadow-[0_14px_32px_-18px_rgba(46,38,28,.5)]'
            : 'border-[var(--line)]',
        )}
      >
        <span
          className={clsx(
            'text-[0.8125rem]',
            falta
              ? 'font-semibold text-[var(--warn)]'
              : dirty.length > 0
                ? 'font-semibold text-[var(--accent-strong)]'
                : 'text-[var(--ink-faint)]',
          )}
        >
          {falta ??
            (dirty.length === 0
              ? novo
                ? 'Preencha o que souber.'
                : 'Nada por guardar.'
              : `${dirty.join(', ')} — por guardar.`)}
        </span>

        <button
          type="submit"
          disabled={saving || Boolean(falta) || (!novo && dirty.length === 0)}
          className="h-10 rounded-[var(--radius)] bg-[var(--accent)] px-5 text-[0.8125rem] font-bold text-[var(--accent-ink)] transition-opacity disabled:opacity-40"
        >
          {saving ? 'A guardar…' : novo ? 'Criar ficha' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// As peças pequenas
// ---------------------------------------------------------------------

function Bloco({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
      <h3 className="display px-5 pt-4 text-lg text-[var(--ink)] sm:px-6">
        {title}
      </h3>
      <div className="px-5 pb-5 pt-4 sm:px-6">{children}</div>
    </section>
  )
}

/** Uma divisória dentro do cartão: outro assunto, mesma conversa. */
function Faixa({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="-mx-5 mt-5 border-t border-[var(--line-soft)] px-5 pt-4 sm:-mx-6 sm:px-6">
      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.11em] text-[var(--ink-faint)]">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Caixa({
  on,
  onClick,
  label,
  hint,
  small,
}: {
  on: boolean
  onClick: () => void
  label: string
  hint?: string
  small?: boolean
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className="flex items-center gap-2.5 text-left"
      >
        <span
          aria-hidden
          className={clsx(
            'grid h-[1.1rem] w-[1.1rem] shrink-0 place-items-center rounded-[4px] border-[1.5px] text-[11px] font-bold transition-colors',
            on
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
              : 'border-[var(--line)] text-transparent',
          )}
        >
          ✓
        </span>
        <span
          className={clsx(
            small ? 'text-[0.8125rem]' : 'text-sm font-semibold',
            on ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]',
          )}
        >
          {label}
        </span>
      </button>
      {hint ? (
        <p className="ml-7 mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Cheia, meia ou vazia — a família inteira lê-se sem contar. */
function Tri({
  state,
  onClick,
  label,
}: {
  state: 'none' | 'part' | 'full'
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={clsx(
        'grid h-[1.2rem] w-[1.2rem] place-items-center rounded-[5px] border-[1.5px] text-[11px] font-bold transition-colors',
        state === 'full' &&
          'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]',
        state === 'part' &&
          'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] text-[var(--accent)]',
        state === 'none' && 'border-[var(--line)] text-transparent',
      )}
    >
      {state === 'part' ? '–' : '✓'}
    </button>
  )
}
