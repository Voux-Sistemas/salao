# Abrir a casa

O que já está feito e o que falta para a equipa do salão começar a usar
isto a sério. A última lista é a que interessa: são as coisas que só
uma pessoa com as chaves pode fazer.

Estado: `[ ]` por fazer · `[~]` a meio · `[x]` feito

Para ver como está a base neste momento, sem mexer em nada:

```bash
node scripts/_prod.mjs estado
```

---

## 1. Quem vê o quê

A parte que magoa depois de estar no ar. O sistema guarda telefones,
moradas, alergias e notas de clientes reais.

- [x] Auditar a fronteira dos três níveis — Dona, Gerente,
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
- [x] **A ligação à base é cifrada.** O condutor não pedia TLS e o
      Supabase aceita texto simples: nomes, telefones e a própria senha
      da ligação iam pela internet em claro. `lib/db.ts` obriga agora a
      `ssl: 'require'` em tudo o que não seja `localhost`.
- [x] **A palavra-passe partilhada foi apagada.** O `seed-real.mjs`
      dava a mesma senha às cinco pessoas e essa senha está escrita no
      repositório, que é público — quem lesse o código entrava como
      dona, na rede toda. `scripts/arrancar.mjs` apagou-a em produção e
      fechou as sessões que tinham sido abertas com ela.

## 2. Quando algo corre mal

Um erro em inglês, no ecrã cinzento do Next, faz uma cliente fechar o
site.

- [x] `error.tsx` e `not-found.tsx` no lado público, na língua e no
      visual do sítio.
- [x] O mesmo no lado da equipa.
- [x] `global-error.tsx` para o caso em que nem o layout sobrevive —
      com as cores escritas à mão, porque aí já não há folha de estilos.
- [x] As sete telas vistas a correr na compilação de produção, em pt,
      en e es.

## 3. O link que se manda por WhatsApp

É assim que as clientes recebem a marcação.

- [x] Metadados OpenGraph na raiz e, com o nome e a cidade de cada casa,
      nos dois endereços que se colam numa conversa — `/loja/[loja]` e
      `/agendar/[loja]`.
- [x] Imagem de partilha com o logótipo, 1200×630, gerada por
      `npm run og:image`, com o texto alternativo ao lado.
- [x] `robots.txt` e `sitemap.xml`. O mapa lê as lojas da base de dados
      e, se ela não responder, sai só com as páginas fixas.
- [x] A área da equipa e os passos pessoais do funil marcados como
      «fora do índice».

## 4. As fotografias

Nove fotografias verdadeiras — seis de Valongo, três da Maia — que
estavam quase todas escondidas na galeria do fim da montra.

- [x] Abrem a página inicial e cada ficha de loja.
- [x] Ilustram cada casa na escolha de loja, que é o primeiro passo do
      funil: quem marca vê onde vai ser atendida antes de escolher.
- [x] Podem ilustrar cada serviço (`service.image_url`). Na gestão o
      campo oferece as nove fotografias da casa numa fila de miniaturas
      — não é preciso saber o que é um endereço de imagem.
- [x] Sem fotografia sai o monograma da casa sobre papel, com o tom a
      variar com o nome do serviço. É o desenho normal, não uma falha.
- [x] Ou há miniaturas em toda a lista ou não há nenhuma: meia dúzia de
      fotografias entre sessenta e sete serviços deixava a lista aos
      degraus.

## 5. Provar que funciona

Testado contra a base de dados, não só visto ao espelho.

- [x] A tranca do overbooking recusa marcações sobrepostas, incluindo
      duas ligações a pedir a mesma mão ao mesmo segundo.
- [x] Funil público ponta a ponta, num navegador a sério: loja →
      serviço → hora → nome e telefone → «Está reservado». Ficou na base
      uma marcação com origem `site`, a ficha da cliente criada pelo
      telefone, a língua guardada, o preço e o nome do serviço
      congelados na linha, e a profissional escolhida pelo servidor.
- [x] Comanda ponta a ponta: receber 15,00 € em dinheiro → fechar →
      entrou um movimento de caixa de 15,00 € e uma comissão de 30%
      = 4,50 €, congelada no fecho.
- [x] Caixa: fundo, venda, reforço, sangria, contagem e diferença. O
      fecho da comanda só passa com a caixa aberta — dinheiro vivo não
      entra numa gaveta fechada.
- [x] As 31 páginas da equipa abertas uma a uma com a conta da dona:
      todas a 200, sem um erro de consola.
- [x] `npx tsc --noEmit` e `npm run build` limpos.

---

## O que só você pode fazer

Por esta ordem.

1. **Dar a palavra-passe à dona.** Neste momento *ninguém* entra: a
   senha partilhada foi apagada e ainda não há outra. Corra e escreva a
   senha quando ele pedir — não aparece no ecrã nem fica no histórico
   do terminal:

   ```bash
   node scripts/_prod.mjs senha +351934730344
   ```

   As outras quatro definem-se depois, por ela, em **Gestão › Equipa**.

2. **Os telefones verdadeiros da equipa.** Quatro dos cinco são
   inventados (`+35193000000…`). O telefone é a identidade de quem
   entra: enquanto for inventado, aquela pessoa não consegue entrar.
   Trocam-se na ficha de cada uma, em Gestão › Equipa.

3. **Limpar o movimento inventado**, no dia em que a casa começar a
   usar isto. São 14 clientes e 1114 marcações que existem só para os
   relatórios não estarem vazios. Apaga o movimento e guarda lojas,
   preçário, equipa, escalas, fotografias e palavras-passe:

   ```bash
   node scripts/_prod.mjs limpar --a-serio
   ```

   E logo a seguir, a equipa. Os nomes que lá estão são de ensaio; a
   casa vai numerar as pessoas — Profissional 1, 2, 3 — e criá-las uma
   a uma. Isto deixa a primeira, com o catálogo todo, e apaga o resto:

   ```bash
   node scripts/_prod.mjs equipa --a-serio
   ```

4. **Um `SETUP_CODE` novo** no Netlify, se o antigo alguma vez foi
   partilhado. É o código que abre a instalação de raiz.

5. **O domínio**, se quiser um. Depois é pôr o endereço final em
   `NEXT_PUBLIC_SITE_URL`, no Netlify — é dele que saem os links de
   partilha e o `sitemap.xml`.

6. **As fotografias da equipa**, se as houver. Hoje cada profissional
   aparece com a inicial num círculo.
