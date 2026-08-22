import { Problem } from '@/components/problem'
import { ButtonLink } from '@/components/ui'

/**
 * O que não existe e o que não é seu respondem o mesmo.
 *
 * Não é descuido de escrita: `resolveUnit` manda uma gerente para aqui
 * quando ela pede uma loja que não é dela, e uma marcação de outra
 * pessoa cai aqui na mesma. Se esta tela dissesse "não tem permissão",
 * passava a confirmar que a coisa existe — e a barra de endereço virava
 * um localizador da rede inteira.
 *
 * A área da equipa não é traduzida: fala pt-PT.
 */
export default function DeskNotFound() {
  return (
    <Problem
      eyebrow="Não encontrado"
      title="Isto não existe"
      body="Pode ter sido apagado, ou o endereço está errado. Volte atrás e tente pelo menu."
      actions={
        <ButtonLink href="/" size="lg">
          Voltar ao painel
        </ButtonLink>
      }
    />
  )
}
