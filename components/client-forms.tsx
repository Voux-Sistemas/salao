'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { FileUp, Trash2 } from 'lucide-react'
import {
  addNoteAction,
  previewImportAction,
  removeNoteAction,
  runImportAction,
  saveClientAction,
  type ClientState,
  type ImportState,
} from '@/app/(desk)/clientes/actions'
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui'
import { LANGUAGES, LANGUAGE_LABEL } from '@/lib/i18n/config'

const EMPTY: ClientState = { error: null, done: null }
const EMPTY_IMPORT: ImportState = { error: null }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {label}
    </Button>
  )
}

function Result({ state }: { state: { error: string | null; done?: string | null } }) {
  if (state.error) return <Notice tone="bad">{state.error}</Notice>
  if (state.done) return <Notice tone="ok">{state.done}</Notice>
  return null
}

export type Option = { id: string; name: string }

export type ClientDraft = {
  id?: string
  name?: string
  phone?: string
  email?: string | null
  language?: string
  birthdate?: string | null
  preferred_unit_id?: string | null
  preferred_staff_id?: string | null
  drink_preference?: string | null
  allergies?: string | null
  service_notes?: string | null
  tags?: string[]
}

/**
 * A FICHA. O telefone é a identidade — muda-se com cuidado, porque é
 * por ele que a cliente é a mesma pessoa nas duas lojas.
 *
 * As preferências não são enfeite: a bebida, a alergia e a nota do
 * serviço são o que faz a casa parecer que se lembra.
 */
export function ClientForm({
  client,
  units,
  staff,
  submitLabel = 'Guardar',
}: {
  client?: ClientDraft
  units: Option[]
  staff: Option[]
  submitLabel?: string
}) {
  const [state, action] = useActionState<ClientState, FormData>(
    saveClientAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-6">
      {client?.id ? <input type="hidden" name="id" value={client.id} /> : null}
      <Result state={state} />

      <section>
        <p className="eyebrow mb-3">Identidade</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="client-name">
            <Input
              id="client-name"
              name="name"
              required
              maxLength={120}
              autoComplete="off"
              defaultValue={client?.name ?? ''}
            />
          </Field>
          <Field
            label="Telefone"
            htmlFor="client-phone"
            hint="É a identidade da cliente e é único na rede."
          >
            <Input
              id="client-phone"
              name="phone"
              required
              inputMode="tel"
              autoComplete="off"
              placeholder="+351 912 345 678"
              defaultValue={client?.phone ?? ''}
              className="tabular"
            />
          </Field>
          <Field label="E-mail" htmlFor="client-email">
            <Input
              id="client-email"
              name="email"
              type="email"
              autoComplete="off"
              defaultValue={client?.email ?? ''}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Língua" htmlFor="client-language">
              <Select
                id="client-language"
                name="language"
                defaultValue={client?.language ?? 'pt'}
              >
                {LANGUAGES.map((value) => (
                  <option key={value} value={value}>
                    {LANGUAGE_LABEL[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nascimento" htmlFor="client-birthdate">
              <Input
                id="client-birthdate"
                name="birthdate"
                type="date"
                defaultValue={client?.birthdate ?? ''}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--line-soft)] pt-5">
        <p className="eyebrow mb-3">Como gosta de ser recebida</p>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Loja de preferência" htmlFor="client-unit">
              <Select
                id="client-unit"
                name="unit"
                defaultValue={client?.preferred_unit_id ?? ''}
              >
                <option value="">Sem preferência</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Profissional de preferência" htmlFor="client-staff">
              <Select
                id="client-staff"
                name="staff"
                defaultValue={client?.preferred_staff_id ?? ''}
              >
                <option value="">Sem preferência</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bebida" htmlFor="client-drink">
              <Input
                id="client-drink"
                name="drink"
                maxLength={80}
                autoComplete="off"
                placeholder="Chá verde, café sem açúcar…"
                defaultValue={client?.drink_preference ?? ''}
              />
            </Field>
            <Field
              label="Alergias"
              htmlFor="client-allergies"
              hint="Aparece a quem a atende."
            >
              <Input
                id="client-allergies"
                name="allergies"
                maxLength={160}
                autoComplete="off"
                defaultValue={client?.allergies ?? ''}
              />
            </Field>
          </div>

          <Field
            label="Nota do serviço"
            htmlFor="client-service-notes"
            hint="A cor, a fórmula, o que correu bem da última vez."
          >
            <Textarea
              id="client-service-notes"
              name="service_notes"
              maxLength={800}
              defaultValue={client?.service_notes ?? ''}
            />
          </Field>

          <Field
            label="Etiquetas"
            htmlFor="client-tags"
            hint="Separadas por vírgula. Servem para filtrar a lista."
          >
            <Input
              id="client-tags"
              name="tags"
              autoComplete="off"
              placeholder="vip, noiva, coloração"
              defaultValue={(client?.tags ?? []).join(', ')}
            />
          </Field>
        </div>
      </section>

      <Submit label={submitLabel} />
    </form>
  )
}

/* --- notas internas -------------------------------------------------- */

export function NoteForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState<ClientState, FormData>(
    addNoteAction,
    EMPTY,
  )

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="client" value={clientId} />
      <Result state={state} />
      <Textarea
        name="body"
        required
        maxLength={800}
        placeholder="O que a equipa precisa de saber e a cliente não vê."
        className="min-h-20"
      />
      <Submit label="Guardar nota" />
    </form>
  )
}

export function DeleteNote({
  clientId,
  noteId,
}: {
  clientId: string
  noteId: string
}) {
  const [, action] = useActionState<ClientState, FormData>(
    removeNoteAction,
    EMPTY,
  )

  return (
    <form action={action}>
      <input type="hidden" name="client" value={clientId} />
      <input type="hidden" name="note" value={noteId} />
      <button
        type="submit"
        aria-label="Apagar nota"
        className="text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
      >
        <Trash2 size={14} />
      </button>
    </form>
  )
}

/* --- importar -------------------------------------------------------- */

const VERDICT = {
  create: { label: 'Nova', colour: 'var(--ok)' },
  exists: { label: 'Já existe', colour: 'var(--ink-muted)' },
  repeated: { label: 'Repetida', colour: 'var(--warn)' },
  invalid: { label: 'Não dá', colour: 'var(--bad)' },
} as const

/**
 * O botão nativo de ficheiro é a única peça do sistema que o Chrome
 * desenha por nós — cinzento, arredondado, em inglês, e a dizer "No file
 * chosen" no meio de um ecrã que fala português. Esconde-se o campo e
 * põe-se uma zona própria por cima, que também diz que ficheiro ficou
 * escolhido: o nativo só o mostrava em letra de sistema.
 */
function CsvPicker() {
  const [chosen, setChosen] = useState<string | null>(null)

  return (
    <label className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed border-[var(--line)] bg-[var(--surface-2)] px-6 py-8 text-center transition-colors hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface-2))]">
      <input
        id="import-file"
        name="file"
        type="file"
        accept=".csv,text/csv,text/plain"
        className="sr-only"
        onChange={(event) =>
          setChosen(event.currentTarget.files?.[0]?.name ?? null)
        }
      />
      <FileUp
        size={20}
        aria-hidden
        className="text-[var(--ink-faint)] transition-colors group-hover:text-[var(--accent)]"
      />
      <span className="text-[0.875rem] text-[var(--ink)]">
        {chosen ?? 'Escolher o ficheiro'}
      </span>
      <span className="text-[0.75rem] text-[var(--ink-faint)]">
        {chosen ? 'Carregue outra vez para trocar' : 'CSV, até 512 KB'}
      </span>
    </label>
  )
}

