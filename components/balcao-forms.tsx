'use client'

import { useActionState } from 'react'
import {
  terminarAparelhoAction,
  trancarAparelhoAction,
  trocarCodigoAction,
  type BalcaoState,
} from '@/app/(desk)/admin/balcao/actions'
import { Button, Notice } from '@/components/ui'

const VAZIO: BalcaoState = {}

/**
 * As peças de cliente da página do balcão. Cada uma é um formulário com
 * um botão — a mesma forma dos `desk-actions`, e pela mesma razão: quem
 * arruma é a página, aqui fica só o gesto.
 */

/** «Trocar o código». Sem pergunta: gerar outro não perde nada. */
export function TrocarCodigo({ primeiro }: { primeiro: boolean }) {
  const [state, action] = useActionState(trocarCodigoAction, VAZIO)

  return (
    <form action={action} className="space-y-2">
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" variant={primeiro ? 'primary' : 'quiet'} size="sm">
        {primeiro ? 'Criar o código' : 'Trocar o código'}
      </Button>
    </form>
  )
}

/**
 * Pôr um aparelho no balcão à distância.
 *
 * É a válvula de segurança: se ela se esquecer de o ligar num tablet, ou
 * desconfiar de alguma coisa, fecha-o do sítio onde estiver.
 */
export function TrancarAparelho({ sessao }: { sessao: string }) {
  const [state, action] = useActionState(trancarAparelhoAction, VAZIO)

  return (
    <form action={action}>
      <input type="hidden" name="sessao" value={sessao} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" variant="quiet" size="sm">
        Pôr no balcão
      </Button>
    </form>
  )
}

/** Terminar a sessão de um aparelho. */
export function TerminarAparelho({ sessao }: { sessao: string }) {
  const [state, action] = useActionState(terminarAparelhoAction, VAZIO)

  return (
    <form action={action}>
      <input type="hidden" name="sessao" value={sessao} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Button type="submit" variant="danger" size="sm">
        Terminar
      </Button>
    </form>
  )
}
