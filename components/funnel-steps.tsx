import Link from 'next/link'
import clsx from 'clsx'
import type { Dictionary } from '@/lib/i18n'

/**
 * Cinco passos e um recibo. Os passos já dados são ligações — voltar
 * atrás funciona, porque o que foi escolhido viaja no endereço.
 *
 * A ordem é a que a casa pediu: loja, dia, profissional, serviço, hora.
 * A profissional vem cedo — é a escolha que a cliente quer fazer, e não
 * uma que lhe caia em cima — mas depois do dia, porque quem folga à
 * terça não é escolha nenhuma. O serviço vem antes da hora porque é ele
 * que diz quanto tempo é preciso reservar: ao contrário, ofereciam-se
 * horas que depois não cabiam.
 *
 * AO DOMINGO SÃO CINCO. Não é o passo da profissional apagado: é o
 * passo fora da fila, e os que vêm atrás a recuar um número. Um «3 ·
 * Profissional» a cinzento anunciava uma escolha que nesse dia não
 * existe — e quem lê um rasto de migalhas lê para saber o que falta,
 * não para descobrir o que não há.
 */
export function FunnelSteps({
  current,
  dict,
  hrefs,
  picksStaff = true,
}: {
  current: 1 | 2 | 3 | 4 | 5 | 6
  dict: Dictionary
  /** Endereço de cada passo já percorrido; null desliga a ligação. */
  hrefs?: (string | null)[]
  /** Ao domingo é falso: o passo da profissional sai da fila. */
  picksStaff?: boolean
}) {
  const labels = [
    dict.funnel.steps.store,
    dict.funnel.steps.day,
    dict.funnel.steps.staff,
    dict.funnel.steps.service,
    dict.funnel.steps.time,
    dict.funnel.steps.confirm,
  ]

  /*
   * A numeração das páginas nunca muda — `step={5}` são as horas em
   * qualquer dia da semana, e é essa conta que diz o que já foi feito.
   * O que muda é só o que se DESENHA: tira-se o índice 2 e conta-se de
   * novo para o ecrã. Por isso guarda-se o índice original ao lado do
   * número mostrado: um compara-se com o `current`, o outro lê-se.
   */
  const shown = labels
    .map((label, index) => ({ label, index }))
    .filter((entry) => picksStaff || entry.index !== 2)

  /* O passo que está a acontecer, já contado na fila que se desenha —
     ao domingo é a fila de cinco, e a conta é sobre essa. */
  const agora = shown.findIndex((entry) => entry.index + 1 === current)
  const posicao = agora >= 0 ? agora + 1 : 1
  const nome = shown[agora >= 0 ? agora : 0]?.label ?? ''

  return (
    <>
      {/*
        NO TELEMÓVEL, PONTOS — E A CONTA AO LADO.

        Aqui os rótulos não cabem, e o que sobrava eram cinco algarismos
        soltos: não diziam onde se estava, nem o que vinha a seguir, nem
        quanto faltava. Um rasto que não se lê é ornamento.

        Ficam pontos — os feitos em ouro apagado, o de agora numa
        barrinha, os que faltam em cinzento — e do outro lado da linha o
        nome do passo e a conta.

        A CONTA VAI EM BARRA, «2 / 6», e não por palavras: ao lado de
        pontos que já mostram onde se está, escrever «passo 2 de 6» era
        dizer a mesma coisa duas vezes.

        E SAI DA FILA QUE SE DESENHA, nunca de um número escrito à mão:
        ao domingo o funil tem cinco passos, e um «de 6» fixo passaria a
        mentir todos os domingos — daqueles erros que ninguém nota
        durante meses.
      */}
      <div className="flex items-center gap-1.5 sm:hidden">
        {shown.map((entry, position) => {
          const step = entry.index + 1
          const done = step < current
          const atual = step === current
          const href = done ? (hrefs?.[entry.index] ?? null) : null

          const ponto = (
            <span
              aria-hidden
              className={clsx(
                'block h-1.5 rounded-full bg-current transition-all',
                atual ? 'w-5' : 'w-1.5',
                atual
                  ? 'text-[var(--accent)]'
                  : done
                    ? 'text-[color-mix(in_srgb,var(--accent)_50%,transparent)]'
                    : 'text-[var(--line)]',
              )}
            />
          )

          /* O ponto tem seis píxeis; o alvo tem de ter mais. A caixa
             cresce à volta dele com margens negativas, sem o ponto mudar
             de tamanho nem a fila perder o ritmo. */
          return href ? (
            <Link
              key={entry.label}
              href={href}
              aria-label={entry.label}
              className="-my-3 -mx-1.5 inline-flex items-center px-1.5 py-3"
            >
              {ponto}
            </Link>
          ) : (
            <span key={entry.label}>{ponto}</span>
          )
        })}

        <span className="ml-auto flex shrink-0 items-baseline gap-2">
          <span className="text-[0.625rem] font-bold tracking-[0.14em] text-[var(--accent)] uppercase">
            {nome}
          </span>
          <span className="tabular text-[0.625rem] tracking-[0.08em] text-[var(--ink-faint)]">
            {posicao} / {shown.length}
          </span>
        </span>
      </div>

    <ol className="hidden items-center gap-2 text-[0.6875rem] tracking-[0.14em] uppercase sm:flex">
      {shown.map((entry, position) => {
        const { label, index } = entry
        const step = index + 1
        const number = position + 1
        const done = step < current
        const href = done ? (hrefs?.[index] ?? null) : null
        const content = (
          <span
            className={clsx(
              'transition-colors',
              step === current
                ? 'text-[var(--accent)]'
                : done
                  ? 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  : 'text-[var(--ink-faint)]',
            )}
          >
            <span className="tabular">{number}</span>
            <span> · {label}</span>
          </span>
        )

        return (
          <li key={label} className="flex items-center gap-2">
            {href ? <Link href={href}>{content}</Link> : content}
            {/* O último nunca leva traço — e ao domingo o último é o
                quinto. */}
            {number < shown.length ? (
              <span aria-hidden className="text-[var(--line)]">
                —
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
    </>
  )
}
