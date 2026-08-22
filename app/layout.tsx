import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { BRAND } from '@/lib/branding'
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

export const metadata: Metadata = {
  title: {
    default: `${BRAND.fallbackName} · ${BRAND.fallbackTagline}`,
    template: `%s · ${BRAND.fallbackName}`,
  },
  description:
    'Cabelo, unhas e estética com hora marcada. Marque online em segundos.',
  // O selo sobre porcelana, não o lockup inteiro: a 16px o nome por baixo
  // da grinalda é uma mancha. Gerado por `npm run logo:assets`.
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
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
