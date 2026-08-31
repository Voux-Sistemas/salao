import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

/*
 * QUEM PODE ENTRAR, E ONDE
 *
 * O sítio tem duas naturezas. A montra — a página inicial, a lista de
 * lojas, cada loja e o primeiro passo da marcação — existe para ser
 * encontrada. Tudo o resto é ou trabalho da equipa ou o caminho pessoal
 * de uma cliente a marcar, e não tem nada que fazer numa pesquisa.
 *
 * Isto não guarda a porta: quem entra sem sessão é travado no servidor,
 * não por um ficheiro de texto. É apenas boa educação com os robôs —
 * poupa-lhes centenas de pedidos a páginas que devolvem sempre o mesmo,
 * e evita que um endereço partilhado por engano acabe indexado.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // A área da equipa, inteira.
        '/entrar',
        '/comecar',
        '/agenda',
        '/admin',
        '/clientes',
        '/avisos',
        // A área da cliente e os passos pessoais do funil.
        '/conta',
        '/agendar/*/profissional',
        '/agendar/*/servicos',
        '/agendar/*/horarios',
        '/agendar/*/confirmar',
        '/agendar/*/pronto',
      ],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  }
}
