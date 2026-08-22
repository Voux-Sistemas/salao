'use client'

import { useEffect } from 'react'
import { Problem } from '@/components/problem'
import { Button, ButtonLink } from '@/components/ui'

/**
 * O limite de erro do balcão.
 *
 * A moldura fica de pé — a coluna, a fita do dia, o menu — e só o miolo
 * é substituído por isto. Quem está a trabalhar não perde o sítio onde
 * estava, e o `retry` volta a pedir a mesma página sem recarregar tudo.
 *
 * A área da equipa não é traduzida: fala pt-PT.
 */
export default function DeskError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Problem
      eyebrow="Contratempo"
      title="Alguma coisa correu mal"
      body="Não foi por sua causa. Tente outra vez — e se voltar a acontecer, guarde o código aqui em baixo: é por ele que se encontra o que falhou."
      digest={error.digest ?? null}
      actions={
        <>
          <Button size="lg" onClick={() => retry()}>
            Tentar outra vez
          </Button>
          <ButtonLink href="/" variant="outline" size="lg">
            Voltar ao painel
          </ButtonLink>
        </>
      }
    />
  )
}
