# Pendências

O que ficou por resolver quando o conteúdo real entrou no site.
Nada aqui impede o teste — tudo aqui tem de ser fechado antes de abrir
ao público.

---

## A · Perguntas para a dona

Cada uma destas está a ser suprida por um palpite meu. O palpite
funciona; só não é a verdade dela.

### A1 · Durações — 46 serviços a palpite

De 67 serviços, ela deu o tempo de 12. Outros 9 saíram por semelhança.
Os restantes **46 têm um tempo inventado por mim** — está tudo marcado
`'palpite'` em `scripts/seed-real.mjs` e listado em `CONTEUDO.md`.

Uma pergunta fecha metade: **cera e sobrancelhas são todas à volta dos
15 minutos?** Se sim, resolvem-se 11 de uma vez.

### A2 · Três leituras minhas por confirmar

1. **"Cor 1/30 minutos"** — li 1h30 = 90 min.
2. **"Corte mulher uma hora e meia"** — pus 90 min no *Corte senhora
   (s/ brushing)*. Mas o preçário diz *sem brushing*, e 90 min é muito
   para um corte seco. A hora e meia já inclui o brushing?
3. **Brushing 30–40** e **Penteados 60/90** — reparti pelo comprimento
   (o valor de baixo no curto, o de cima no comprido).

### A3 · Horário de funcionamento das lojas

Ela nunca o disse. Está no site assim:

| Loja | Dias | Horas |
|---|---|---|
| Valongo | segunda a sábado | 09:00–21:00 |
| Maia | segunda a sábado | 09:00–20:00 |

Em Valongo o horário foi desenhado para cobrir a escala das quatro. Na
Maia ela deu as horas (09:00–20:00) mas **não os dias**.

### A4 · Que serviços faz a Filipa

Não foi dito. Dei-lhe **rosto e cera** — se não fosse, ninguém em
Valongo fazia esses serviços e o funil não os oferecia. Se ela na
verdade faz cabelo, a estética de Valongo fica sem ninguém.

### A5 · Telemóveis da equipa

**É com o telemóvel que se entra no sistema.** Quatro dos cinco são
inventados (`+351930000001` a `…04`); só o da dona é verdadeiro. Cada
uma precisa do seu número real, senão não tem conta.

### A6 · Os domingos alternados da Adyr

A mensagem diz "alguns domingos alternados", sem dizer quais. Não estão
na escala. Ou se define a regra (um sim um não? de quinze em quinze?)
ou ela abre-os à mão na gestão, um a um.

Fica também por decidir de quem é a linha solta *"Os Domingos e das
9:00h até as 21:00h"*: horário da loja ao domingo, ou os domingos da
Adyr?

### A7 · Comissões

Ela não falou nisto. Está uma regra única de **30% para toda a gente,
em todos os serviços**. Muda-se na gestão, sem tocar em código.

### A8 · Quem manda em Valongo

Ninguém foi indicado como gerente. As quatro entram como
**profissionais** — vêem só a agenda delas, não vêem caixa, clientes
nem gestão. A dona vê tudo nas duas lojas.

### A9 · Os "sob avaliação"

Três casos não têm preço nem tempo fixo: cabelos longos e volumosos,
cabelos com extensões, e o Balayage de 5 h. A agenda precisa de um
número. Duas saídas:

- **Variante extra** — "Balayage · cabelo muito longo", 5 h, preço a
  combinar. A cliente escolhe e o salão ajusta na comanda.
- **Fora da marcação online** — existe ao balcão, não aparece no site.
  Quem quer, telefona.

### A10 · Ainda em falta

- Código postal e email de cada loja
- A Maia tem só 3 fotos; Valongo tem 6. A página dela fica mais pobre.
- Fotografias da equipa — hoje cada profissional é uma inicial num
  círculo.
- Fotografias dos serviços, se ela quiser. Não é preciso nenhuma: sem
  fotografia a linha mostra as iniciais do serviço sobre papel, que é
  desenho e não buraco. Põem-se em Gestão › Serviços, escolhendo uma
  das nove fotografias da casa numa fila de miniaturas.

---

## B · Ecrãs por afinar

Apanhados a testar. Nenhum parte nada.

- **B3 · Nomes compridos nos cartões da agenda.** "Balayage /
  Babylights / Ombré · cabelo comprido" é o nome mais longo do
  catálogo e corta a meio no cartão. → Fase 3.

- **B4 · Chips de profissional a 36 px.** No resumo da visita, os
  botões "Sem preferência / Profissional 1…" têm 36 px de altura — são
  largos (90–110 px) e acertam-se bem, mas ficam abaixo dos 44
  recomendados. Deliberado: a 44 pareciam botões a sério e roubavam a
  atenção ao preçário. A rever se alguém falhar o toque.

- **B5 · Funil ao computador é uma coluna só.** A 1440 px o catálogo
  do funil corre numa coluna e dá 6500 px de scroll, quando a montra e
  a página da loja já usam duas. → Fase 3, com o resto do desktop.

