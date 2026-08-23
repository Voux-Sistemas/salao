# Ver o sistema tela a tela

Um caminho para atravessar o sistema todo pela ordem em que ele é usado
— primeiro pelos olhos de quem marca, depois pelos de quem atende,
depois pelos de quem manda — e ir apontando o que está torto.

Não é uma lista de funcionalidades. É o percurso: cada paragem diz
**onde**, **o que tem de acontecer** e **em que reparar**. O que houver
a dizer, diz-se no fim, no formato que está lá em baixo.

---

## Antes de começar

A base de dados local é um Postgres portátil que não arranca sozinho
com o Windows. Primeiro ela, depois o site:

```bash
"C:\Users\GR9\pgsql\bin\pg_ctl.exe" -D "C:\Users\GR9\pgdata-salao" -l "C:\Users\GR9\pgdata-salao\log.txt" start
npm run dev          # http://localhost:3000
```

Se o site abrir com erro, é quase sempre a base a não estar de pé.
`npm run estado` diz numa página o que lá está dentro.

**Contas locais** — a palavra-passe é `nohora2026` para toda a gente.
Só vale nesta máquina; em produção estas senhas já não abrem nada.

| Quem | Telefone | Vê |
|---|---|---|
| Nohora Ramirez | `+351934730344` | tudo, nas duas lojas |
| Ariadna | `+351930000001` | só a agenda dela |

**Uma armadilha:** com sessão aberta, `/` deixa de ser a montra e passa
a ser o **Hoje** da equipa. Para ver o site como uma cliente o vê, use
uma **janela anónima** — ou faça a Parte 1 antes de entrar.

---

## Parte 1 · O que a cliente vê

Janela anónima. Esta parte é a que vende; é onde vale a pena ser
esquisito.

### 1. A montra — `/`

A fotografia grande, o nome da casa, as duas lojas, o preçário todo, a
galeria e o rodapé.

Reparar em: a fotografia de abertura carrega antes do resto? As duas
lojas mostram foto, morada e horário de hoje? No preçário, cada linha
tem um quadrado à esquerda com as **iniciais do serviço** (BC, CS,
MN…) — os tons variam de linha para linha, ou ficaram todos iguais?

### 2. A ficha de cada loja — `/loja/valongo` e `/loja/maia`

Morada, mapa, horário da semana, preçário e o botão de marcar.

Reparar em: **a Maia tem 3 fotos e Valongo tem 6** — a página dela fica
mais pobre. Quer que eu equilibre, ou ela arranja mais fotografias?

### 3. Escolher a loja — `/agendar`

O primeiro passo do funil. Cada casa com a sua fotografia por cima do
nome, da morada e do «VER SERVIÇOS».

### 4. Escolher os serviços — `/agendar/valongo`

Sete categorias fechadas; abrem ao toque. Tocar na linha inteira
escolhe; tocar outra vez tira.

Reparar em: dá para perceber, sem instruções, que se toca na linha? O
resumo do lado direito acompanha? Junte três ou quatro serviços e veja
o total e a duração somada.

### 5. A hora — `/agendar/valongo/horarios`

Os sete dias em cima, as horas por baixo. Quem faz é escolhido pelo
servidor, mas dá para pedir alguém.

Reparar em: os dias sem vaga dizem-no, ou ficam mudos? Uma hora já
ocupada não pode aparecer.

### 6. Nome e telefone — `/agendar/valongo/confirmar`

### 7. Está reservado — `/agendar/valongo/pronto/[id]`

Faça uma marcação a sério, até ao fim, com um telefone inventado. É o
teste que mais vale: se este caminho parte, não há sistema.

Reparar em: o ecrã final diz o que interessa — dia, hora, onde, quanto?
Dá para juntar ao calendário e falar por WhatsApp?

### 8. A área da cliente — `/conta/entrar`

Entra-se com o telefone e um código. O código **não é enviado por
ninguém**: aparece do lado da equipa, em `/avisos/codigos`. É de
propósito — este sistema não manda mensagens sozinho.

### 9. As três línguas

O `PT · EN · ES` no rodapé. A montra, o funil e a área da cliente falam
as três; **a área da equipa é só em português** e é para ficar assim.

### 10. Ao telemóvel

Encolha a janela até aos 390 px (ou abra no telemóvel). Foi para aqui
que o funil foi desenhado — ao computador ele ainda corre numa coluna
só, que é uma das coisas que sei que estão por afinar.

---

## Parte 2 · O balcão

Entre como **Nohora Ramirez**, em `/entrar`.

### 11. Hoje — `/`

O painel do dia: o que está marcado, o mês até agora, a equipa.

### 12. A agenda — `/agenda` → `/agenda/valongo`

Escolhe-se a casa, depois vê-se o dia em colunas, uma por pessoa.

Reparar em: **os nomes compridos cortam a meio nos cartões** — o
«Balayage / Babylights / Ombré · cabelo comprido» é o pior caso. Já
está apontado; diga-me se incomoda o suficiente para subir na fila.

### 13. Encaixe — `/agenda/valongo/encaixe`

Quem chega sem marcação. Três passos: cliente, serviços, visita.

Reparar em: procurar por telefone encontra ficha existente? Uma cliente
nova cria-se aqui sem sair do ecrã?

### 14. A comanda — a partir de um cartão da agenda

**A comanda é a marcação.** Serviços, desconto, pagamentos, e o fecho.

Percorra isto inteiro:

