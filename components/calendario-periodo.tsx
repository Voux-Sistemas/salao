import Link from 'next/link'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { grelhaDoMes } from '@/lib/calendario'
import { diaMes } from '@/lib/periodo'
import { daysBetween, formatMonthYear, type IsoDay } from '@/lib/time'

/**
 * O CALENDÁRIO DO PERÍODO — escolher um intervalo dentro do quadro.
 *
 * O selector nativo do telemóvel só sabe escolher UM dia, e por isso um
 * intervalo obrigava a duas caixas separadas com um «até» pelo meio.
 * Aqui escolhe-se o intervalo inteiro no mesmo sítio: um toque no
 * princípio, outro no fim, e o miolo pinta-se entre os dois.
 *
 * DOIS TOQUES, E A REGRA SAI DO PRÓPRIO ENDEREÇO. Não há estado
 * escondido a dizer «estou à espera do fim»: se o que está escolhido é
 * UM dia, o toque seguinte estica-o até onde ela tocar; se já é um
 * intervalo, o toque seguinte recomeça. Uma regra que se lê do que está
 * no ecrã, sem nada por baixo a lembrar-se de coisas.
 *
 * E A ORDEM NÃO IMPORTA: tocar no 31 e depois no 12 dá o mesmo que ao
 * contrário. É um engano de dedo, não um pedido.
 *
 * SEM JAVASCRIPT NENHUM. Cada dia é uma ligação com o endereço já
 * calculado no servidor, e as setas do mês também — como o calendário
 * da montra, que vive assim desde que existe. O botão de trás desfaz
 * cada toque e o intervalo guarda-se nos favoritos.
 *
 * O FUTURO NÃO É CLICÁVEL. Estas contas somam o que já foi feito; dias
 * que ainda não aconteceram só acrescentavam zeros e faziam a ocupação
 * parecer pior do que é. O que está para vir tem o seu próprio sítio na
 * página, e são sempre os próximos sete dias.
 *
 * ESTA PEÇA NÃO É A DA MONTRA, e não devia ser. Aquela é grande, sem
 * caixa, com os dias sem vaga a um quinto de tinta — a linguagem de
 * quem está a marcar. Esta é compacta e emoldurada, que é a do balcão.
 * O que as duas partilham — a conta da grelha — está no
 * `lib/calendario`, uma vez só.
 */
