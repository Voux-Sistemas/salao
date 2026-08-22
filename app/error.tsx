'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n/config'
import { PROBLEM, languageFromBrowser } from '@/lib/i18n/problem'
import { Problem } from '@/components/problem'
import { Button, ButtonLink } from '@/components/ui'

/**
 * A rede de segurança de raiz.
 *
 * Apanha o que os limites de baixo não apanham: a montra em `/`, as
 * portas da equipa em `/entrar` e `/comecar`, e qualquer rota nova que
 * nasça fora dos dois grupos. Não desenha moldura nenhuma — se o erro
 * foi a desenhar a moldura, repeti-la aqui era voltar a rebentar.
 *
 * Acima disto só sobra o `global-error.tsx`, para quando nem o esqueleto
 * do documento sobrevive.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE)

  useEffect(() => setLanguage(languageFromBrowser()), [])

  useEffect(() => {
    console.error(error)
  }, [error])

  const text = PROBLEM[language]

  return (
    <main className="skin-salon flex min-h-dvh items-center justify-center">
      <Problem
        eyebrow={text.errorEyebrow}
        title={text.errorTitle}
        body={text.errorBody}
        digest={error.digest ?? null}
        actions={
          <>
            <Button size="lg" onClick={() => retry()}>
              {text.retry}
            </Button>
            <ButtonLink href="/" variant="outline" size="lg">
              {text.home}
            </ButtonLink>
          </>
        }
      />
    </main>
  )
}
