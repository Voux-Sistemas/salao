'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n/config'
import { PROBLEM, languageFromBrowser } from '@/lib/i18n/problem'
import { Problem } from '@/components/problem'
import { Button, ButtonLink } from '@/components/ui'

/**
 * O limite de erro da superfície pública.
 *
 * Tem de ser um componente do cliente — é a regra dos limites de erro —
 * e por isso não pode pedir a língua ao servidor: quando esta tela
 * aparece, o servidor já falhou a responder por esta página. Lê o
 * cookie ela própria, depois de montar.
 *
 * Começa na língua da casa e corrige-se a seguir. Fazer o contrário
 * — adivinhar antes de montar — dava conflito de hidratação nos casos em
 * que o erro acontece a desenhar no servidor, e trocar um ecrã partido
 * por um aviso vermelho na consola não é negócio.
 */
export default function PublicError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE)

  useEffect(() => setLanguage(languageFromBrowser()), [])

  useEffect(() => {
    // Em produção a mensagem verdadeira fica no servidor; aqui chega só
    // o carimbo. Mesmo assim vale a pena registá-lo: é o que se pede à
    // cliente ao telefone para encontrar a linha certa do registo.
    console.error(error)
  }, [error])

  const text = PROBLEM[language]

  return (
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
  )
}
