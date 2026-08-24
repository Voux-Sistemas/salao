'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * AS DUAS METADES DA MONTRA, LADO A LADO EM VEZ DE UMA ATRÁS DA OUTRA.
 *
 * A página tinha as lojas e o menu como duas secções empilhadas: quem
 * queria ver os serviços tinha de atravessar as lojas inteiras, e quem
 * vinha ver as lojas encontrava sessenta e sete serviços por baixo. São
 * duas perguntas diferentes — «onde ficam?» e «o que fazem?» — e cada
 * uma merece a página toda quando é feita.
 *
 * A troca é instantânea porque os dois painéis já vêm desenhados do
 * servidor: o que muda é qual deles se vê, não o que existe. Nada volta
 * ao servidor, nada pisca.
 *
 * O ENDEREÇO ACOMPANHA. Cada aba tem o seu `#` — pode-se mandar a
 * alguém a ligação já aberta nos serviços. Usa-se `replaceState` e não
 * um salto: o retrocesso do navegador serve para sair da página, não
 * para desfazer toques numa aba.
 *
 * SEM JAVASCRIPT NÃO HÁ ABAS — mostram-se as duas listas de enfiada,
 * cada uma com o seu título (a regra vive em globals.css e só morde
 * quando o html tem a classe .js). É isso que os motores de busca lêem
 * e o Ctrl+F encontra.
 */

export type ShowcaseTab = {
  /** O que fica no endereço e liga a aba ao painel: 'casas', 'servicos'. */
  id: string
  label: string
  /** O título de secção que só se vê quando não há JavaScript. */
  headingSemJs: ReactNode
  panel: ReactNode
}

export function ShowcaseTabs({ tabs }: { tabs: ShowcaseTab[] }) {
  const [active, setActive] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => {
      const alvo = window.location.hash.slice(1)
      const index = tabs.findIndex((tab) => tab.id === alvo)
      if (index < 0) return
      setActive(index)
      // Se existir mesmo um elemento com este id — o da secção, que é a
      // primeira aba — o navegador já lá rolou sozinho e mexer outra vez
      // era um solavanco. Só se rola quando o `#` não tem dono no HTML,
      // que é o caso das abas seguintes.
      if (!document.getElementById(alvo)) {
        raiz.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [tabs])

  /*
    UM PAINEL QUE ACABA DE APARECER JÁ CÁ ESTÁ.

    O que vive lá dentro — as categorias do menu, as fichas das casas —
    espera por um IntersectionObserver para se revelar ao rolar. Num
    painel escondido esse observador nunca disparou, e ao trocar de aba
    a lista aparecia com um atraso que se lê como avaria: carrega-se e
    não acontece nada. Uma troca de aba tem de ser instantânea — quem
    carregou já sabe o que quer ver.
  */
  useEffect(() => {
    const painel = document.getElementById(`painel-${tabs[active]!.id}`)
    if (!painel) return
    for (const no of painel.querySelectorAll('[data-reveal], [data-reveal-group]')) {
      no.setAttribute(
        no.hasAttribute('data-reveal') ? 'data-reveal' : 'data-reveal-group',
        'visible',
      )
    }
  }, [active, tabs])

  const escolher = (index: number) => {
    setActive(index)
    try {
      window.history.replaceState(null, '', `#${tabs[index]!.id}`)
    } catch {
      /* endereço preso (janela dentro de outra) — a aba muda na mesma */
    }
  }

  return (
    <div ref={raiz} className="scroll-mt-16">
      {/*
        A BARRA É UM MENU DE CASA, NÃO UM SEPARADOR DE APLICAÇÃO.

        Serifa grande, centrada, sobre um fio que atravessa a largura
        toda — e o pedaço de fio por baixo da aba escolhida acende-se a
        ouro. É a mesma gramática do resto da montra: fio, ouro, e mais
        nada.
      */}
      <div
        data-abas
        role="tablist"
        aria-label={tabs.map((tab) => tab.label).join(' / ')}
        className="flex justify-center gap-6 border-b border-[var(--line-soft)] sm:gap-14"
      >
        {tabs.map((tab, index) => {
          const on = index === active
          return (
            <button
              key={tab.id}
              id={`aba-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`painel-${tab.id}`}
              onClick={() => escolher(index)}
              className={
                'display relative -mb-px min-h-11 whitespace-nowrap pb-4 text-base leading-tight transition-colors duration-300 sm:text-[1.375rem] ' +
                (on
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--ink-faint)] hover:text-[var(--ink-muted)]')
              }
            >
              {tab.label}
              <span
                aria-hidden
                className={
                  'absolute inset-x-0 bottom-0 h-px origin-center bg-[var(--accent)] transition-transform duration-500 ' +
                  (on ? 'scale-x-100' : 'scale-x-0')
                }
              />
            </button>
          )
        })}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          id={`painel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`aba-${tab.id}`}
          {...(index === active ? {} : { 'data-painel-fechado': '' })}
          className="mt-12 sm:mt-16"
        >
          <h2 className="so-sem-js display mb-8 text-center text-3xl sm:text-4xl">
            {tab.headingSemJs}
          </h2>
          {tab.panel}
        </div>
      ))}
    </div>
  )
}
