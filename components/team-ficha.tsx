'use client'

import { useActionState, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { Pencil } from 'lucide-react'
import {
  saveFichaAction,
  type TeamState,
} from '@/app/(desk)/admin/equipe/actions'
import { Field, Input, Select, Textarea } from '@/components/ui'
import { PhoneInput } from '@/components/phone-input'
import {
  formatMinutes,
  parseMinutes,
  WEEKDAY_NAMES_PT,
} from '@/lib/time'
import type { Level } from '@/lib/team'

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
// da casa.
const ORDER = [1, 2, 3, 4, 5, 6, 0]

const LEVEL_NAME: Record<Level, string> = {
  master: 'Sistema',
  owner: 'Dona',
  manager: 'Gerente',
  professional: 'Colaborador',
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

export type UnitOption = {
  id: string
  name: string
  /*
   * Os dias em que a casa abre (0 = domingo), para a escala poder
   * avisar quando um turno cai em porta fechada. Sem isto o editor
   * aceitava um domingo numa casa que fecha ao domingo, e o turno
   * ficava lá para sempre a não dar vaga nenhuma — foi o que
   * aconteceu, e só se viu meses depois no panorama da semana.
   */
  openWeekdays: number[]
}

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

/**
 * A SEMANA LIDA EM VOZ ALTA.
 *
 * Sete linhas de campos respondem «que horas faz à quarta?». Não
 * respondem «então ela faz as tardes e os fins-de-semana inteiros?» —
 * que é a pergunta que se faz ao sair desta página, e que obrigava a
 * ler as sete linhas uma a uma para a responder.
 *
 * Junta dias SEGUIDOS com o mesmo horário: três ou mais viram «de
 * segunda a sexta», dois viram «sábado e domingo», um fica sozinho. Os
 * dias em que não trabalha não se dizem — dizer o que não há é ruído
 * numa frase que já tem de caber numa linha.
 *
 * E NÃO CONTA HORAS. Contava — «55 h» ao lado da frase, «11 h» ao lado
 * de cada dia. Saíram as duas: era a mesma conta dita sete vezes, e no
 * telemóvel eram elas que não deixavam a linha do dia caber. A pergunta
 * que se faz nesta página não é «quantas horas faz» — é «que dias
 * faz», e isso a frase responde.
 */
function lerSemana(week: WeekSlot[]): string {
  const trocos: { dias: number[]; starts: string; ends: string }[] = []

  for (const weekday of ORDER) {
    const slot = week[weekday]
    if (!slot?.on) continue

    const ultimo = trocos[trocos.length - 1]
    // Só se junta ao troço anterior se ELE acabar no dia imediatamente
    // antes deste: uma segunda e uma quarta com o mesmo horário não são
    // «de segunda a quarta», e escrevê-lo assim era mentir.
    const seguido =
      ultimo &&
      ultimo.starts === slot.starts &&
      ultimo.ends === slot.ends &&
      ORDER.indexOf(ultimo.dias[ultimo.dias.length - 1] ?? -1) ===
        ORDER.indexOf(weekday) - 1
    if (seguido) ultimo.dias.push(weekday)
    else trocos.push({ dias: [weekday], starts: slot.starts, ends: slot.ends })
  }

  const nome = (weekday: number) =>
    (WEEKDAY_NAMES_PT[weekday] ?? '').toLowerCase()

  return trocos
    .map((troco) => {
      const primeiro = troco.dias[0] ?? 0
      const ultimo = troco.dias[troco.dias.length - 1] ?? 0
      const quais =
        troco.dias.length === 1
          ? nome(primeiro)
          : troco.dias.length === 2
            ? `${nome(primeiro)} e ${nome(ultimo)}`
            : `de ${nome(primeiro)} a ${nome(ultimo)}`
      return `${quais} das ${troco.starts} às ${troco.ends}`
    })
    .join(' · ')
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
  today,
  canGrantNetwork,
  canGrantMaster,
  self,
  aside,
}: {
  /** Nulo: é uma pessoa a nascer. */
  member: FichaMember | null
  units: UnitOption[]
  memberUnits: string[]
  roles: { role: Level; unitId: string | null }[]
  groups: SkillGroupView[]
  schedule: ScheduleSlice[]
  today: string
  canGrantNetwork: boolean
  /** Só de dentro do degrau se dá o degrau. */
  canGrantMaster: boolean
  /** A ficha de quem a está a abrir. O papel próprio não se mexe. */
  self?: boolean
  /**
   * O que vive dentro do cartão da escala mas grava na hora: ausências.
   *
   * As contagens vêm de fora porque quem as sabe é a página: aqui só
   * chega o pedaço de ecrã já montado. São elas que põem o «definida» e
   * o «nenhuma» à direita do título da secção, e poupam a linha que ia
   * dizer o mesmo por baixo.
   */
  aside?: {
    password?: React.ReactNode
    passwordMeta?: string
    shifts?: React.ReactNode
    shiftsMeta?: string
    absences?: React.ReactNode
    absencesMeta?: string
  }
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
  // Os dias em que ESTA casa abre — a escala mostra-se loja a loja.
  const abertura = useMemo(
    () => units.find((unit) => unit.id === weekUnit)?.openWeekdays ?? [],
    [units, weekUnit],
  )

  const [shown, setShown] = useState(weekUnit)
  /* Que dia esta aberto para edicao — so no telemovel; a partir do sm
     as caixas estao sempre a vista e isto nao pinta nada. */
  const [editar, setEditar] = useState<number | null>(null)
  const [from, setFrom] = useState(today)

  // Trocar de loja troca a semana à vista. Fazê-lo aqui, e não num
  // efeito, evita o piscar de uma semana errada antes da certa.
  if (shown !== weekUnit) {
    setShown(weekUnit)
    setWeek(base)
  }

  const weekChanged = !sameWeek(week, base)

  /*
    UM EIXO SÓ: A LOJA ESCOLHE-SE, E DEPOIS DIZ-SE SE TRABALHA LÁ.

    Havia dois comandos parecidos para coisas diferentes, e era isso que
    baralhava. As pastilhas «Valongo | Maia» não escolhiam qual se
    estava a ver — LIGAVAM E DESLIGAVAM a loja, e podiam estar as duas
    acesas. Por baixo delas havia uma segunda caixinha, escondida, que
    era essa sim a escolher qual a semana a editar, e que só aparecia
    quando a pessoa trabalhava em duas lojas.

    Agora a caixinha escolhe a loja — todas na lista, trabalhe lá ou
    não — e a pertença é uma caixa de verificação normal com o nome da
    loja escrito por extenso. Onde ela trabalha continua a ler-se de
    relance no cabeçalho da ficha, que já diz «Valongo · Maia».
  */
  const lojaActual = units.find((unit) => unit.id === weekUnit)
  const trabalhaAqui = mine.includes(weekUnit)
  const semana = lerSemana(week)

  // --- o que sabe fazer ----------------------------------------------
  const started = useMemo(() => {
    const set = new Set<string>()
    for (const group of groups) {
      for (const service of group.services) if (service.has) set.add(service.id)
    }
    return set
  }, [groups])

  const [skills, setSkills] = useState<Set<string>>(() => new Set(started))
  /*
    AS CATEGORIAS ABREM FECHADAS.

    Abriam as que já tinham algum serviço marcado — o que numa pessoa
    com trinta e cinco serviços é quase todas, e o cartão nascia com
    setenta linhas de vistos empilhados. A regra saía-lhe pela culatra:
    quanto mais completa a ficha, pior se lia.

    Fechadas, a linha de cada categoria diz o que interessa — «Cabelo,
    13 de 13» — e vê-se o preçário inteiro num ecrã. Quem quer mexer
    numa abre-a.

    A BUSCA CONTINUA A ABRIR SOZINHA o que der resultado (é o
    `Boolean(needle.trim())` mais abaixo), por isso procurar um serviço
    não esbarra nisto.
  */
  const [open, setOpen] = useState<string[]>([])
  const [needle, setNeedle] = useState('')

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
    /*
      ISTO DEIXA DE SER UM FORMULÁRIO À VOLTA DE TUDO.

      Era: um `<form>` abria antes do primeiro cartão e só fechava
      depois do último. E lá dentro, no cartão da escala, viviam mais
      três formulários — o do turno extra, o da ausência e o da
      palavra-passe. Um formulário dentro de outro não é HTML válido, e
      o resultado é o que se via: carregar em «Marcar turno» não fazia
      nada, sem erro nenhum, porque o formulário de dentro nunca chegou
      a existir como formulário.

      E NÃO PRECISAVA DE ENVOLVER NADA. Tudo o que esta ficha grava
      viaja em DOIS campos escondidos — o `staff` e o `ficha`, que é a
      ficha inteira num JSON. Os campos que se vêem no ecrã não são
      campos de formulário: são estado do React, e o botão de guardar
      lê-os desse estado, não do formulário.

      Então o `<form>` encolhe até ao que é: dois campos escondidos, ao
      fundo, invisível. O botão «Guardar» aponta-lhe com `form="ficha"`
      — é para isso que esse atributo existe — e os três formulários da
      direita deixam de estar dentro de coisa nenhuma.
    */
    <div className="space-y-4">
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

      {/*
        ---------- A pessoa ----------

        NOVE CAMPOS EM COLUNA NÃO SÃO UM CARTÃO, SÃO UM MURO.

        No monitor eram duas colunas e passavam despercebidos. No
        telemóvel colapsam para uma, e cada campo traz rótulo, caixa de
        44 px e uma dica de duas linhas: mil e sessenta píxeis — quase
        três ecrãs — antes de se chegar à escala, que é ao que se vem.

        E oito dos nove escrevem-se UMA VEZ NA VIDA. Ficam à vista os
        três que se mexem, e o resto dobra-se.

        «COLABORADOR», QUE É A PALAVRA DA CASA. Andava a dizer-se
        «profissional» em quase todo o balcão e «colaborador» em dois
        sítios — no encaixe e no seletor dos avisos. Ganhou o
        «colaborador», por escolha do dono, e passou a valer no balcão
        inteiro, incluindo o nome do PAPEL nesta mesma página. É por
        isso que o título e o papel dizem agora a mesma coisa: não é
        confusão, é a mesma palavra a nomear a mesma pessoa.
      */}
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

          <Field label="Telefone" htmlFor="f-phone">
            <PhoneInput
              id="f-phone"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              required
            />
          </Field>

          <Field
            label="Papel"
            htmlFor="f-level"
            hint={
              self
                ? 'O seu próprio papel não se muda aqui. Peça a outra pessoa.'
                : LEVEL_HINT[level]
            }
          >
            <Select
              id="f-level"
              value={level}
              disabled={self}
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

          {/*
            «ONDE MANDA» SÓ EXISTE PARA QUEM MANDA.

            Estava sempre lá, e desligado para toda a gente menos as
            gerentes — um comando morto a gastar uma fila e a fazer a
            pessoa perguntar-se porque é que não lhe pega. Fica ao pé
            do papel, que é quem o convoca, e some quando o papel muda.
          */}
          {level === 'manager' ? (
            <Field
              label="Onde manda"
              htmlFor="f-scope"
              hint="Sem loja, o papel vale a rede toda."
            >
              <Select
                id="f-scope"
                value={scope}
                disabled={self}
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
          ) : null}
        </div>

        {/*
          A DOBRA PERDE A LISTA DO QUE TEM DENTRO.

          Escrevi «— nome público, usuário, e-mail, cor, biografia» para
          ninguém abrir uma gaveta às cegas. Mas cinco palavras cinzentas
          por baixo de uma ligação pesam mais do que a gaveta que
          anunciam, e num telemóvel gastavam duas linhas para dizer o que
          um toque mostra. Fica a ligação e a seta.
        */}
        <details className="mt-4 border-t border-[var(--line-soft)] pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[0.8125rem] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] [&::-webkit-details-marker]:hidden">
            Mais detalhes
            <span aria-hidden className="text-[var(--ink-faint)]">
              ›
            </span>
          </summary>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
        </details>

        {/* A palavra-passe fica FORA da dobra: o aviso do topo da página
            manda cá quem não a tem, e o que se vem buscar não pode estar
            atrás de uma gaveta. */}
        {aside?.password ? (
          <Faixa title="Palavra-passe" meta={aside.passwordMeta}>
            {aside.password}
          </Faixa>
        ) : null}
      </Bloco>

      {/* ---------- Escala ---------- */}
      <Bloco title="Escala">
        <Field label="Loja" htmlFor="f-loja" className="max-w-[16rem]">
          <Select
            id="f-loja"
            value={weekUnit}
            onChange={(e) => setWeekUnit(e.target.value)}
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-4">
          <Caixa
            on={trabalhaAqui}
            onClick={() =>
              setMine((current) =>
                trabalhaAqui
                  ? current.filter((id) => id !== weekUnit)
                  : [...current, weekUnit],
              )
            }
            label={`Trabalha ${lojaActual?.name ? `em ${lojaActual.name}` : 'nesta loja'}`}
            hint="Sem isto não entra na agenda desta loja nem no funil."
          />
        </div>

        {!trabalhaAqui ? (
          <p className="mt-4 rounded-[var(--radius)] border border-dashed border-[var(--line)] px-4 py-5 text-center text-[0.8125rem] leading-relaxed text-[var(--ink-faint)]">
            Não trabalha {lojaActual?.name ? `em ${lojaActual.name}` : 'aqui'}.
            <br />
            Ligue a caixa acima para lhe dar uma semana nesta loja.
          </p>
        ) : (
          <Faixa title={`A semana em ${lojaActual?.name ?? ''}`}>
            {/*
              O RESUMO ANTES DAS LINHAS.

              É a resposta à pergunta que se faz ao sair desta página, e
              que as sete linhas de campos não davam sem se lerem uma a
              uma. Só texto: o total de horas ao lado estava escrito
              como a outra ponta de uma barra e, sem largura para as
              duas, trepava para o meio da frase.
            */}
            <p className="text-[0.8125rem] leading-relaxed text-[var(--ink-muted)] first-letter:uppercase">
              {semana || 'Sem nenhum dia ligado nesta loja.'}
            </p>

            <div>
              {ORDER.map((weekday) => {
                const slot = week[weekday]
                if (!slot) return null
                /*
                  Um turno em dia de porta fechada não dá vaga nenhuma —
                  nem no funil, nem ao balcão. Vale a pena existir (a
                  casa pode abrir só para uma noiva), mas tem de se ver
                  que é excepção, e não passar por engano de dedo.
                */
                const fechado =
                  slot.on && !abertura.includes(weekday)
                const nomeDia = WEEKDAY_NAMES_PT[weekday] ?? ''
                const aEditar = editar === weekday
                const mexer = (troca: Partial<WeekSlot>) =>
                  setWeek((current) =>
                    current.map((day, index) =>
                      index === weekday ? { ...day, ...troca } : day,
                    ),
                  )
                return (
                  /*
                    UMA CAIXA DE HORA NUNCA DIVIDE UMA LINHA COM OUTRA.

                    Tentei três vezes fazer caber as duas horas numa
                    linha de telemóvel: 92 píxeis, 112, «metade do que
                    houver». Ignoraram as três, e cheguei a escrever
                    aqui que a culpa era de uma largura mínima do
                    Safari. NÃO ERA. Era a caixa a somar o preenchimento
                    à largura em vez de o incluir nela — ver o
                    `box-border` no `ui.tsx`, que é onde isso ficou
                    resolvido para a casa toda.

                    O DESENHO FICA COMO ESTÁ, E POR MÉRITO PRÓPRIO. A
                    linha fechada ser só texto — o visto, o nome e
                    «09:00 → 20:00» — deixa ler a semana inteira de uma
                    vez sem tocar em nada, que é ao que se vem. E uma
                    caixa sozinha na linha continua a ser a forma que
                    não depende de medida nenhuma.

                    A PARTIR DO `sm` NADA DISTO ACONTECE: as duas caixas
                    ficam sempre abertas e lado a lado, como estavam,
                    porque lá há largura de sobra e um clique por dia
                    para editar uma semana seria trabalho a mais.
                  */
                  <div
                    key={weekday}
                    className="flex flex-col gap-2 border-b border-[var(--line-soft)] py-2 last:border-0 sm:grid sm:grid-cols-[7rem_1fr] sm:items-center sm:gap-x-3 sm:gap-y-1 sm:py-1.5"
                  >
                    <div className="flex items-center gap-2.5">
                      {/*
                        O VISTO É INDEPENDENTE E FICA DE FORA DO TOQUE
                        QUE ABRE. Desligar um dia é um gesto, mexer-lhe
                        nas horas é outro — e um botão dentro de outro
                        botão não é HTML válido nem coisa que se toque.
                      */}
                      <button
                        type="button"
                        onClick={() => {
                          mexer({ on: !slot.on })
                          // Ligar um dia é sempre para lhe dar horas.
                          setEditar(slot.on ? null : weekday)
                        }}
                        aria-pressed={slot.on}
                        aria-label={nomeDia}
                        /* A margem negativa devolve o que o
                           preenchimento tirou: o quadradinho fica no
                           mesmo sítio, mas o dedo tem 34 px para lhe
                           acertar em vez de 18. */
                        className="-m-2 shrink-0 p-2"
                      >
                        <span
                          aria-hidden
                          className={clsx(
                            'grid h-[1.1rem] w-[1.1rem] place-items-center rounded-[4px] border-[1.5px] text-[11px] font-bold transition-colors',
                            slot.on
                              ? 'border-[var(--action)] bg-[var(--action)] text-[var(--action-ink)]'
                              : 'border-[var(--line)] text-transparent',
                          )}
                        >
                          ✓
                        </span>
                      </button>

                      <span
                        className={clsx(
                          'text-sm font-semibold',
                          slot.on
                            ? 'text-[var(--ink)]'
                            : 'text-[var(--ink-muted)]',
                        )}
                      >
                        {nomeDia}
                      </span>

                      {/* O resumo e o lápis só existem no telemóvel: no
                          monitor as caixas estão sempre à vista. */}
                      {slot.on && !aEditar ? (
                        <button
                          type="button"
                          onClick={() => setEditar(weekday)}
                          className="ml-auto flex items-center gap-2 text-[var(--ink)] sm:hidden"
                        >
                          <span className="tabular text-sm">
                            {slot.starts}{' '}
                            <span className="text-[var(--ink-faint)]">→</span>{' '}
                            {slot.ends}
                          </span>
                          <Pencil className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
                        </button>
                      ) : null}

                      {!slot.on ? (
                        <span className="ml-auto text-[0.8125rem] text-[var(--ink-faint)] sm:hidden">
                          Não trabalha
                        </span>
                      ) : null}
                    </div>

                    {slot.on ? (
                      /*
                        ABERTO, ISTO É UM PAINEL — E TEM DE PARECER UM.

                        Estava a ser dois rótulos e duas caixas soltos
                        entre as linhas dos outros dias, sem princípio
                        nem fim: não se via onde é que aquilo começava,
                        nem a que dia pertencia. Ganha moldura e fundo.

                        A moldura é toda em `max-sm:` porque no monitor
                        isto não é um painel nenhum — é a segunda coluna
                        da linha, sempre à vista e sem caixa à volta.

                        E AS DUAS CAIXAS ENCHEM-NA. Cheguei a pôr-lhes
                        um tecto de onze rem para não parecerem grandes
                        de mais, e ficaram encostadas à esquerda de um
                        painel mais largo do que elas — que é pior do
                        que serem grandes. Dentro de uma moldura, uma
                        caixa que a enche está certa; uma que sobra pela
                        metade parece um erro. O painel também deixou de
                        levar recuo: alinha com as linhas dos outros
                        dias, e o que o prende ao dia é a moldura.
                      */
                      <div
                        className={clsx(
                          'flex flex-col gap-2 sm:flex-row sm:items-center',
                          'max-sm:gap-2.5 max-sm:rounded-[var(--radius)] max-sm:border max-sm:border-[color-mix(in_srgb,var(--accent)_28%,transparent)] max-sm:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] max-sm:p-3',
                          aEditar ? null : 'max-sm:hidden',
                        )}
                      >
                        <div className="sm:w-[7rem]">
                          <span className="mb-1 block text-[0.75rem] font-semibold text-[var(--ink-muted)] sm:hidden">
                            Entra
                          </span>
                          <Input
                            type="time"
                            value={slot.starts}
                            aria-label={`Entra — ${nomeDia}`}
                            onChange={(e) => mexer({ starts: e.target.value })}
                            className="tabular"
                          />
                        </div>
                        <span className="max-sm:hidden text-[var(--ink-faint)]">
                          →
                        </span>
                        <div className="sm:w-[7rem]">
                          <span className="mb-1 block text-[0.75rem] font-semibold text-[var(--ink-muted)] sm:hidden">
                            Sai
                          </span>
                          <Input
                            type="time"
                            value={slot.ends}
                            aria-label={`Sai — ${nomeDia}`}
                            onChange={(e) => mexer({ ends: e.target.value })}
                            className="tabular"
                          />
                        </div>
                        {/* Um botão, e não uma palavra azul solta: é o
                            que fecha o painel, e tem de se ver que se
                            carrega nele. */}
                        <button
                          type="button"
                          onClick={() => setEditar(null)}
                          className="self-start rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--accent)] sm:hidden"
                        >
                          Pronto
                        </button>
                      </div>
                    ) : (
                      <span className="max-sm:hidden text-[0.8125rem] text-[var(--ink-faint)] sm:pl-3">
                        Não trabalha
                      </span>
                    )}

                    {fechado ? (
                      <p className="text-[0.75rem] text-[var(--warn)] sm:col-start-2 sm:pl-3">
                        A casa fecha neste dia — este turno não vai dar
                        horas a ninguém.
                      </p>
                    ) : null}
                  </div>
                )
              })}
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

        {/*
          AS DUAS EXCEPÇÕES À SEMANA, LADO A LADO.

          O turno extra abre um dia que a semana não abria; a ausência
          fecha um que ela abria. São as duas metades do mesmo par, e
          por isso vivem no mesmo cartão, uma a seguir à outra — quem
          vem cá mexer numa costuma estar a pensar na outra.

          O extra vem primeiro porque é o que se marca a olhar para a
          frente; a ausência é quase sempre uma resposta a alguma coisa
          que aconteceu.
        */}
        {aside?.shifts ? (
          <Faixa title="Turnos extra" meta={aside.shiftsMeta}>
            {aside.shifts}
          </Faixa>
        ) : null}

        {aside?.absences ? (
          <Faixa title="Ausências" meta={aside.absencesMeta}>
            {aside.absences}
          </Faixa>
        ) : null}
      </Bloco>

      {/* ---------- Serviços ---------- */}
      <Bloco title="Serviços">
        <Input
          value={needle}
          onChange={(e) => setNeedle(e.target.value)}
          placeholder="Procurar serviço…"
          aria-label="Procurar serviço"
        />

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
          form="ficha"
          disabled={saving || Boolean(falta) || (!novo && dirty.length === 0)}
          className="h-10 rounded-[var(--radius)] bg-[var(--action)] px-5 text-[0.8125rem] font-bold text-[var(--action-ink)] transition-opacity disabled:opacity-40"
        >
          {saving ? 'A guardar…' : novo ? 'Criar ficha' : 'Guardar'}
        </button>
      </div>

      {/* O formulário, reduzido ao que ele é. Fica no fim e escondido:
          não empurra nada, e um `display:none` não impede um formulário
          de ser enviado nem os campos dele de viajarem. */}
      <form id="ficha" action={action} className="hidden">
        <input type="hidden" name="staff" value={member?.id ?? ''} />
        <input type="hidden" name="ficha" value={payload} />
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------
// As peças pequenas
// ---------------------------------------------------------------------

/*
  UM LIMITE POR CARTÃO, E NÃO DOIS.

  Tinha moldura E sombra. Duas maneiras de dizer «isto acaba aqui» ao
  mesmo tempo é o que faz um ecrã parecer barato: a moldura desenha uma
  caixa, a sombra levanta-a do papel, e as duas juntas anulam-se — fica
  a parecer um autocolante.

  Fica a sombra, mais funda e mais aberta do que a da casa, e o raio
  sobe de dez para doze. O cartão passa a assentar no papel em vez de
  estar recortado nele.
*/
function Bloco({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl bg-[var(--surface-raised)] shadow-[0_1px_1px_rgba(46,38,28,0.04),0_14px_34px_-26px_rgba(46,38,28,0.45)]">
      {/*
        O TÍTULO GANHA PESO, NÃO OURO.

        Cheguei a pôr-lhe um fio de ouro por baixo, como o do «Gestão».
        Está errado, e o próprio sistema o diz: o ouro do balcão é UM SÓ
        TRAÇO, por baixo do título da página, e é isso que o torna uma
        assinatura. Repetido em cada cartão, deixava de assinar nada.
      */}
      <h3 className="px-5 pt-4 text-[0.9375rem] font-bold tracking-[-0.01em] text-[var(--ink)] sm:px-6 sm:text-base">
        {title}
      </h3>
      <div className="px-5 pt-4 pb-5 sm:px-6">{children}</div>
    </section>
  )
}

/**
 * Uma divisória dentro do cartão: outro assunto, mesma conversa.
 *
 * O TÍTULO DEIXA DE SER UM VERSALETE CINZENTO. Estava a onze píxeis, em
 * maiúsculas espaçadas e no cinzento das legendas — lia-se DEPOIS do
 * que vinha por baixo dele, quando é ele que devia dizer o que aí vem.
 * Passa a treze, em maiúscula só na primeira letra e na tinta do texto.
 *
 * E QUANDO HÁ UM NÚMERO PARA DAR, ELE VAI À DIREITA: «nenhuma»,
 * «definida». O título passa a dizer duas coisas em vez de uma, e
 * poupa-se a linha que ia dizer a segunda.
 */
function Faixa({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <div className="-mx-5 mt-5 border-t border-[var(--line-soft)] px-5 pt-4 sm:-mx-6 sm:px-6">
      <div className="mb-3 flex items-baseline gap-3">
        <p className="text-[0.8125rem] font-bold text-[var(--ink)]">{title}</p>
        {meta ? (
          <p className="ml-auto text-[0.75rem] text-[var(--ink-faint)]">
            {meta}
          </p>
        ) : null}
      </div>
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
              ? 'border-[var(--action)] bg-[var(--action)] text-[var(--action-ink)]'
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
