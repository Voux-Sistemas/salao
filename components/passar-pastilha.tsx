'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useActionState } from 'react'
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
 * PASSAR UMA MARCAÇÃO A OUTRA PESSOA.
 *
 * A pastilha com o nome de quem faz já estava em todas as linhas — no
 * monitor e no telemóvel — e o que se lhe acrescentou foi função: para
 * mudar quem faz, toca-se em quem faz. Não há botão novo na linha.
 *
 * ONDE É QUE A CAIXA ABRE — QUATRO TENTATIVAS ANTES DESTA.
 *
 * A primeira pendurou-a da pastilha, como um menu normal. No telemóvel
 * não cabia à direita e as pastilhas das linhas seguintes atravessavam-
 * -na.
 *
 * A segunda fez dela uma folha presa ao fundo do ecrã, com véu. Lia-se
 * bem — e aparecia longe do sítio onde se tinha tocado, ficava lá
 * agarrada enquanto a lista rolava por trás, e disputava os últimos
 * centímetros com a barra do fundo, que é `fixed` e vive lá.
 *
 * A terceira colou-a à linha, a flutuar, e SEM O VÉU. Ficava a ver-se
 * meia linha a espreitar por baixo dela: confusão.
 *
 * A quarta pô-la em flow, a empurrar as linhas de baixo. Nada por cima
 * de nada — e nada que a destacasse do resto da lista.
 *
 * O QUE FAZIA A SEGUNDA PARECER MELHOR ERA O VÉU, NÃO O SÍTIO. Escurecer
 * a lista é o que faz a caixa parecer uma coisa aberta por cima, em vez
 * de mais um pedaço de lista. Esta junta as duas metades certas: o véu
 * da segunda, o sítio da terceira.
 *
 * ESCOLHER E TRANSFERIR SÃO DOIS GESTOS. Tocar num nome transferia logo.
 * Numa lista onde as linhas têm dois dedos de altura e um toque muda a
 * agenda de duas pessoas, isso é pouco: o toque escolhe, o botão faz.
 *
 * O PREÇO É A PEÇA PARTIR-SE EM DUAS. A pastilha vive no meio da linha,
 * a caixa tem de vir depois dela, e as duas precisam do mesmo estado. A
 * grelha é um componente de servidor e não pode segurá-lo, por isso quem
 * o segura é a `PassarLinha`, que envolve a linha toda, e a pastilha lá
 * dentro vai buscá-lo pelo contexto.
 */

type Estado = {
  aberto: boolean
  alternar: () => void
  fechar: () => void
  /** Sem candidatos não há o que abrir: a pastilha fica etiqueta. */
  temMenu: boolean
}

const Contexto = createContext<Estado>({
  aberto: false,
  alternar: () => {},
  fechar: () => {},
  temMenu: false,
})

/**
 * Envolve uma linha da agenda: rende o conteúdo dela e, aberta, o véu
 * e a caixa colada por baixo. A caixa é `absolute` contra o `<li>`, que
 * já era `relative`. 
 */
