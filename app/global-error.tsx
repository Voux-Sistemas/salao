'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n/config'
import { PROBLEM, languageFromBrowser } from '@/lib/i18n/problem'

/**
 * O ÚLTIMO RECURSO.
 *
 * Isto só aparece quando nem o `app/layout.tsx` sobrevive — e quando ele
 * não sobrevive, também não há folha de estilos, nem tipos de letra, nem
 * as fichas de cor que o resto do sistema usa. Este ficheiro substitui o
 * documento inteiro, por isso desenha o seu próprio `<html>` e o seu
 * próprio `<body>`.
 *
 * É o único sítio do projecto onde as cores estão escritas em cru. Não é
 * descuido: `var(--surface)` aqui não vale nada, porque quem definia
 * essa variável era exactamente a folha que falhou. Os valores são os
 * mesmos da porcelana, copiados à mão — e se um dia a paleta mudar, esta
 * tela fica um bocadinho fora do tom durante os cinco segundos em que
 * alguém a vê. É o preço certo a pagar por ela abrir sempre.
 */

const PAPER = '#F5F0E6'
const INK = '#221D17'
const MUTED = '#6E6457'
const FAINT = '#A2957F'
const BRONZE = '#8E6F41'

const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const SERIF = 'ui-serif, Georgia, "Times New Roman", serif'

export default function GlobalError({
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
    <html lang={language}>
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          background: PAPER,
          color: INK,
          fontFamily: SANS,
          textAlign: 'center',
        }}
      >
        {/* Sem metadados aqui: um limite de erro é do cliente, e o
            `generateMetadata` não corre em componentes do cliente. O
            título põe-se com a etiqueta, que o React 19 sabe içar. */}
        <title>{text.errorTitle}</title>

        <div style={{ maxWidth: '32rem' }}>
          {/* O losango do ornamento, sozinho: o raminho em SVG vinha de
              um componente, e importar componentes para aqui é apostar
              que eles carregam quando o resto não carregou. */}
          <div
            aria-hidden
            style={{
              width: '0.5rem',
              height: '0.5rem',
              margin: '0 auto 2rem',
              background: BRONZE,
              transform: 'rotate(45deg)',
            }}
          />

          <p
            style={{
              margin: 0,
              fontSize: '0.6875rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: BRONZE,
            }}
          >
            {text.errorEyebrow}
          </p>

          <h1
            style={{
              margin: '1rem 0 0',
              fontFamily: SERIF,
              fontWeight: 400,
              fontSize: '2.25rem',
              lineHeight: 1.15,
            }}
          >
            {text.errorTitle}
          </h1>

          <p
            style={{
              margin: '1.25rem auto 0',
              maxWidth: '28rem',
              fontSize: '0.9375rem',
              lineHeight: 1.7,
              color: MUTED,
            }}
          >
            {text.errorBody}
          </p>

          <div
            style={{
              marginTop: '2.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => retry()}
              style={{
                height: '3.25rem',
                padding: '0 2rem',
                border: 0,
                borderRadius: 2,
                background: BRONZE,
                color: PAPER,
                fontFamily: 'inherit',
                fontSize: '0.9375rem',
                letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              {text.retry}
            </button>

            <a
              href="/"
              style={{
                height: '3.25rem',
                padding: '0 2rem',
                display: 'inline-flex',
                alignItems: 'center',
                border: `1px solid ${FAINT}`,
                borderRadius: 2,
                color: INK,
                fontSize: '0.9375rem',
                textDecoration: 'none',
              }}
            >
              {text.home}
            </a>
          </div>

          {error.digest ? (
            <p
              style={{
                marginTop: '3rem',
                fontSize: '0.6875rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: FAINT,
              }}
            >
              Ref. {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
