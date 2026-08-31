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

const EMPTY: DeskState = { error: null, done: null }

/**
 * PASSAR UMA MARCAÇÃO A OUTRA PESSOA.
 *
 * A pastilha com o nome de quem faz já estava em todas as linhas — no
 * monitor e no telemóvel — e o que se lhe acrescentou foi função: para
 * mudar quem faz, toca-se em quem faz. Não há botão novo na linha.
 *
 * ONDE É QUE O MENU ABRE — TRÊS TENTATIVAS.
 *
 * A primeira pendurou-o da pastilha, como um menu normal. No telemóvel
 * não cabia à direita e as pastilhas das linhas seguintes atravessavam-
 * -no.
 *
 * A segunda fez dele uma folha presa ao fundo do ecrã. Resolveu a
 * largura e a leitura, e estava errada por duas razões que só se veem a
 * usar: aparecia longe do sítio onde se tinha tocado, e ficava lá
 * agarrada enquanto a lista rolava por trás. Ainda por cima disputava
 * os últimos centímetros com a barra do fundo, que é `fixed` e vive lá.
 *
 * A terceira colou-o à linha, mas a flutuar por cima das seguintes — e
 * ficava a ver-se meia linha por baixo dele, o que se lê como confusão.
 *
 * ESTA NÃO FLUTUA: EMPURRA. O menu é uma parte da linha, a seguir ao
 * conteúdo dela, e portanto as linhas de baixo descem para lhe dar
 * lugar. Nada fica por cima de nada, nada fica preso ao ecrã, e a lista
 * rola com o menu lá dentro como se ele sempre tivesse feito parte
 * dela.
 *
 * O PREÇO É ESTA REPARTIÇÃO EM DUAS PEÇAS. A pastilha vive no meio da
 * linha, o menu tem de vir depois dela — e as duas precisam do mesmo
 * estado. A grelha é um componente de servidor e não pode segurá-lo,
 * por isso quem o segura é a `PassarLinha`, que envolve a linha toda, e
 * a pastilha lá dentro vai buscá-lo pelo contexto. É a única maneira de
 * a pastilha ficar onde está e o menu ficar onde deve.
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
 * Envolve uma linha da agenda. Rende o conteúdo dela e, quando o menu
 * está aberto, o menu por baixo — dentro da mesma linha, a empurrar as
 * seguintes.
 */
export function PassarLinha({
  appointmentId,
  cliente,
  quando,
  servicos,
  candidatos,
  children,
}: {
  appointmentId: string
  /** O que o menu diz que se está a passar. */
  cliente: string
  quando: string
  servicos: string
  candidatos: Candidate[]
  children: ReactNode
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

  const temMenu = candidatos.length > 0

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
        alternar: () => setAberto((x) => !x),
        fechar: () => setAberto(false),
        temMenu,
      }}
    >
      {children}

      {aberto && temMenu ? (
        /*
          `relative z-10` para ficar acima da folha transparente que
          cobre a linha e abre a marcação — senão um toque numa pessoa
          abria a ficha em vez de a passar.

          `mx-3 mb-3` em vez de encostar às margens: um menu colado à
          borda lê-se como outra linha da lista, e este é uma coisa
          aberta por cima dela.
        */
        <div className="relative z-10 mx-3 mb-3 overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[0_10px_30px_-16px_rgba(28,24,21,0.45)]">
          <div className="border-b border-[var(--line-soft)] px-4 py-3">
            <p className="text-[0.625rem] font-bold tracking-[0.09em] text-[var(--ink-faint)] uppercase">
              Passar a
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ink)]">
              {cliente}
            </p>
            <p className="tabular mt-0.5 truncate text-[0.75rem] text-[var(--ink-faint)]">
              {quando} · {servicos}
            </p>
          </div>

          {state.error ? (
            <p className="border-b border-[var(--line-soft)] px-4 py-2 text-[0.75rem] leading-relaxed text-[var(--bad)]">
              {state.error}
            </p>
          ) : null}

          {/* Numa equipa grande a lista é mais alta do que o ecrã: o
              miolo rola por dentro e o «deixar como está» não foge. */}
          <div className="max-h-[50vh] overflow-y-auto">
            {ordenados.map((quem) =>
              quem.ok ? (
                <form key={quem.staffId} action={action}>
                  <input
                    type="hidden"
                    name="appointment"
                    value={appointmentId}
                  />
                  <input type="hidden" name="para" value={quem.staffId} />
                  <Escolha nome={quem.name} why={quem.why} />
                </form>
              ) : (
                <p
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
                </p>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => setAberto(false)}
            className="block w-full border-t border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] px-4 py-3 text-center text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            Deixar como está
          </button>
        </div>
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