export function PassarLinha({
  appointmentId,
  cliente,
  candidatos,
  children,
}: {
  appointmentId: string
  /** O nome que a caixa mostra: é só isso que ela precisa de dizer. */
  cliente: string
  candidatos: Candidate[]
  children: ReactNode
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    passarAction,
    EMPTY,
  )
  const [aberto, setAberto] = useState(false)

  /*
    ESCOLHER E TRANSFERIR SÃO DOIS GESTOS.

    Tocar num nome transferia logo. Numa lista onde as linhas têm dois
    dedos de altura e a agenda de duas pessoas muda com o toque, isso é
    pouco: agora o toque escolhe, e é o botão que faz.
  */
  const [escolhido, setEscolhido] = useState<string | null>(null)

  const fechar = () => {
    setAberto(false)
    setEscolhido(null)
  }

  /* Passou: o menu fecha-se sozinho. Comparar com o último visto, e não
     com «tem alguma coisa», porque duas passagens dão a mesma frase. */
  const [visto, setVisto] = useState<string | null>(null)
  if (state.done && state.done !== visto) {
    setVisto(state.done)
    setAberto(false)
    setEscolhido(null)
  }

  const temMenu = candidatos.length > 0
  const nomeEscolhido =
    candidatos.find((c) => c.staffId === escolhido)?.name ?? null

  /*
    QUEM JÁ FAZ VEM PRIMEIRO, e depois quem pode, e por fim quem não
    pode. A lista deixa de começar por uma pessoa apagada — que era o
    que fazia parecer que ninguém estava disponível.
  */
  const ordenados = [...candidatos].sort((a, b) => {
    const peso = (c: Candidate) => (c.atual ? 0 : c.ok ? 1 : 2)
    return peso(a) - peso(b)
  })

  return (
    <Contexto.Provider
      value={{
        aberto,
        alternar: () => (aberto ? fechar() : setAberto(true)),
        fechar,
        temMenu,
      }}
    >
      {children}

      {aberto && temMenu ? (
        <>
          {/*
            O VÉU. Sem ele a caixa flutuava sobre linhas bem visíveis e
            via-se meia linha a espreitar por baixo — que é o que se lê
            como confusão. Escurecer o resto é o que faz a caixa parecer
            arrumada, e foi por isso que a versão presa ao fundo do ecrã
            parecia melhor: era o véu, não era o sítio.

            `z-[45]` de propósito: acima da barra do fundo, que é `z-40`
            e ficaria acesa por cima do escuro, e abaixo da caixa.

            NO MONITOR FICA TRANSPARENTE. Escurecer um ecrã inteiro por
            causa de uma caixa de dezanove ram é um estrondo para um
            gesto pequeno — lá a caixa é um menu pendurado, e um menu
            pendurado não apaga a sala. O que fica é a apanha do toque
            de fora, que continua a fechar.
          */}
          <span
            onClick={fechar}
            className="fixed inset-0 z-[45] block bg-[rgba(28,24,21,0.42)] sm:bg-transparent"
          />

          {/*
            A CAIXA NASCE DEBAIXO DA LINHA EM QUE SE TOCOU.

            `absolute` contra o `<li>`, que é `relative`: fica colada à
            linha e rola com a lista, em vez de presa ao fundo do ecrã.
            `z-50` para passar à frente do véu e da barra.

            NO TELEMÓVEL VAI DE MARGEM A MARGEM, porque a largura toda
            são trezentos e sessenta píxeis e não há nada para disputar.
            NO MONITOR NÃO: esticada por uma lista de mil e quinhentos,
            os nomes ficavam encostados a um lado e o «é quem faz» ao
            outro, com um deserto pelo meio e um botão de um palmo.
            Encolhe para dezanove ram e encosta-se à direita, debaixo da
            pastilha de onde saiu.
          */}
          <div className="absolute inset-x-3 top-full z-50 mt-1 overflow-hidden rounded-[12px] bg-[var(--surface-raised)] shadow-[0_18px_44px_-14px_rgba(28,24,21,0.55)] sm:left-auto sm:right-3 sm:w-[19rem]">
            <div className="flex items-start gap-3 border-b border-[var(--line-soft)] py-3 pl-4 pr-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.625rem] font-bold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
                  Transferir
                </span>
                {/*
                  Só o nome. A hora e o serviço estavam a repetir a linha
                  que fica logo acima — e com o véu ela continua à vista,
                  escurecida mas legível.
                */}
                <span className="mt-0.5 block truncate text-[0.9375rem] font-bold tracking-[-0.01em] text-[var(--ink)]">
                  {cliente}
                </span>
              </span>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
              >
                <span aria-hidden className="text-base leading-none">
                  ×
                </span>
              </button>
            </div>

            {state.error ? (
              <p className="border-b border-[var(--line-soft)] px-4 py-2 text-[0.75rem] leading-relaxed text-[var(--bad)]">
                {state.error}
              </p>
            ) : null}

            <form action={action}>
              <input type="hidden" name="appointment" value={appointmentId} />
              <input type="hidden" name="para" value={escolhido ?? ''} />

              <p className="px-4 pb-1 pt-2.5 text-[0.625rem] font-bold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
                Para
              </p>

              {/* Numa equipa grande a lista é mais alta do que o ecrã: o
                  miolo rola por dentro e o botão não foge com ele. */}
              <div className="max-h-[50vh] overflow-y-auto">
                {ordenados.map((quem) => (
                  <Opcao
                    key={quem.staffId}
                    quem={quem}
                    escolhida={escolhido === quem.staffId}
                    escolher={() => setEscolhido(quem.staffId)}
                  />
                ))}
              </div>

              <Confirmar nome={nomeEscolhido} />
            </form>
          </div>
        </>
      ) : null}
    </Contexto.Provider>
  )
}

