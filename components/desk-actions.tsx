'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import clsx from 'clsx'
import {
  deleteAppointmentAction,
  logNotificationAction,
  transitionAction,
  type DeskState,
} from '@/app/(desk)/agenda/actions'
import { Button, Notice, type Variant } from '@/components/ui'
import { IconWhatsApp } from '@/components/desk-icons'
import type { Status } from '@/lib/booking'
import type { Routine } from '@/lib/whatsapp'

const EMPTY: DeskState = { error: null, done: null }


/**
 * UMA LINHA DENTRO DE UMA CAIXA.
 *
 * A pergunta do cancelamento e a porta discreta do painel — a
 * remarcação — usam a mesma moldura, e é por isso que a
 * classe sai daqui: umas são botões de formulário e outras são
 * ligações, e têm de ficar iguais.
 */
export const MENU_LINHA =
  'flex w-full items-center gap-2.5 border-t border-[var(--line-soft)] px-3.5 py-2.5 text-left text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:opacity-50'

function Submit({
  label,
  variant,
  size = 'sm',
  className,
  icon,
}: {
  label: React.ReactNode
  variant: Variant
  size?: 'sm' | 'md'
  className?: string
  icon?: React.ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
    >
      {icon}
      {label}
    </Button>
  )
}

/**
 * UM BOTÃO QUE MUDA O ESTADO DA MARCAÇÃO.
 *
 * Era um bloco que recebia a lista toda dos estados seguintes e a
 * arrumava sozinho: o primeiro em grande, os outros em pequeno, os maus
 * a vermelho. Com nove saídas à vista, nenhuma era a saída — e a que
 * ficava em grande era «Check-in», um passo que ninguém dá.
 *
 * Agora quem arruma é o painel, que sabe o que é o passo do dia e o que
 * é o resto. Aqui fica só a peça: um formulário e um botão.
 */
export function StatusAction({
  appointmentId,
  to,
  label,
  variant = 'outline',
  size = 'sm',
  full = false,
  icon,
  className,
}: {
  appointmentId: string
  to: Status
  label: string
  variant?: Variant
  size?: 'sm' | 'md'
  full?: boolean
  icon?: React.ReactNode
  className?: string
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    transitionAction,
    EMPTY,
  )

  return (
    <form action={action} className={clsx('space-y-2', className)}>
      <input type="hidden" name="appointment" value={appointmentId} />
      <input type="hidden" name="to" value={to} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Submit
        label={label}
        variant={variant}
        size={size}
        icon={icon}
        className={full ? 'w-full' : undefined}
      />
    </form>
  )
}

/**
 * CANCELAR — UM BOTÃO, E DEPOIS A PERGUNTA.
 *
 * Foram três botões vermelhos do tamanho dos outros, e o vermelho era um
 * terço do painel. Depois foram três linhas cinzentas de um menu, e aí
 * cancelar uma marcação passou a custar exactamente o mesmo que
 * qualquer outra coisa: um toque, sem aviso, sem volta.
 *
 * Agora é UM botão, discreto, ao lado dos outros dois. Carregar nele não
 * cancela nada: abre a pergunta. Só o segundo toque envia — e é lá, na
 * pergunta, que se diz QUAL das três coisas aconteceu, porque a cliente
 * ter desmarcado, a casa ter desmarcado e a cliente não ter aparecido
 * são três factos diferentes e a estatística do ano vive deles.
 *
 * Sem caixas de diálogo, sem nada a saltar por cima do ecrã: a pergunta
 * nasce onde estava o botão, e «deixar como está» fecha-a.
 */
