'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import clsx from 'clsx'
import {
  passarAction,
  passarTodasAction,
  type DeskState,
} from '@/app/(desk)/agenda/actions'
import type { Candidate } from '@/lib/agenda'
import { shortName } from '@/lib/text'

const EMPTY: DeskState = { error: null, done: null }

/**
 * A PASTILHA DE QUEM FAZ É QUE TROCA QUEM FAZ.
 *
 * Não há botão novo na linha. A pastilha com o nome já estava em todas
 * — no monitor e no telemóvel — e o que se lhe acrescenta é função:
 * para mudar quem faz, toca-se em quem faz.
 *
 * AGORA VAI PINTADA COM A COR DELA. Estava num cinzento de papel, igual
 * em todas as linhas, e a razão escrita era boa: seis pastilhas
 * coloridas num ecrã onde a cor já tem ofício — o âmbar do que está por
 * fechar, o vermelho do que falhou — competem com esse ofício.
 *
 * O que mudou foi o peso. UMA LAVAGEM NÃO É UMA MANCHA: catorze por
 * cento da cor no fundo e quarenta e cinco no contorno leem-se como
 * «esta é da Filipa» sem gritar, e as pastilhas de estado continuam a
 * ser as únicas cheias. E a pastilha deixou de ser só uma etiqueta —
 * agora é um comando, e um comando ganha em dizer de quem é.
 */