/**
 * A PASTILHA, PINTADA COM A COR DE QUEM FAZ.
 *
 * Estava num cinzento de papel, igual em todas as linhas, e a razão
 * escrita era boa: seis pastilhas coloridas num ecrã onde a cor já tem
 * ofício — o âmbar do que está por fechar, o vermelho do que falhou —
 * competem com esse ofício.
 *
 * O que mudou foi o peso. UMA LAVAGEM NÃO É UMA MANCHA: catorze por
 * cento da cor no fundo e quarenta e cinco no contorno leem-se como
 * «esta é da Filipa» sem gritar, e as pastilhas de estado continuam a
 * ser as únicas cheias. E a pastilha deixou de ser só uma etiqueta —
 * agora é um comando, e um comando ganha em dizer de quem é.
 *
 * `z-10` para ficar acima da folha transparente que cobre a linha: sem
 * isso o toque abria a marcação em vez de abrir o menu.
 */
export function PassarPastilha({
  cor,
  nome,
  semDono,
}: {
  cor: string
  nome: string
  /**
   * A marcação está num perfil que não é gente — uma «cadeira» de
   * domingo. A pastilha grita, para se ver de longe qual falta repartir.
   */
  semDono?: boolean
}) {
  const { aberto, alternar, temMenu } = useContext(Contexto)

  const lavagem = (percentagem: number) =>
    `color-mix(in srgb, ${cor} ${percentagem}%, transparent)`

  return (
    <button
      type="button"
      onClick={alternar}
      aria-expanded={temMenu ? aberto : undefined}
      disabled={!temMenu}
      className={clsx(
        'relative z-10 flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold transition-colors',
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
      {semDono ? 'por atribuir' : nome}
      {temMenu ? (
        <span aria-hidden className="text-[0.5rem] opacity-50">
          ▾
        </span>
      ) : null}
    </button>
  )
}

/**
 * Uma pessoa na lista.
 *
 * SÓ SE ESCOLHE QUEM PODE FICAR COM ISTO. Quem já a faz aparece — é o
 * que diz de onde a marcação sai — mas transferir para quem já a tem
 * não faz nada; e quem não sabe fazer o serviço também não se escolhe.
 * Os dois casos ficam à vista e não recebem toque.
 */
function Opcao({
  quem,
  escolhida,
  escolher,
}: {
  quem: Candidate
  escolhida: boolean
  escolher: () => void
}) {
  const podeIr = quem.ok && !quem.atual

  const corpo = (
    <>
      <span
        aria-hidden
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          escolhida
            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
            : quem.atual
              ? 'border-dashed border-[color-mix(in_srgb,var(--accent)_45%,transparent)]'
              : 'border-[var(--line)]',
        )}
      >
        {escolhida ? (
          <span className="text-[0.5rem] leading-none">✓</span>
        ) : null}
      </span>
      {quem.name}
      <span className="ml-auto text-[0.6875rem] font-normal text-[var(--ink-faint)]">
        {quem.why}
      </span>
    </>
  )

  if (!podeIr) {
    return (
      <p
        className={clsx(
          'flex items-center gap-2.5 border-t border-[var(--line-soft)] px-4 py-2.5 text-[0.875rem] first:border-t-0',
          quem.atual ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]',
        )}
      >
        {corpo}
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={escolher}
      aria-pressed={escolhida}
      className={clsx(
        'flex w-full items-center gap-2.5 border-t border-[var(--line-soft)] px-4 py-2.5 text-left text-[0.875rem] text-[var(--ink)] transition-colors first:border-t-0',
        escolhida
          ? 'bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] font-bold'
          : 'hover:bg-[var(--surface-2)]',
      )}
    >
      {corpo}
    </button>
  )
}

