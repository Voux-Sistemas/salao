import type { NextConfig } from 'next'

/**
 * Cabeçalhos que o navegador respeita sem lhe pedirmos nada.
 *
 * Não há aqui uma Content-Security-Policy completa de propósito: o Next
 * injecta scripts em linha e uma política mal calibrada parte o site em
 * produção sem dar sinal em desenvolvimento. O que fica é o que se pode
 * afirmar com certeza — e `frame-ancestors`, que é a metade da CSP que
 * não depende de nonces nenhuns.
 */
const securityHeaders = [
  /*
   * Ninguém mete este site dentro de um <iframe>. Sem isto, uma página
   * de outra pessoa podia sobrepor-lhe botões invisíveis e apanhar
   * cliques da recepção — o ecrã é o mesmo, as mãos é que são outras.
   */
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },

  /*
   * O navegador passa a acreditar no Content-Type que lhe damos em vez
   * de adivinhar pelo conteúdo. Um ficheiro carregado por engano deixa
   * de poder passar por script.
   */
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  /*
   * A morada da cliente não viaja para fora. Ao seguir um link para o
   * mapa da loja, o Google recebe o domínio — não o endereço completo,
   * que pode trazer o identificador da marcação atrás.
   */
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  /*
   * Nada disto é preciso para marcar uma unha. Fechado à partida.
   */
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },

  /*
   * Um ano de HTTPS obrigatório. O Netlify já serve só em HTTPS; isto
   * fecha a primeira visita, que é a única que ainda podia ir em claro.
   */
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
]

const config: NextConfig = {
  typedRoutes: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default config
