'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import {
  procurarAction,
  type ProcurarState,
} from '@/app/(public)/remarcar/actions'
import { guardarChaves } from '@/lib/marcacoes-guardadas'
import type { ResumoMarcacao } from '@/lib/minhas-marcacoes'
import { PhoneInput } from '@/components/phone-input'
import { Button, Field, Input, Notice, buttonClass } from '@/components/ui'

/**
 * GUARDA A MARCAÇÃO NO TELEMÓVEL, NO RECIBO.
 *
 * Não desenha nada. Corre depois de a marcação estar gravada e de o
 * recibo estar à vista — nunca dentro da acção de marcar, que não aguenta
 * nada em cima dela.
 */
export function GuardarNoTelemovel({ chave }: { chave: string | null }) {
  useEffect(() => {
    if (chave) guardarChaves([chave])
  }, [chave])
  return null
}

/** A lista, igual nos dois caminhos: pelo telemóvel e pelo nome. */
export function ListaMarcacoes({
  marcacoes,
  label,
}: {
  marcacoes: readonly ResumoMarcacao[]
  label: string
}) {
  return (
    <ul className="space-y-3">
      {marcacoes.map((m) => (
        <li
          key={m.chave}
          className="border border-[var(--line)] bg-[var(--surface-raised)] px-5 py-4"
        >
          <p className="tabular text-[0.9375rem] font-semibold text-[var(--ink)]">
            {m.quando}
          </p>
          <p className="mt-0.5 text-[0.875rem] text-[var(--ink-muted)]">{m.servicos}</p>
          <p className="text-[0.75rem] text-[var(--ink-faint)]">{m.loja}</p>
          <Link
            href={`/m/${m.chave}`}
            className={buttonClass('primary', 'sm', 'mt-3')}
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export type ProcurarLabels = {
  phone: string
  phoneHint: string
  nome: string
  submit: string
  change: string
}

const VAZIO: ProcurarState = { error: null, marcacoes: null }

/** Noutro telemóvel: telemóvel + primeiro nome, sem código. */
export function ProcurarMarcacoes({ labels }: { labels: ProcurarLabels }) {
  const [state, action] = useActionState<ProcurarState, FormData>(
    procurarAction,
    VAZIO,
  )

  // O que se encontrou fica guardado neste telemóvel: da próxima vez, a
  // lista aparece sozinha e ela já não escreve nada.
  useEffect(() => {
    if (state.marcacoes?.length) {
      guardarChaves(state.marcacoes.map((m) => m.chave))
    }
  }, [state.marcacoes])

  if (state.marcacoes?.length) {
    return <ListaMarcacoes marcacoes={state.marcacoes} label={labels.change} />
  }

  return (
    <form action={action} className="space-y-5">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}

      <Field label={labels.phone} htmlFor="phone" hint={labels.phoneHint}>
        <PhoneInput id="phone" name="phone" required />
      </Field>

      <Field label={labels.nome} htmlFor="nome">
        <Input id="nome" name="nome" required autoComplete="given-name" />
      </Field>

      <Submit label={labels.submit} />
    </form>
  )
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {label}
    </Button>
  )
}