export function CalendarioPeriodo({
  mes,
  escolha,
  hoje,
  primeiroPermitido,
  timezone,
  language = 'pt',
  hrefDia,
  hrefMes,
}: {
  /** Um dia qualquer do mês a mostrar. */
  mes: IsoDay
  /** O que já está escolhido, ou nulo se ela ainda não tocou em nada. */
  escolha: { de: IsoDay; ate: IsoDay } | null
  hoje: IsoDay
  /** O mais atrás que se pode ir — o tecto dos dois anos. */
  primeiroPermitido: IsoDay
  timezone: string
  language?: string
  hrefDia: (dia: IsoDay) => string
  hrefMes: (mes: IsoDay) => string
}) {
  const { primeiro, dias, recuo, cabecalhos, anterior, seguinte } = grelhaDoMes(
    mes,
    timezone,
    language,
  )

  // A seta só existe se houver mês para onde ir: adiante pára no mês de
  // hoje, atrás no tecto dos dois anos.
  const podeRecuar = anterior >= `${primeiroPermitido.slice(0, 8)}01`
  const podeAvancar = seguinte <= hoje

  // As duas pontas contam: de 12 a 31 sao 20 dias, nao 19.
  const contagem = escolha ? daysBetween(escolha.de, escolha.ate) + 1 : 0

  return (
    <div className="w-full max-w-[19rem] overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[0_14px_34px_-22px_rgba(28,24,21,0.5)]">
      {/* ------------------------------------------------- o mês --- */}
      <div className="flex items-center gap-2 border-b border-[var(--line-soft)] px-3 py-2.5">
        <Seta href={podeRecuar ? hrefMes(anterior) : null} label="Mês anterior">
          <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
        </Seta>
        <p className="display flex-1 text-center text-[0.9375rem] text-[var(--ink)] first-letter:uppercase">
          {formatMonthYear(primeiro, timezone, language)}
        </p>
        <Seta href={podeAvancar ? hrefMes(seguinte) : null} label="Mês seguinte">
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </Seta>
      </div>

      {/* ----------------------------------------------- os dias --- */}
      <div className="grid grid-cols-7 px-2.5 pt-2.5 pb-1">
        {cabecalhos.map((nome, i) => (
          <span
            key={i}
            aria-hidden
            className="pb-1.5 text-center text-[0.5313rem] font-bold uppercase tracking-[0.13em] text-[var(--ink-faint)]"
          >
            {nome}
          </span>
        ))}

        {Array.from({ length: recuo }, (_, i) => (
          <span key={`vazio-${i}`} aria-hidden />
        ))}

        {dias.map((dia) => (
          <Casa
            key={dia}
            dia={dia}
            escolha={escolha}
            hoje={hoje}
            morto={dia > hoje || dia < primeiroPermitido}
            href={hrefDia(dia)}
          />
        ))}
      </div>

      {/*
        O RODAPÉ É O ÚNICO SÍTIO QUE CONFIRMA A ESCOLHA.

        «20 dias» é o que lhe diz que apanhou o que queria — e é o mesmo
        número contra o qual a comparação se faz, os 20 dias antes
        destes. Sem escolha nenhuma, diz o que falta fazer: um quadro que
        abre sem instruções nem escolha deixa quem o vê à espera.
      */}
      <div className="flex items-baseline gap-2 border-t border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--accent)_4%,transparent)] px-3 py-2">
        {escolha ? (
          <>
            <span className="tabular text-[0.75rem] font-bold text-[var(--ink)]">
              {escolha.de === escolha.ate
                ? diaMes(escolha.de)
                : `${diaMes(escolha.de)} – ${diaMes(escolha.ate)}`}
            </span>
            <span className="text-[0.6875rem] text-[var(--ink-faint)]">
              {contagem === 1 ? 'um dia' : `${contagem} dias`}
            </span>
            {contagem === 1 ? (
              <span className="ml-auto text-[0.6875rem] font-semibold text-[var(--accent)]">
                agora o último
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-[0.75rem] font-semibold text-[var(--accent)]">
            Toca no primeiro dia
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Uma casa do calendário.
 *
 * A FAIXA E A BOLA SÃO DUAS COISAS. A faixa liga os dias uns aos outros
 * e tem de encostar às paredes da célula — senão o intervalo lê-se como
 * uma fila de quadradinhos soltos em vez de um traço. As pontas levam
 * uma bola por cima, e num intervalo de um dia só não há faixa nenhuma:
 * a bola sozinha já diz tudo.
 */
function Casa({
  dia,
  escolha,
  hoje,
  morto,
  href,
}: {
  dia: IsoDay
  escolha: { de: IsoDay; ate: IsoDay } | null
  hoje: IsoDay
  morto: boolean
  href: string
}) {
  const numero = Number(dia.slice(8))

  if (morto) {
    return (
      <span
        aria-disabled="true"
        className="tabular flex h-[1.875rem] items-center justify-center text-[0.75rem] text-[var(--ink)] opacity-20"
      >
        {numero}
      </span>
    )
  }

  const inicio = escolha?.de === dia
  const fim = escolha?.ate === dia
  const dentro = !!escolha && dia > escolha.de && dia < escolha.ate
  const ponta = inicio || fim
  const sozinho = inicio && fim

  return (
    <Link
      href={href}
      aria-current={ponta ? 'date' : undefined}
      className="relative flex h-[1.875rem] items-center justify-center"
    >
      {/* a faixa do miolo, encostada às paredes */}
      {dentro || (ponta && !sozinho) ? (
        <span
          aria-hidden
          className={clsx(
            'absolute inset-y-[2px] bg-[color-mix(in_srgb,var(--accent)_13%,transparent)]',
            dentro && 'inset-x-0',
            inicio && !sozinho && 'left-1/2 right-0',
            fim && !sozinho && 'left-0 right-1/2',
          )}
        />
      ) : null}

      {ponta ? (
        <span
          aria-hidden
          className="absolute inset-[2px] rounded-full bg-[var(--accent)]"
        />
      ) : dia === hoje ? (
        <span
          aria-hidden
          className="absolute inset-[2px] rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-[2px] rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
        />
      )}

      <span
        className={clsx(
          'tabular relative text-[0.75rem] leading-none',
          ponta
            ? 'font-bold text-[var(--accent-ink)]'
            : 'font-medium text-[var(--ink)]',
        )}
      >
        {numero}
      </span>
    </Link>
  )
}

/** A seta do mês. Sem sítio para onde ir, não é ligação nenhuma. */
function Seta({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: React.ReactNode
}) {
  const moldura =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line-soft)] text-[var(--ink-muted)]'

  if (!href) {
    return (
      <span aria-hidden className={clsx(moldura, 'opacity-25')}>
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={clsx(
        moldura,
        'transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {children}
    </Link>
  )
}