---

## D · A passagem de abrir a casa

O que se fechou para isto poder ser usado a sério, e não só visto.

- **A ligação à base passou a ser cifrada.** O `postgres.js` liga em
  texto simples por omissão e o Supabase aceita: nomes, telefones e a
  própria senha da ligação iam pela internet em claro. `lib/db.ts`
  exige `ssl: 'require'` fora de `localhost`, e os guiões passaram
  todos por `scripts/_ligar.mjs`, que é agora o único sítio onde isso
  se decide — cada um montava o seu cliente e nenhum pedia TLS.
- **A palavra-passe partilhada foi apagada de produção.** O
  `seed-real.mjs` dava `nohora2026` às cinco pessoas e o repositório é
  público: quem lesse o código entrava como dona, na rede toda.
  `scripts/arrancar.mjs` apagou-a e fechou as sessões abertas com ela.
  **Ninguém entra em produção até a dona ter senha própria.**
- **`?sslmode=` no endereço voltou a valer.** No `postgres.js` a opção
  passada à mão ganha sempre à do endereço, por isso o `ssl: false` que
  lá estava desligava a cifra a quem tinha escrito `?sslmode=require`
  de propósito.
- **Fechar comanda pede confirmação.** Congela comissões e mexe na
  caixa; era um toque só, ao lado do botão de receber.
- **As fotografias saíram da galeria.** Abrem a página inicial e cada
  ficha de loja, e ilustram cada casa na escolha de loja — quem marca
  vê onde vai ser atendida antes de escolher.
- **Cada serviço tem lugar para fotografia** (`service.image_url`), com
  as nove fotografias da casa oferecidas em miniatura na gestão. Sem
  fotografia saem as iniciais do serviço sobre papel, com o tom a
  variar com o nome.
- **`scripts/estado.mjs`** — diz numa página o que está na base e o que
  falta antes de abrir: quem não tem senha, quem não tem horário, lojas
  sem fotografia, movimento de teste por limpar.

---

## C · Feito nesta passagem

- Catálogo real: **67 serviços em 7 categorias**, preçário igual nas
  duas lojas. (Os 58 do PDF, com os 9 de comprimento variável
  desdobrados em dois — o esquema não tem variantes.)
- Lojas reais: Valongo e Maia, com morada, telefone e WhatsApp.
- Fotos ligadas: 6 em Valongo, 3 na Maia, servidas de `public/fotos/`.
- Equipa real com escalas e habilidades.
- **O nome que sai para fora passa por um sítio só.** Sete páginas
  fechadas — montra, página da loja, funil, horários, confirmação,
  `/pronto` e a área da cliente — todas por
  `coalesce(public_alias, name)`. O `public_alias` começou por ser
  `Profissional 1..5` e isso foi apagado: uma cliente que marca quer
  ler *Ariadna*, não um número. Quem quiser um nome de montra
  diferente do nome interno escreve-o na ficha, em Gestão › Equipa.
- Movimento de teste: seis semanas de histórico fechado, o dia de hoje
  a meio, três semanas de marcações futuras, caixa aberto nas duas
  lojas. **É fictício** — corre-se `seed-real.mjs` com
  `MOVIMENTO = false` e desaparece.

### A passagem do telemóvel (Fase 1)

- **B1 fechado.** O preçário deixou de ter quatro colunas apertadas no
  telemóvel: o nome fica com a linha toda, a duração e o preço descem
  para a linha de baixo, uma em cada ponta. O "1 h 30" já não parte e
  os preços caem todos alinhados. Acima dos 640 px é a linha de ementa
  de sempre, pontilhado incluído. Vive em `components/price-list.tsx`,
  partilhado pela montra e pela loja.
- **B2 fechado.** As categorias chegam fechadas ao telemóvel e abrem ao
  toque (`components/collapse-group.tsx`); no monitor o CSS abre-as
  todas e o cabeçalho volta a ser cabeçalho. A lista inteira está
  sempre no HTML — o Google lê-a e o Ctrl+F encontra-a — e sem
  JavaScript nada se esconde.
- **O funil encolheu de 9863 px para 2249 px** a 390 px de largura. Cada
  serviço passou a ser uma linha inteira a que se toca, com `[+]`/`[✓]`
  à esquerda em vez do botão "Escolher" de 95×32. Uma categoria que já
  tenha alguma coisa escolhida chega aberta.
- **Sem zoom acidental no iPhone.** Os campos passaram a 16 px ao
  telemóvel (`components/ui.tsx`); abaixo disso o Safari dá zoom sozinho
  mal se toca no campo e deixa a página encavalitada.
- **Alvos de toque.** Idiomas, "Marcar", os passos do funil, a cruz de
  tirar um serviço e as ligações do rodapé estavam entre os 15 e os 32
  px. Estão todos nos 44. Onde o padding desalinhava o desenho, a área
  cresce por baixo com a classe `.toque` (`app/globals.css`) e não se
  vê nada mudar.
