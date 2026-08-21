import { NextResponse, type NextRequest } from 'next/server'
import { LANGUAGE_COOKIE, isLanguage } from '@/lib/i18n/config'

/**
 * O seletor de língua grava um cookie e volta para onde estava.
 * Funciona sem JavaScript: é só um link.
 */
export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang')
  const next = request.nextUrl.searchParams.get('next') ?? '/'

  // Só caminhos internos — um "next" absoluto seria um redireccionamento
  // aberto de bandeja.
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/'

  const response = NextResponse.redirect(new URL(safeNext, request.nextUrl.origin))

  if (isLanguage(lang)) {
    response.cookies.set(LANGUAGE_COOKIE, lang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  return response
}
