'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Card, Input } from '@/components/ui'
import { formatPhone, searchKey } from '@/lib/text'

/**
 * A FICHA ENCONTRA-SE ENQUANTO SE ESCREVE — SEM IR AO SERVIDOR.
 *
 * A procura de cliente era um formulário: escrever, carregar em
 * «Procurar», esperar a viagem até à base de dados, e só então ver a
 * lista. Entre esta página e a base há um oceano — cada procura eram
 * segundos, e quem está a passar o livro de papel faz isto dezenas de
 * vezes seguidas.
 *
 * Agora as fichas vêm todas com a página, como o catálogo de serviços
 * já vinha, e a peneira corre no navegador a cada letra. Tocar numa
 * ficha é seguir uma LIGAÇÃO já feita do lado do servidor — o carrinho,
 * o dia e a hora vão lá dentro, e o retrocesso do navegador continua a
 * funcionar como no resto da casa.
 *
 * Procura-se sem acentos e sem maiúsculas, e o telefone procura-se
 * pelos algarismos: «934» encontra «+351 934 189 475».
 */

export type PickerClient = {
  id: string
  name: string
  phone: string
  visits: number
}

/** Quantas fichas se mostram de cada vez. Mais do que isto é rolar às
    cegas — escreve-se mais uma letra e a lista encolhe sozinha. */
const SHOWN = 8

export function ClientPicker({
  clients,
  hrefTemplate,
}: {
  clients: PickerClient[]
  /** O endereço de escolher, com `__ID__` no lugar da ficha. */
  hrefTemplate: string
}) {
  const [term, setTerm] = useState('')
  const box = useRef<HTMLInputElement>(null)

  const chave = searchKey(term.trim())
  const digits = term.replace(/\D/g, '')

  const matches = useMemo(() => {
    if (!chave) return clients
    return clients.filter(
      (client) =>
        searchKey(client.name).includes(chave) ||
        (digits.length >= 3 &&
          client.phone.replace(/\D/g, '').includes(digits)),
    )
  }, [clients, chave, digits])

  const shown = matches.slice(0, SHOWN)
  const hidden = matches.length - shown.length

  return (
    <div className="space-y-2.5">
      <div className="relative max-w-xs">
        <Input
          ref={box}
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setTerm('')
          }}
          placeholder="Nome ou telefone"
          aria-label="Procurar a ficha da cliente"
          autoComplete="off"
          className="pr-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {term ? (
          <button
            type="button"
            aria-label="Limpar a procura"
            onClick={() => {
              setTerm('')
              box.current?.focus()
            }}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--accent)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">
          Nenhuma ficha com isso. Se é cliente nova, escreva o nome e o
          telefone aqui em baixo — a ficha nasce ao marcar.
        </p>
      ) : (
        <Card className="divide-y divide-[var(--line-soft)]">
          {shown.map((client) => (
            <Link
              key={client.id}
              href={hrefTemplate.replace('__ID__', client.id)}
              scroll={false}
              className="flex items-baseline justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-[var(--ink)]">
                  {client.name}
                </span>
                <span className="tabular block text-[0.75rem] text-[var(--ink-muted)]">
                  {formatPhone(client.phone)}
                </span>
              </span>
              <span className="shrink-0 text-[0.75rem] text-[var(--ink-faint)]">
                {client.visits} {client.visits === 1 ? 'visita' : 'visitas'}
              </span>
            </Link>
          ))}
        </Card>
      )}

      {hidden > 0 ? (
        <p className="tabular text-[0.6875rem] text-[var(--ink-faint)]">
          {chave
            ? `+ ${hidden} ${hidden === 1 ? 'ficha' : 'fichas'} — escreva mais para afinar.`
            : `${clients.length} fichas ao todo — escreva para procurar.`}
        </p>
      ) : null}
    </div>
  )
}