/**
 * O BOTÃO DIZ PARA QUEM VAI.
 *
 * Um botão que só diz «Transferir» obriga a olhar para cima outra vez
 * para confirmar a quem — e é a última coisa que se lê antes de mudar a
 * agenda de duas pessoas.
 *
 * SEM ARTIGO ANTES DO NOME. «Transferir para a Filipa» lê-se melhor, e
 * parte-se assim que um colaborador for homem. O nome sozinho serve os
 * dois.
 */
function Confirmar({ nome }: { nome: string | null }) {
  const { pending } = useFormStatus()
  const pronto = nome !== null && !pending

  /*
    A MARGEM É DA MOLDURA, NÃO DO BOTÃO.

    Escrevi isto primeiro como `m-3 w-[calc(100%-1.5rem)]` — e em CSS o
    menos de um `calc` precisa de espaços à volta, senão a regra é
    inválida e o Tailwind não a emite. O botão ficava sem largura e
    ninguém dizia porquê. Uma caixa com preenchimento e um botão a cem
    por cento não tem como falhar.
  */
  return (
    <div className="p-3">
      <button
        type="submit"
        disabled={nome === null || pending}
        className={clsx(
          'flex h-10 w-full items-center justify-center rounded-[var(--radius)] text-[0.8125rem] font-bold transition-colors',
          pronto
            ? 'bg-[var(--action)] text-[var(--action-ink)] hover:bg-[var(--action-strong)]'
            : 'bg-[var(--surface-2)] text-[var(--ink-faint)]',
        )}
      >
        {pending
          ? 'A transferir…'
          : nome
            ? `Transferir para ${shortName(nome)}`
            : 'Transferir'}
      </button>
    </div>
  )
}

/** Uma pessoa que pode ficar com isto. O `pending` trava o toque duplo. */
function Escolha({ nome, why }: { nome: string; why: string }) {
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
 *
 * Esta abre para baixo em flow, como o menu da linha, e pela mesma
 * razão: empurrar é mais legível do que flutuar.
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
    <div className="border-b border-[color-mix(in_srgb,var(--house-deep)_22%,transparent)] bg-[color-mix(in_srgb,var(--house-deep)_7%,transparent)]">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[0.8125rem] text-[var(--house-deep)]">
        <span>
          <strong className="font-bold">{quantas} marcações</strong> por
          atribuir
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
      </div>

      {aberto ? (
        <div className="mx-3 mb-3 overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[0_10px_30px_-16px_rgba(28,24,21,0.45)]">
          <p className="border-b border-[var(--line-soft)] px-4 py-3 text-[0.625rem] font-bold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
            Passar as {quantas} a
          </p>
          <div className="max-h-[50vh] overflow-y-auto">
            {candidatos.map((quem) => (
              <form key={quem.staffId} action={action}>
                <input type="hidden" name="para" value={quem.staffId} />
                <input
                  type="hidden"
                  name="marcacoes"
                  value={marcacoes.join(',')}
                />
                <Escolha nome={quem.name} why={`${quantas}`} />
              </form>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="block w-full border-t border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] px-4 py-3 text-center text-[0.8125rem] font-semibold text-[var(--ink-muted)]"
          >
            Deixar como está
          </button>
        </div>
      ) : null}
    </div>
  )
}
