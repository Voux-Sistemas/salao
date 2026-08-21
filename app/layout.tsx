import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { BRAND } from '@/lib/branding'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: BRAND.fallbackName,
    template: `%s · ${BRAND.fallbackName}`,
  },
  description: BRAND.fallbackTagline,
}

export const viewport: Viewport = {
  themeColor: '#0E0D0C',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt" className={`${playfair.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
