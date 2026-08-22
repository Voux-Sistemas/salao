import { getLanguage } from '@/lib/i18n'
import { PROBLEM } from '@/lib/i18n/problem'
import { Problem } from '@/components/problem'
import { ButtonLink } from '@/components/ui'

/**
 * O 404 de raiz: qualquer endereço que não bata com nenhuma rota.
 *
 * De propósito sem cabeçalho nem rodapé. A moldura pública lê a rede, as
 * lojas e os horários à base de dados a cada pedido, e este é o ecrã que
 * os robôs de varrimento visitam às centenas por dia — pôr quatro
 * consultas por trás de cada endereço inventado sairia caro para não
 * mostrar nada de novo.
 *
 * A língua ainda se lê: sai do cookie, ou do cabeçalho do navegador.
 */
export const dynamic = 'force-dynamic'

export default async function NotFound() {
  const text = PROBLEM[await getLanguage()]

  return (
    <main className="skin-salon flex min-h-dvh items-center justify-center">
      <Problem
        eyebrow={text.notFoundEyebrow}
        title={text.notFoundTitle}
        body={text.notFoundBody}
        actions={
          <>
            <ButtonLink href="/agendar" size="lg">
              {text.book}
            </ButtonLink>
            <ButtonLink href="/" variant="outline" size="lg">
              {text.home}
            </ButtonLink>
          </>
        }
      />
    </main>
  )
}
