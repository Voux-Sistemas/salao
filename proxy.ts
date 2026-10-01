import { NextResponse, type NextRequest } from 'next/server'

/*
 * A PORTA FECHADA AOS ROBÔS NO FUNIL
 *
 * O robots.txt já pede aos robôs que não entrem nos passos do funil, e
 * cada passo já vai com `noindex, nofollow`. Em 2026-10-01 um crawler
 * fazia cerca de trinta pedidos por segundo nesses passos mesmo assim
 * (108 mil numa hora, contra 160 de navegadores): o carrinho dos serviços
 * guarda-se no endereço, e as combinações não acabam. Cada visita
 * desenhava a página e perguntava à base.
 *
 * Aqui quem se declara robô e pede um passo do funil leva um 403 antes de
 * a página ser desenhada. Nenhum robô bem-educado chega cá — o
 * robots.txt fecha exactamente estes endereços —, por isso isto só trava
 * quem já o está a ignorar.
 *
 * O filtro do `matcher` olha para o user agent antes de chamar esta
 * função: as clientes nem passam por aqui. A lista é de nomes exactos, e
 * não palavras soltas como «bot», que apanhariam um telemóvel Cubot. As
 * expressões do `matcher` têm de ser literais, daí a repetição.
 * E só se travam leituras: o POST da acção de confirmar nunca é tocado.
 */

const ROBO = /meta-externalagent|Bytespider|GPTBot|ClaudeBot|CCBot|PerplexityBot|Amazonbot|AhrefsBot|SemrushBot|PetalBot|HeadlessChrome/

export function proxy(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next()
  if (!ROBO.test(ua)) return NextResponse.next()

  const { pathname, search } = request.nextUrl
  // O primeiro passo, limpo, fica aberto: é a montra que se quer
  // encontrada. Com dia ou mês no endereço (?d=, ?m=) já é funil.
  const primeiroPassoLimpo = /^\/agendar\/[^/]+\/?$/.test(pathname) && search === ''
  if (primeiroPassoLimpo) return NextResponse.next()

  return new NextResponse(null, {
    status: 403,
    headers: { 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

export const config = {
  matcher: [
    {
      source: '/agendar/:loja/:passo(profissional|servicos|horarios|confirmar|pronto)/:resto*',
      has: [
        {
          type: 'header',
          key: 'user-agent',
          value: '.*(meta-externalagent|Bytespider|GPTBot|ClaudeBot|CCBot|PerplexityBot|Amazonbot|AhrefsBot|SemrushBot|PetalBot|HeadlessChrome).*',
        },
      ],
    },
    {
      source: '/agendar/:loja',
      has: [
        {
          type: 'header',
          key: 'user-agent',
          value: '.*(meta-externalagent|Bytespider|GPTBot|ClaudeBot|CCBot|PerplexityBot|Amazonbot|AhrefsBot|SemrushBot|PetalBot|HeadlessChrome).*',
        },
      ],
    },
    {
      // O seletor de língua é um link em cada página, com o endereço de
      // volta no ?next=. Os robôs seguiam-no para cada passo do funil, e
      // cada visita era uma function só para gravar um cookie.
      source: '/idioma',
      has: [
        {
          type: 'header',
          key: 'user-agent',
          value: '.*(meta-externalagent|Bytespider|GPTBot|ClaudeBot|CCBot|PerplexityBot|Amazonbot|AhrefsBot|SemrushBot|PetalBot|HeadlessChrome).*',
        },
      ],
    },
  ],
}
