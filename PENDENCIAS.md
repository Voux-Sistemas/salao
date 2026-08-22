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

---

## B · Ecrãs por afinar

Apanhados a testar. Nenhum parte nada.

- **B1 · Preçário no telemóvel.** Na montra (`/`) e na página da loja,
  a coluna da duração é estreita de mais: "1 h 30" parte em duas linhas
  e o pontilhado desaparece quando o nome do serviço encavalita. Com 67
  serviços, isto aparece muitas vezes. → Fase 1.

- **B2 · A montra ficou comprida.** 67 serviços de enfiada dão quase
  10 000 px de scroll no telemóvel. Provavelmente quer categorias
  fechadas, a abrir ao toque. → Fase 1.

- **B3 · Nomes compridos nos cartões da agenda.** "Balayage /
  Babylights / Ombré · cabelo comprido" é o nome mais longo do
  catálogo e corta a meio no cartão. → Fase 3.

---

## C · Feito nesta passagem

- Catálogo real: **67 serviços em 7 categorias**, preçário igual nas
  duas lojas. (Os 58 do PDF, com os 9 de comprimento variável
  desdobrados em dois — o esquema não tem variantes.)
- Lojas reais: Valongo e Maia, com morada, telefone e WhatsApp.
- Fotos ligadas: 6 em Valongo, 3 na Maia, servidas de `public/fotos/`.
- Equipa real com escalas e habilidades.
- **O nome verdadeiro de cada profissional deixou de sair para fora.**
  Sete sítios fechados: montra, página da loja, funil, horários,
  confirmação, `/pronto` e a área da cliente. Para fora é
  `Profissional 1..5`; dentro da gestão continuam os nomes.
- Movimento de teste: seis semanas de histórico fechado, o dia de hoje
  a meio, três semanas de marcações futuras, caixa aberto nas duas
  lojas. **É fictício** — corre-se `seed-real.mjs` com
  `MOVIMENTO = false` e desaparece.