export function PassarPastilha({
  appointmentId,
  cor,
  nome,
  semDono,
  cliente,
  quando,
  servicos,
  candidatos,
}: {
  appointmentId: string
  cor: string
  nome: string
  /**
   * A marcação está num perfil que não é gente — uma «cadeira» de
   * domingo. A pastilha grita, para se ver de longe qual falta repartir.
   */
  semDono?: boolean
  /** O que a folha diz que se está a passar. */
  cliente: string
  quando: string
  servicos: string
  candidatos: Candidate[]
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    passarAction,
    EMPTY,
  )
  const [aberto, setAberto] = useState(false)

  /* Passou: o menu fecha-se sozinho. Comparar com o último visto, e não
     com «tem alguma coisa», porque duas passagens dão a mesma frase. */
  const [visto, setVisto] = useState<string | null>(null)
  if (state.done && state.done !== visto) {
    setVisto(state.done)
    setAberto(false)
  }

  /*
    QUEM JÁ FAZ VEM PRIMEIRO, e depois quem pode, e por fim quem não
    pode. A lista deixa de começar por uma pessoa apagada — que era o
    que fazia parecer que ninguém estava disponível.
  */
  const ordenados = [...candidatos].sort((a, b) => {
    const peso = (c: Candidate) => (c.atual ? 0 : c.ok ? 1 : 2)
    return peso(a) - peso(b)
  })

  const lavagem = (percentagem: number) =>
    `color-mix(in srgb, ${cor} ${percentagem}%, transparent)`

  return (
    /*
      A CAMADA SOBE QUANDO ABRE, e o menu pendura-se na LINHA, não na
      pastilha.

      A pastilha precisa de estar acima da folha invisível que cobre a
      linha e abre a marcação — daí o `z-10`. Aberta sobe a `z-50`, para
      passar à frente das pastilhas das linhas seguintes.

      `sm:relative` E NÃO `relative`: a partir do `sm` o menu pendura-se
      na pastilha, que é onde há espaço para ele à direita. No telemóvel
      a pastilha NÃO é âncora, e o menu vai buscar a âncora mais acima —
      o `<li>` da linha, que é `relative`. Assim abre debaixo da linha em
      que se tocou, com a largura dela.

      DUAS TENTATIVAS ANTES DESTA ERAM UMA FOLHA PRESA AO FUNDO DO ECRÃ.
      Era mais fácil de posicionar e resolvia a largura — e estava
      errada por duas razões que só se veem a usar: aparecia longe do
      sítio onde se tinha tocado, e ficava lá agarrada enquanto a lista
      rolava por trás. Além disso disputava os últimos três centímetros
      e meio com a barra do fundo, que é `fixed` e vive lá. Um menu que
      não briga por espaço é melhor do que um menu que ganha a briga.
    */
    <span
      className={clsx('shrink-0 sm:relative', aberto ? 'z-50' : 'z-10')}
    >
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        aria-expanded={aberto}
        className={clsx(
          'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold transition-colors',
          semDono &&
            'border-dashed border-[color-mix(in_srgb,var(--house-deep)_50%,transparent)] bg-[color-mix(in_srgb,var(--house-deep)_10%,transparent)] font-bold text-[var(--house-deep)]',
        )}
        style={
          semDono
            ? undefined
            : {
                background: lavagem(aberto ? 26 : 14),
                borderColor: lavagem(aberto ? 70 : 45),
                color: 'var(--ink)',
              }
        }
      >
        {semDono ? 'por atribuir' : shortName(nome)}
        <span aria-hidden className="text-[0.5rem] opacity-50">
          ▾
        </span>
      </button>

      {aberto ? (
        <>
          {/*
            APANHA-TOQUES, E JÁ NÃO É UM VÉU.

            Era escuro, para apagar a lista enquanto a folha estava no
            fundo do ecrã. Com o menu colado à linha não há nada para
            apagar — o que se está a passar vê-se logo acima dele. Fica
            transparente, só para que um toque em qualquer sítio feche.
          */}
          <span
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-0 block"
          />

          {/*
            O MENU DEBAIXO DA LINHA.

            No telemóvel abre da largura da linha, encostado às margens
            dela — a âncora é o `<li>`, não a pastilha. A partir do `sm`
            pendura-se da pastilha, à direita, que é onde há espaço.

            TEM TECTO E O MIOLO ROLA. Numa equipa grande a lista é mais
            alta do que o que sobra do ecrã; o cabeçalho diz de quem é a
            marcação e o «deixar como está» é a saída, e nenhum dos dois
            pode fugir com a rolagem.
          */}
          <span className="max-sm:absolute max-sm:inset-x-3 max-sm:top-full max-sm:mt-1 max-sm:max-h-[60vh] sm:absolute sm:top-full sm:right-0 sm:mt-1.5 sm:w-[16rem] sm:max-h-[70vh] relative z-10 flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[0_22px_50px_-18px_rgba(28,24,21,0.5)]">
            {/*
              A FOLHA DIZ O QUE SE ESTÁ A PASSAR. Com a lista tapada por
              trás, sem isto deixa de haver maneira de confirmar em qual
              das linhas se tocou — e é o género de engano que só se
              descobre no dia seguinte.
            */}
            <span className="block shrink-0 border-b border-[var(--line-soft)] px-4 py-3">
              <span className="block text-[0.625rem] font-bold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
                Passar a
              </span>
              <span className="mt-1 block text-sm font-bold text-[var(--ink)]">
                {cliente}
              </span>
              <span className="tabular mt-0.5 block truncate text-[0.75rem] text-[var(--ink-faint)]">
                {quando} · {servicos}
              </span>
            </span>

            {state.error ? (
              <span className="block shrink-0 border-b border-[var(--line-soft)] px-4 py-2 text-[0.75rem] leading-relaxed text-[var(--bad)]">
                {state.error}
              </span>
            ) : null}

            {/* O `min-h-0` é o que deixa isto encolher dentro do flex —
                sem ele a caixa recusa-se a ser menor do que o conteúdo e
                a folha volta a crescer para fora do ecrã. */}
            <span className="block min-h-0 flex-1 overflow-y-auto">
            {ordenados.map((quem) =>
              quem.ok ? (
                <form key={quem.staffId} action={action}>
                  <input
                    type="hidden"
                    name="appointment"
                    value={appointmentId}
                  />
                  <input type="hidden" name="para" value={quem.staffId} />
                  <Linha nome={quem.name} why={quem.why} />
                </form>
              ) : (
                <span
                  key={quem.staffId}
                  className={clsx(
                    'flex items-center gap-2 border-t border-[var(--line-soft)] px-4 py-3 text-sm first:border-t-0',
                    quem.atual
                      ? 'bg-[color-mix(in_srgb,var(--house-deep)_7%,transparent)] font-bold text-[var(--house-deep)]'
                      : 'text-[var(--ink-faint)]',
                  )}
                >
                  {quem.name}
                  <span className="ml-auto text-[0.6875rem] font-normal">
                    {quem.why}
                  </span>
                </span>
              ),
            )}
            </span>

            <button
              type="button"
              onClick={() => setAberto(false)}
              className="block w-full shrink-0 border-t border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] px-4 py-3 text-center text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            >
              Deixar como está
            </button>
          </span>
        </>
      ) : null}
    </span>
  )
}

