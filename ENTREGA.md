# Entrega

O que falta para o sistema estar de pé. Duas listas: a minha, que vou
riscando, e a sua, no fim — o que não pode ser feito por mais ninguém.

Estado: `[ ]` por fazer · `[~]` a meio · `[x]` feito

---

## 1. Quem vê o quê

A parte que magoa depois de estar no ar. O sistema vai guardar telefones,
moradas, alergias e notas de clientes reais.

- [x] Auditar a fronteira dos quatro níveis — Suporte, Dona, Gerente,
      Profissional — em todas as páginas e em todas as server actions.
- [x] Confirmar que uma Gerente não chega às lojas que não são dela, nem
      pela página nem por um id escrito à mão na barra de endereço.
- [x] Confirmar que uma Profissional não chega à faturação, às comissões
      das outras, nem aos códigos de entrada em `/avisos/codigos`.
- [x] Confirmar que a sessão de uma cliente não abre nada da equipa, e
      que não dá para ver a ficha de outra cliente.
- [x] Cabeçalhos de segurança no `next.config.ts`.
- [x] Travão de repetição nas portas públicas — entrar, pedir código,
      confirmar código e marcar. Contagem na base de dados, porque em
      produção o servidor não é um só.

## 2. Quando algo corre mal

Hoje um erro mostra o ecrã cinzento do Next, em inglês. Uma cliente que
veja isso fecha o site.

- [x] `error.tsx` e `not-found.tsx` no lado público, na língua e no
      visual do sítio.
- [x] O mesmo no lado da equipa.
- [x] `global-error.tsx` para o caso em que nem o layout sobrevive —
      com as cores escritas à mão, porque aí já não há folha de estilos.
- [x] As sete telas vistas a correr na compilação de produção, em pt,
      en e es.

## 3. O link que se manda por WhatsApp

É assim que as clientes vão receber a marcação. Hoje o link abre sem
imagem e sem descrição — chega lá como um endereço em cru.

- [x] Metadados OpenGraph na raiz e, com o nome e a cidade de cada casa,
      nos dois endereços que se colam numa conversa — `/loja/[loja]` e
      `/agendar/[loja]`.
- [x] Imagem de partilha com o logótipo, 1200×630, gerada por
      `npm run og:image`, com o texto alternativo ao lado.
- [x] `robots.txt` e `sitemap.xml`. O mapa lê as lojas da base de dados
      e, se ela não responder, sai só com as páginas fixas em vez de dar
      erro.
- [x] A área da equipa e os passos pessoais do funil marcados como
      «fora do índice».
- [x] Confirmar que os ícones em `public/` estão mesmo a ser usados —
      `icon.png` e `apple-icon.png` saem no `<head>` de todas as páginas.

## 4. Provar que funciona

Testado a sério contra a base de dados, não só visto ao espelho.

- [x] A tranca do overbooking recusa marcações sobrepostas, incluindo
      duas ligações a pedir a mesma mão ao mesmo segundo.
- [x] As migrações não têm nada que o Supabase recuse.
- [x] Funil público ponta a ponta, num navegador a sério contra a
      compilação de produção: loja → serviço → hora → nome e telefone →
      «Está reservado». Ficou na base uma marcação com origem `site`, a
      ficha da cliente criada pelo telefone, a língua do navegador
      guardada, o preço e o nome do serviço congelados na linha, e a
      profissional escolhida pelo servidor — nunca pelo navegador.
- [x] Comanda: receber em dinheiro → fechar → comissão de 30% sobre
      35,00 € = 10,50 €. Mexeu-se depois na regra para 50% e a entrada
      já gerada ficou nos 30% — a percentagem congela no fecho.
- [x] Caixa: fundo de 50,00 € → venda 35,00 €, reforço 20,00 €,
      sangria 15,00 € → esperado 125,00 €, contado 123,50 €,
      diferença −1,50 €. E o dia seguinte aberto de novo pelo ecrã.
      O fecho da comanda só passa com a caixa aberta — dinheiro vivo
      não entra numa gaveta fechada.

## 5. Fechar

- [x] `npx tsc --noEmit` e `npm run build` limpos — 44 rotas, incluindo
      `/robots.txt`, `/sitemap.xml` e `/opengraph-image.png`.
- [x] README posto a par: as oito migrações, o travão das portas, os
      ecrãs de erro e o cartão do link.
- [x] Commit.

---

## O que só você pode fazer

1. **O seu número em `SUPPORT_PHONES`**, no `.env`, em formato
   internacional (`+3519xxxxxxxx`). Hoje está lá o exemplo
   `+351900000000`. Quem entra com esse número vê tudo, em todas as
   lojas — é a sua chave-mestra.

2. **Criar o projecto no Supabase**, quando as facturas da Webmóveis
   estiverem regularizadas. Região *West EU (Paris)*, Data API
   desligada. Depois é só trocar a `DATABASE_URL` no `.env` e correr
   `npm run db:migrate`.

3. **Ligar o Netlify ao repositório** e repetir lá as variáveis do
   `.env` — o ficheiro nunca sai da sua máquina.

4. **O domínio**, se quiser um.

5. **O conteúdo verdadeiro**: fotografias das duas casas, os serviços e
   preços reais, a equipa, e a lista de clientes a importar.