/**
 * Importar em dois tempos: primeiro vê-se a conta feita, linha a linha,
 * e só depois é que se grava. Quem já cá está não é tocado.
 */
export function ImportForm() {
  const [preview, previewAction] = useActionState<ImportState, FormData>(
    previewImportAction,
    EMPTY_IMPORT,
  )
  const [saved, saveAction] = useActionState<ImportState, FormData>(
    runImportAction,
    EMPTY_IMPORT,
  )
  const [pasting, setPasting] = useState(false)

  const rows = preview.rows ?? []
  const done = Boolean(saved.done)

  return (
    <div className="space-y-6">
      <form action={previewAction} className="space-y-4">
        <Result state={preview} />

        {pasting ? (
          <Field
            label="Cole aqui o conteúdo"
            htmlFor="import-raw"
            hint="A primeira linha pode ser o cabeçalho: nome, telefone, email…"
          >
            <Textarea id="import-raw" name="raw" className="min-h-40 font-mono text-[0.75rem]" />
          </Field>
        ) : (
          <Field
            label="Ficheiro CSV"
            htmlFor="import-file"
            hint="Vírgula ou ponto-e-vírgula, até 512 KB. Colunas: nome, telefone, email, idioma, nascimento, bebida, alergias, notas, etiquetas."
          >
            <CsvPicker />
          </Field>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Submit label="Ver o que vai acontecer" />
          <Button
            type="button"
            variant="quiet"
            size="md"
            onClick={() => setPasting((value) => !value)}
          >
            {pasting ? 'Prefiro um ficheiro' : 'Prefiro colar o texto'}
          </Button>
        </div>
      </form>

      {rows.length > 0 && !done ? (
        <div className="space-y-4 border-t border-[var(--line-soft)] pt-5">
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">
            {preview.toCreate === 0
              ? 'Não há nada de novo neste ficheiro.'
              : `${preview.toCreate} ficha${preview.toCreate === 1 ? '' : 's'} por criar, em ${rows.length} linha${rows.length === 1 ? '' : 's'} lidas.`}
            {preview.truncated ? ' O ficheiro é grande; lêem-se as primeiras 2000 linhas.' : ''}
          </p>

          <div className="max-h-96 overflow-auto rounded-[var(--radius)] border border-[var(--line-soft)]">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="text-left text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                  <th className="px-3 py-2 font-normal">Linha</th>
                  <th className="px-3 py-2 font-normal">Nome</th>
                  <th className="px-3 py-2 font-normal">Telefone</th>
                  <th className="px-3 py-2 font-normal">O que acontece</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-soft)]">
                {rows.map((row) => (
                  <tr key={row.line}>
                    <td className="tabular px-3 py-1.5 text-[var(--ink-faint)]">
                      {row.line}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--ink)]">
                      {row.name || '—'}
                    </td>
                    <td className="tabular px-3 py-1.5 text-[var(--ink-muted)]">
                      {row.phone || '—'}
                    </td>
                    <td className="px-3 py-1.5">
                      <span style={{ color: VERDICT[row.verdict].colour }}>
                        {VERDICT[row.verdict].label}
                      </span>
                      {row.problem ? (
                        <span className="text-[0.75rem] text-[var(--ink-faint)]">
                          {' '}
                          {row.problem}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.toCreate && preview.toCreate > 0 ? (
            <form action={saveAction}>
              <input type="hidden" name="raw" value={preview.raw ?? ''} />
              <Submit label={`Importar ${preview.toCreate}`} />
            </form>
          ) : null}
        </div>
      ) : null}

      <Result state={saved} />
    </div>
  )
}