/** Uma pessoa que pode ficar com isto. O `pending` trava o toque duplo. */
function Linha({ nome, why }: { nome: string; why: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-2 border-t border-[var(--line-soft)] px-4 py-3 text-left text-sm text-[var(--ink)] transition-colors first:border-t-0 hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] disabled:opacity-40"
    >
      {nome}
      <span className="ml-auto text-[0.6875rem] text-[var(--ink-faint)]">
        {pending ? 'a passar…' : why}
      </span>
    </button>
  )
}

/**
 * A LINHA DO DIA — «passar todas a…».
 *
 * O caso mais comum do domingo é também o mais aborrecido de fazer à
 * mão: foi uma pessoa só, e as quatro marcações são dela. Um toque
 * resolve o dia; as que chocarem ficam, e a frase diz quantas.
 *
 * Só aparece quando há mais do que uma por repartir. Com uma, a
 * pastilha da própria linha é mais curta.
 */
export function PassarTodas({
  marcacoes,
  quantas,
  candidatos,
}: {
  /** Os identificadores das marcações que estão numa cadeira. */
  marcacoes: string[]
  quantas: number
  /** Quem está de serviço hoje e é gente. */
  candidatos: { staffId: string; name: string }[]
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    passarTodasAction,
    EMPTY,
  )
  const [aberto, setAberto] = useState(false)

  const [visto, setVisto] = useState<string | null>(null)
  if (state.done && state.done !== visto) {
    setVisto(state.done)
    setAberto(false)
  }

  return (
    <div
      className={clsx(
        'relative flex flex-wrap items-center gap-2 border-b border-[color-mix(in_srgb,var(--house-deep)_22%,transparent)] bg-[color-mix(in_srgb,var(--house-deep)_7%,transparent)] px-4 py-2.5 text-[0.8125rem] text-[var(--house-deep)]',
        // `z-50` pela mesma razão da pastilha: com 40 empata com a
        // barra do fundo e perde o desempate, que é a ordem no
        // documento.
        aberto ? 'z-50' : 'z-10',
      )}
    >
      <span>
        <strong className="font-bold">{quantas} marcações</strong> por atribuir
      </span>

      {candidatos.length > 0 ? (
        <button
          type="button"
          onClick={() => setAberto((x) => !x)}
          aria-expanded={aberto}
          className="ml-auto rounded-full border border-[color-mix(in_srgb,var(--house-deep)_40%,transparent)] bg-[var(--surface-raised)] px-3 py-1 text-[0.75rem] font-bold"
        >
          passar todas a… ▾
        </button>
      ) : null}

      {state.done ? (
        <span className="w-full text-[0.75rem] text-[var(--ok)]">
          {state.done}
        </span>
      ) : null}
      {state.error ? (
        <span className="w-full text-[0.75rem] text-[var(--bad)]">
          {state.error}
        </span>
      ) : null}

      {aberto ? (
        <>
          {/* Transparente: o menu abre colado à faixa, e não há nada
              para apagar por trás. Só fecha ao toque de fora. */}
          <span
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-0 block"
          />
          {/* Esta faixa já é `relative`, por isso a âncora é ela nos dois
              tamanhos: da largura toda no telemóvel, pendurada à direita
              a partir do `sm`. */}
          <div className="max-sm:inset-x-3 max-sm:mt-1 max-sm:max-h-[60vh] sm:right-4 sm:mt-1 sm:w-[15rem] sm:max-h-[70vh] absolute top-full z-10 flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[0_22px_50px_-18px_rgba(28,24,21,0.5)]">
            <p className="shrink-0 border-b border-[var(--line-soft)] px-4 py-3 text-[0.625rem] font-bold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
              Passar as {quantas} a
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {candidatos.map((quem) => (
                <form key={quem.staffId} action={action}>
                  <input type="hidden" name="para" value={quem.staffId} />
                  <input
                    type="hidden"
                    name="marcacoes"
                    value={marcacoes.join(',')}
                  />
                  <Linha nome={quem.name} why={`${quantas}`} />
                </form>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="block w-full shrink-0 border-t border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] px-4 py-3 text-center text-[0.8125rem] font-semibold text-[var(--ink-muted)]"
            >
              Deixar como está
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
