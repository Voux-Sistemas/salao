'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import clsx from 'clsx'
import { Plus, X } from 'lucide-react'
import { Badge, Input } from '@/components/ui'
import { searchKey } from '@/lib/text'

/**
 * O CATÁLOGO DO BALCÃO, COM UMA PENEIRA.
 *
 * São umas dezenas de serviços em sete categorias. Quem marca uma
 * visita de cada vez desce a lista e encontra; quem está a passar o
 * livro de papel todo para o sistema faz isto centenas de vezes num
 * dia, e cada descida da lista é um punhado de segundos que se
 * multiplica.
 *
 * Por isso a peneira é aqui, no navegador, e não uma pergunta à base de
 * dados: entre esta página e a base há um oceano, e uma resposta que
 * demora um décimo de segundo por cada letra escrita não é uma peneira,
 * é uma espera. As linhas já vêm todas — umas dezenas cabem numa
 * página sem se dar por elas.
 *
 * Não esconde nada para sempre: apagar o que se escreveu devolve a
 * lista inteira, e o botão de juntar continua a ser uma LIGAÇÃO — o
 * endereço vem já feito do servidor, com o carrinho lá dentro, e o
 * retrocesso do navegador continua a funcionar como no resto da casa.
 *
 * O texto procura-se sem acentos e sem maiúsculas, porque ninguém
 * escreve «Coloração» com o cedilha certo quando tem o telefone na
 * outra mão. A categoria também conta: escrever «barbearia» traz a
 * categoria inteira.
 */

export type PickerService = {
  id: string
  name: string
  /** "45 min · 25,00 €", já composto do lado do servidor. */
  meta: string
  onlyDesk: boolean
  /** Endereço de juntar à visita. Nulo quando já lá está, ou está cheio. */
  href: string | null
  state: 'free' | 'chosen' | 'full'
}

export type PickerCategory = { id: string; name: string; services: PickerService[] }

export function DeskServicePicker({
  categories,
  total,
}: {
  categories: PickerCategory[]
  total: number
}) {
  const router = useRouter()
  const [term, setTerm] = useState('')
  const box = useRef<HTMLInputElement>(null)

  const chave = searchKey(term.trim())

  const visible = useMemo(() => {
    if (!chave) return categories
    return categories
      .map((category) => {
        // Uma categoria que dá o nome fica inteira: quem escreve
        // «barbearia» quer ver a barbearia toda, não um corte dela.
        if (searchKey(category.name).includes(chave)) return category
        const services = category.services.filter((service) =>
          searchKey(service.name).includes(chave),
        )
        return services.length > 0 ? { ...category, services } : null
      })
      .filter((category): category is PickerCategory => category !== null)
  }, [categories, chave])

  const shown = visible.reduce((sum, c) => sum + c.services.length, 0)

  // Com um só à vista, o Enter junta-o. É o atalho de quem já sabe o
  // nome do serviço e escreve três letras para lá chegar.
  const only = shown === 1 ? visible[0]?.services[0] : undefined

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Input
            ref={box}
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setTerm('')
                return
              }
              if (event.key === 'Enter' && only?.href) {
                event.preventDefault()
                setTerm('')
                router.push(only.href)
              }
            }}
            placeholder="Procurar serviço"
            aria-label="Procurar serviço"
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
        <p className="tabular shrink-0 text-[0.75rem] text-[var(--ink-faint)]">
          {chave ? `${shown} de ${total}` : `${total} serviços`}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-[0.8125rem] text-[var(--ink-muted)]">
          Nenhum serviço com isso. Apague para ver a lista toda.
        </p>
      ) : (
        <div className="space-y-7">
          {visible.map((category) => (
            <div key={category.id}>
              <div className="flex items-center gap-3">
                <h3 className="display text-base text-[var(--ink)]">
                  {category.name}
                </h3>
                <span
                  className="h-px flex-1 bg-[var(--line-soft)]"
                  aria-hidden
                />
                <span className="text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                  {category.services.length}
                </span>
              </div>
              <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {category.services.map((service) => (
                  <li
                    key={service.id}
                    className={clsx(
                      'flex items-center gap-3 rounded-[var(--radius)] border px-3 py-2.5 transition-colors',
                      service.state === 'chosen'
                        ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]'
                        : 'border-[var(--line-soft)] bg-[var(--surface-raised)]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--ink)]">
                        {service.name}
                        {service.onlyDesk ? (
                          <span className="ml-2 align-middle">
                            <Badge>Só ao balcão</Badge>
                          </span>
                        ) : null}
                      </p>
                      <p className="tabular text-[0.75rem] text-[var(--ink-faint)]">
                        {service.meta}
                      </p>
                    </div>
                    {service.href === null ? (
                      <span
                        className={clsx(
                          'shrink-0 text-[0.625rem] uppercase tracking-[0.05em]',
                          service.state === 'chosen'
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--ink-faint)]',
                        )}
                      >
                        {service.state === 'chosen' ? 'Na visita' : 'Cheio'}
                      </span>
                    ) : (
                      <Link
                        href={service.href}
                        aria-label={`Juntar ${service.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center border border-[var(--line)] text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
