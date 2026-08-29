'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import {
  novasMarcacoes,
  type NovaMarcacao,
} from '@/app/(desk)/agenda/actions'
import { IconBell, IconClose } from '@/components/desk-icons'
import { SOURCE_LABEL } from '@/lib/status'

/** De meio em meio minuto. Uma marcação não é uma corrida. */
const INTERVALO = 30_000

/** Quanto tempo o cartão fica em grande antes de encolher para a fita. */
const GRANDE = 12_000

/**
 * O QUE ENTROU DESDE QUE ESTA PÁGINA ABRIU.
 *
 * Uma marcação feita pelo site cai na agenda sem ninguém dar por ela: a
 * página do balcão foi desenhada de manhã e nunca mais olhou para a
 * base. Quem está ao balcão descobria a marcação quando a cliente
 * chegava à porta.
 *
 * VIVE NA MOLDURA DO BALCÃO, não numa página: quem está ao balcão anda
 * entre a agenda, a caixa e as fichas o dia inteiro, e o aviso tem de o
 * seguir. Por estar no chrome, sobrevive à navegação — o relógio conta
 * desde que a sessão abriu, não desde a última página.
 *
 * DUAS CARAS PARA O MESMO AVISO. Ao chegar, um cartão no canto com o
 * nome de quem marcou, o dia, a hora e com quem — é o que se quer
 * quando o balcão está parado. Doze segundos depois encolhe para uma
 * fita fina debaixo da barra de cima, e fica lá até alguém a ver ou a
 * dispensar — é o que se quer quando há uma cliente à frente. O susto
 * dura o tempo de se olhar; o recado fica.
 *
 * O QUE FALHA NÃO PARTE NADA: se a pergunta ao servidor der erro, o
 * componente cala-se e tenta outra vez daí a meio minuto. Um aviso é a
 * última coisa que pode derrubar a página de quem está a trabalhar.
 */
export function NovasMarcacoes() {
  /*
    O relógio arranca uma vez, na primeira pintura do lado do cliente, e
    nunca mais mexe. `useState` com função em vez de `new Date()` solto:
    assim não nasce uma data nova a cada repintura, e o «desde» não anda
    para a frente sozinho a comer os avisos.
  */
  const [desde] = useState(() => new Date().toISOString())
  const [novas, setNovas] = useState<NovaMarcacao[]>([])
  const [dispensadas, setDispensadas] = useState<string[]>([])
  const [encolhido, setEncolhido] = useState(false)

  useEffect(() => {
    let vivo = true

    const perguntar = async () => {
      try {
        const linhas = await novasMarcacoes(desde)
        if (vivo) setNovas(linhas)
      } catch {
        // Silêncio de propósito: ver o comentário de cima.
      }
    }

    perguntar()
    const relogio = setInterval(perguntar, INTERVALO)
    return () => {
      vivo = false
      clearInterval(relogio)
    }
  }, [desde])

  const porVer = novas.filter((n) => !dispensadas.includes(n.id))
  const primeira = porVer[0]

  // Cada chegada nova volta a abrir o cartão, e o relógio recomeça.
  useEffect(() => {
    if (!primeira) return
    setEncolhido(false)
    const t = setTimeout(() => setEncolhido(true), GRANDE)
    return () => clearTimeout(t)
  }, [primeira?.id])

  if (!primeira) return null

  const dispensar = () => setDispensadas(novas.map((n) => n.id))
  const href = `/agenda/${primeira.unit_slug}?d=${primeira.day}&m=${primeira.id}`
  const outras = porVer.length - 1

  /*
    A FITA. Debaixo da barra da casa (3.5rem) e à direita da coluna do
    monitor (4.5rem), para não ficar por cima de nenhuma das duas. Por
    baixo delas no empilhamento: aquelas são a casa, isto é um recado.
  */
  if (encolhido) {
    return (
      <div className="fixed inset-x-0 top-14 z-20 px-4 pt-2 sm:px-6 lg:left-[4.5rem]">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface-raised))] px-3 py-2 shadow-[var(--shadow-soft)]">
          <IconBell className="h-4 w-4 shrink-0 text-[var(--ok)]" />
          <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-[var(--ok)]">
            {porVer.length === 1
              ? `${primeira.client_name} marcou — ${primeira.quando}`
              : `${porVer.length} marcações novas desde que abriu`}
          </p>
          <Link
            href={href}
            onClick={dispensar}
            className="shrink-0 text-[0.8125rem] font-bold text-[var(--ok)] underline underline-offset-4"
          >
            ver
          </Link>
          <button
            type="button"
            onClick={dispensar}
            aria-label="Dispensar"
            className="-mr-1 shrink-0 p-1 text-[var(--ok)] opacity-70 transition-opacity hover:opacity-100"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  /*
    O CARTÃO. No canto, e no telemóvel por cima da barra de navegação —
    nunca atrás dela. Acima de tudo no empilhamento porque é a única
    coisa do ecrã que apareceu sozinha: quem não a puder fechar fica com
    ela em cima do trabalho.
  */
  return (
    <div
      className="fixed right-4 left-4 z-50 sm:left-auto sm:w-[21rem]"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="rounded-[var(--radius)] border border-[var(--line)] border-l-[3px] border-l-[var(--ok)] bg-[var(--surface-raised)] p-3.5 shadow-[0_18px_40px_-18px_rgba(46,38,28,0.5)] lg:mb-[-4.5rem]">
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-[0.6875rem] font-bold tracking-[0.1em] text-[var(--ok)] uppercase">
            Marcação nova · {SOURCE_LABEL[primeira.source]}
          </p>
          <button
            type="button"
            onClick={dispensar}
            aria-label="Dispensar"
            className="-mt-1 -mr-1 shrink-0 p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="mt-1 truncate text-[0.9375rem] font-bold text-[var(--ink)]">
          {primeira.client_name}
        </p>
        <p className="tabular mt-0.5 text-[0.8125rem] text-[var(--ink-muted)]">
          {primeira.quando}
          {primeira.services ? ` · ${primeira.services}` : ''}
        </p>
        {primeira.staff ? (
          <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-faint)]">
            com {primeira.staff}
          </p>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <Link
            href={href}
            onClick={dispensar}
            className={clsx(
              'flex h-9 flex-1 items-center justify-center rounded-[var(--radius)] bg-[var(--accent)] text-[0.8125rem] font-semibold text-[var(--accent-ink)]',
              'transition-colors hover:bg-[var(--accent-strong)]',
            )}
          >
            Ver na agenda
          </Link>
          <button
            type="button"
            onClick={() => setEncolhido(true)}
            className="h-9 shrink-0 rounded-[var(--radius)] px-3 text-[0.8125rem] font-medium text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            Depois
          </button>
        </div>

        {outras > 0 ? (
          <p className="mt-2 text-[0.75rem] text-[var(--ink-faint)]">
            e mais {outras} {outras === 1 ? 'marcação' : 'marcações'}.
          </p>
        ) : null}
      </div>
    </div>
  )
}