export function CancelAction({
  appointmentId,
  cancelTo,
  itens,
  podeApagar = false,
  avisoConcluida = false,
  variant = 'danger',
  className,
}: {
  appointmentId: string
  /**
   * A cor do botão fechado. Ao lado de um «Não veio» vermelho cheio, um
   * segundo vermelho pesava o mesmo que o primeiro e desfazia a escada:
   * o painel de uma marcação passada pede o `quiet`.
   */
  variant?: Variant
  /**
   * A largura, quando fechado. Aberto ele toma a linha toda — a pergunta
   * do cancelamento não cabe em meia coluna, e um `basis-full` numa fila
   * que dobra tira-o de lá sem ninguém ter de saber que ele lá estava.
   */
  className?: string
  /**
   * O estado para onde uma desmarcação leva — ou nulo quando já não há
   * nenhum, que é o caso de uma marcação concluída.
   */
  cancelTo: Status | null
  /** Quantos serviços vão atrás, para a confirmação os poder contar. */
  itens: number
  /** A dona, e a marcação ainda não aconteceu. */
  podeApagar?: boolean
  /** A dona, mas a marcação já foi concluída: em vez da linha, a razão. */
  avisoConcluida?: boolean
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    transitionAction,
    EMPTY,
  )
  const [apagar, apagarAction] = useActionState<DeskState, FormData>(
    deleteAppointmentAction,
    EMPTY,
  )
  const [passo, setPasso] = useState<'fechado' | 'pergunta' | 'apagar'>(
    'fechado',
  )
  const aberto = passo !== 'fechado'

  /*
    UMA MARCAÇÃO CONCLUÍDA NÃO SE DESMARCA — MAS TEM ENGANOS.

    Concluída é o fim da cadeia: não há estado nenhum a seguir, e por
    isso não há nada para desmarcar. Só que é precisamente ali que ficam
    as linhas de teste e os enganos que já se fecharam — e o apagar, que
    vive dentro deste botão, ficaria sem porta.

    Sem para onde desmarcar, o botão deixa de dizer «Cancelar» (que não
    faria nada) e passa a ser o que resta: apagar.
  */
  const soApagar = cancelTo === null

  /*
    O SEGUNDO TOQUE DIZ O QUE SE PERDE — não «tem a certeza?».

    Uma pergunta de sim ou não não informa ninguém: quem carregou já
    decidiu, e volta a carregar. O que trava um engano é ler o que vai
    desaparecer, com os números desta marcação e não de uma qualquer.
  */
  if (passo === 'apagar') {
    return (
      <div className="space-y-2">
        {apagar.error ? <Notice tone="bad">{apagar.error}</Notice> : null}
        <div className="overflow-hidden rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--bad)_50%,transparent)]">
          <p className="px-3.5 py-3 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
            Apaga a marcação, {itens === 1 ? 'o serviço' : 'os ' + itens + ' serviços'},
            as horas que ocupava e o registo das mensagens enviadas.{' '}
            <strong className="font-semibold text-[var(--bad)]">
              Não fica rasto nenhum
            </strong>
            , nem na ficha da cliente.
          </p>
          <form action={apagarAction}>
            <input type="hidden" name="appointment" value={appointmentId} />
            <ApagarSubmit />
          </form>
          <button
            type="button"
            onClick={() => setPasso(soApagar ? 'fechado' : 'pergunta')}
            className={clsx(MENU_LINHA, 'justify-center text-[0.75rem]')}
          >
            Voltar atrás
          </button>
        </div>
      </div>
    )
  }

  if (!aberto) {
    return (
      <div className={clsx('space-y-2', className)}>
        {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
        {/*
          O vermelho vem da variante, não de classes soltas por cima do
          contorno: o «outline» pinta o texto de tinta, e duas cores de
          texto no mesmo botão resolvem-se pela ordem da folha de estilo,
          não pela ordem em que se escrevem. Foi o que aconteceu à
          primeira, e o botão saiu preto.
        */}
        <Button
          type="button"
          variant={variant}
          size="md"
          onClick={() => setPasso(soApagar ? 'apagar' : 'pergunta')}
          className="w-full"
        >
          {soApagar ? 'Apagar marcação' : 'Cancelar'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      {/*
        UMA PERGUNTA DE CADA VEZ.

        Perguntava «o que aconteceu?» e dava três respostas — a cliente
        desmarcou, o salão desmarcou, não apareceu — porque os três são
        factos diferentes. Ao balcão, com a cliente à frente, isso são
        três decisões onde só havia uma vontade: desmarcar. Passa a
        perguntar só o que interessa naquele segundo.

        A desmarcação fica em nome do SALÃO. Alguém tem de a carregar, e
        entre pôr a culpa na cliente por omissão ou na casa que escolheu
        não perguntar, é a casa que a leva.
      */}
      <div className="overflow-hidden rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--bad)_35%,transparent)]">
        <p className="px-3.5 py-2.5 text-[0.75rem] font-semibold text-[var(--bad)]">
          Desmarcar esta marcação?
        </p>
        {cancelTo ? (
          <form action={action}>
            <input type="hidden" name="appointment" value={appointmentId} />
            <input type="hidden" name="to" value={cancelTo} />
            <MenuSubmit label="Sim, desmarcar" />
          </form>
        ) : null}

        {/*
          APAGAR VIVE AQUI, DEPOIS DE UM FIO.

          É onde se vem quando uma marcação não se fez, e por isso é onde
          se vem quando ela nunca devia ter existido. O fio separa duas
          coisas: desmarcar é um facto do salão, apagar é um erro do
          sistema.
        */}
        {podeApagar ? (
          <>
            <span
              aria-hidden
              className="block h-px bg-[color-mix(in_srgb,var(--bad)_28%,transparent)]"
            />
            <button
              type="button"
              onClick={() => setPasso('apagar')}
              className={clsx(MENU_LINHA, 'font-semibold text-[var(--bad)]')}
            >
              Foi engano — apagar
            </button>
          </>
        ) : null}

        {/* A razão em vez do silêncio: quem a procura tem de saber
            porque é que não está lá. */}
        {avisoConcluida ? (
          <p className="border-t border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-[var(--warn)]">
            Esta já foi dada por concluída e conta na faturação. Não se
            apaga — desmarca-se.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setPasso('fechado')}
          className={clsx(MENU_LINHA, 'justify-center text-[0.75rem]')}
        >
          Deixar como está
        </button>
      </div>
    </div>
  )
}

function ApagarSubmit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        MENU_LINHA,
        'justify-center bg-[var(--bad)] font-semibold text-white hover:bg-[color-mix(in_srgb,var(--bad)_86%,black)] hover:text-white',
      )}
    >
      Apagar
    </button>
  )
}

function MenuSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(MENU_LINHA, 'font-semibold text-[var(--bad)]')}
    >
      {label}
    </button>
  )
}

/**
 * O sistema NÃO envia sozinho: prepara a mensagem e abre a conversa.
 * Uma pessoa carrega no botão — e é o registo do envio, não outra coisa
 * qualquer, que tira a linha da fila.
 *
 * Mandar a confirmação NÃO muda o estado da marcação.
 */
export function SendWhatsApp({
  appointmentId,
  routine,
  href,
  message,
  label,
  variant = 'ok',
  size = 'sm',
  done = false,
  className,
}: {
  appointmentId: string
  routine: Routine
  href: string
  message: string
  /**
   * Texto, ou dois textos com larguras diferentes: na fila dos avisos o
   * botão diz «Enviar confirmação» no monitor e «Enviar» no telemóvel,
   * onde a linha inteira tem trezentos e noventa píxeis.
   */
  label: React.ReactNode
  variant?: Variant
  size?: 'sm' | 'md'
  done?: boolean
  /**
   * A largura do botão, ditada por quem o põe: `w-full` no painel
   * lateral, `w-full sm:w-auto` na fila dos avisos — onde no telemóvel
   * ele fica sozinho numa linha e no ecrã largo volta para o fim da
   * linha da cliente. Vai à moldura e ao botão, para não haver um a
   * medir-se pelo outro.
   */
  className?: string
}) {
  const [state, action] = useActionState<DeskState, FormData>(
    logNotificationAction,
    EMPTY,
  )

  return (
    <div className={clsx('space-y-2', className)}>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <form
        action={action}
        onSubmit={() => {
          window.open(href, '_blank', 'noopener,noreferrer')
        }}
      >
        <input type="hidden" name="appointment" value={appointmentId} />
        <input type="hidden" name="routine" value={routine} />
        <input type="hidden" name="message" value={message} />
        {/*
          JÁ ENVIADA NÃO É O MESMO QUE DESLIGADA.

          O botão trocava de variante quando a mensagem já tinha saído, e
          ficava cinzento — a cor de uma coisa que não se usa. Mas a
          confirmação manda-se outra vez a toda a hora: a cliente apagou,
          mudou de número, ligou a perguntar. Continua a ser o mesmo
          botão, e continua a ser verde.

          O que já saiu diz-se pelas palavras — «(de novo)» — e pelo selo
          «Confirmação enviada» lá em cima. São dois sítios a dizê-lo;
          apagar o botão era um terceiro, e a mais.
        */}
        <Submit
          label={
            done ? (
              <>
                {label} <span className="font-normal">(de novo)</span>
              </>
            ) : (
              label
            )
          }
          variant={variant}
          size={size}
          className={className}
          icon={<IconWhatsApp className="h-4 w-4" />}
        />
      </form>
    </div>
  )
}
