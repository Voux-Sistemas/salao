import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { BRAND } from '@/lib/branding'
import { env } from '@/lib/env'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const TITLE = `${BRAND.fallbackName} · ${BRAND.fallbackTagline}`
const DESCRIPTION =
  'Cabelo, unhas e estética com hora marcada. Marque online em segundos.'

/**
 * O CARTÃO DE VISITA DO LINK.
 *
 * As clientes recebem a morada do sítio pelo WhatsApp — é assim que a
 * casa se passa de mão em mão. O que aparece por cima do endereço sai
 * daqui: sem estas etiquetas, o link chega lá em cru.
 *
 * A imagem é o `app/opengraph-image.png`, apanhado pela convenção de
 * ficheiro do Next — não se declara aqui, e o Next escreve-lhe a morada
 * absoluta, o tamanho e o tipo sozinho.
 *
 * O `metadataBase` é o que torna absoluto tudo o que se escreve em
 * relativo. Sem ele, os robots que lêem a página recebiam `/og.png` e
 * não sabiam de que casa. Sai do `.env`, porque só o dono sabe qual é o
 * domínio.
 *
 * A descrição vai em português e não na língua da visita: quem lê isto
 * é o robot do WhatsApp, e esse não traz cookie nenhum.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: TITLE,
    template: `%s · ${BRAND.fallbackName}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND.legalName,
  // O selo sobre porcelana, não o lockup inteiro: a 16px o nome por baixo
  // da grinalda é uma mancha. Gerado por `npm run logo:assets`.
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
  openGraph: {
    type: 'website',
    siteName: BRAND.legalName,
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    locale: 'pt_PT',
    alternateLocale: ['en_GB', 'es_ES'],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: '#F5F0E6',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt"
      className={`${playfair.variable} ${inter.variable}`}
      // o script abaixo acrescenta .js antes da hidratação — mismatch esperado
      suppressHydrationWarning
    >
      <body>
        {/*
          Marca o html com .js assim que houver JavaScript: é a esta
          classe que o CSS de revelar-ao-rolar se agarra. Sem JS, nada
          se esconde — a página inteira fica visível à primeira.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        {children}
      </body>
    </html>
  )
}