1. Junte um serviço à comanda.
2. Meta um desconto.
3. Receba em dinheiro. Depois experimente metade em dinheiro e metade
   em cartão.
4. **Feche.** Pede confirmação — é de propósito: o fecho congela as
   comissões e mexe na caixa.

Reparar em: as contas batem certo com o desconto repartido? Depois de
fechar, a comissão aparece em Gestão › Comissões e o dinheiro em Caixa?

### 15. Remarcar — a partir de um cartão da agenda

Mesma cliente, novo dia e nova hora. Mantém os serviços e quem faz.

### 16. Caixa — `/caixa/valongo`

Fundo, o recebido do dia por método, reforço, sangria, e o fecho com
contagem.

Reparar em: **uma comanda em dinheiro não fecha com a caixa fechada** —
experimente fechar a caixa e depois fechar uma comanda em dinheiro. Tem
de recusar, com uma frase que se perceba.

### 17. Avisos — `/avisos/valongo`

As cinco rotinas: confirmar marcação, lembrete da véspera, lembrete de
hoje, pedir avaliação, recuperar cliente. Cada linha tem um botão que
abre o WhatsApp com a mensagem já escrita.

**O sistema nunca envia nada sozinho.** Não há API, não há agendador —
alguém carrega no botão e fala. É assim de propósito.

Reparar em: as mensagens estão na língua da cliente? Soam a pessoa ou a
robô? Este é o texto que sai da casa dela para fora — vale a pena ler
as cinco com atenção.

### 18. Códigos — `/avisos/codigos`

Os códigos de entrada das clientes na área delas. Só a dona e as
gerentes veem isto.

### 19. Clientes — `/clientes`

Lista com procura e etiquetas (VIP, ALERGIA, NOIVA).

- **A ficha** — histórico, notas da equipa, editar. Repare no botão de
  WhatsApp e no de marcar.
- **Nova ficha** — `/clientes/novo`
- **Importar** — `/clientes/importar`. Aceita ficheiro ou texto colado,
  e **mostra o que vai acontecer antes de fazer**. Vale a pena testar
  com uma lista suja de propósito: nomes repetidos, telefones mal
  escritos.

---

## Parte 3 · A gestão

`/admin`. Tudo aqui é da dona.

### 20. O painel — `/admin`

O mês até hoje, os serviços que mais rendem, as comissões por pagar.

### 21. Unidades — `/admin/unidades/valongo`

Morada, telefone, WhatsApp, fuso, horário da semana, fechos de
calendário, fotografias.

### 22. Serviços — `/admin/servicos`

O catálogo é da rede; cada loja e cada profissional podem ter preço e
duração próprios.

**É aqui que se põem fotografias nos serviços.** Abra um serviço e
procure o painel da fotografia: as nove fotografias da casa estão numa
fila de miniaturas, escolhe-se uma e vê-se logo o resultado. Ponha duas
ou três, volte à montra e ao funil, e veja como fica a lista com umas
linhas com fotografia e outras com as iniciais.

Reparar em: prefere assim, ou prefere as iniciais em toda a lista?

### 23. Equipa — `/admin/equipe`

Ficha, papéis, lojas, que serviços faz cada uma, escala e palavra-passe.

Reparar em: **quatro dos cinco telefones são inventados**
(`+35193000000…`). O telefone é a identidade de quem entra — enquanto
for inventado, aquela pessoa não tem conta. E hoje cada profissional
aparece com a inicial num círculo; se ela tiver fotografias da equipa,
mande-as.

### 24. Comissões — `/admin/comissoes`

Está uma regra única de 30% para toda a gente. As regras podem ser por
pessoa, por serviço, ou pelos dois.

Reparar em: as comissões já lançadas **não mudam** quando se muda a
regra. É assim de propósito — o que foi fechado ficou fechado.

---

## Parte 4 · As fronteiras

A parte que ninguém vê e que magoa se estiver mal.

### 25. Entrar como profissional — `+351930000001`

Saia, e entre como **Ariadna**.

Ela tem de ver **só a agenda dela**. Não pode haver Caixa, nem
Clientes, nem Gestão, nem Avisos no menu. Experimente também escrever
os endereços à mão — `/caixa`, `/clientes`, `/admin`, `/avisos/codigos`
— e confirme que a porta está fechada, e não só escondida.

---

## O que eu já sei que está por afinar

Para não gastar observações no que já está apontado:

- **Nomes compridos cortam nos cartões da agenda.**
- **O funil ao computador corre numa coluna só** — 6500 px de scroll a
  1440 px de largura, quando a montra já usa duas.
- **Os botões de escolher profissional têm 36 px** em vez dos 44
  recomendados. Foi deliberado (a 44 roubavam a atenção ao preçário),
  mas revê-se se alguém falhar o toque.
- **A Maia tem metade das fotografias de Valongo.**
- **Sem fotografias da equipa** — cada pessoa é uma inicial num círculo.

A lista longa, com o porquê de cada uma, está em `PENDENCIAS.md`.

---

## Como me passar as observações

Uma linha por coisa, com o número da paragem à frente. Não precisa de
explicar o que quer que eu faça — chega dizer o que lhe saltou à vista:

```
4  · o resumo do lado direito não se vê ao telemóvel
12 · os cartões da agenda estão apertados
17 · a mensagem de confirmação soa a robô
22 · prefiro as iniciais em toda a lista, sem fotografias nos serviços
```

Se for uma coisa visual, um print vale mais do que a frase.
