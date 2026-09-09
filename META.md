# O passo a passo da conta Meta

Para quem vai criar a conta e ligar o número. Não é preciso saber
programação para seguir isto — mas há uma pergunta que tem de ser
respondida **antes** de se abrir o primeiro separador.

O que o sistema precisa, no fim, são **cinco variáveis**. Todo este
documento existe para as obter.

---

## Passo 0 · A pergunta que decide o caminho

**A Nohora usa o WhatsApp *Business* ou o WhatsApp normal?**

Abre-se o telemóvel dela e vê-se o ícone da app. O Business tem um «B»
no ícone e, dentro, tem «Ferramentas de empresa».

| Resposta | O que fazer |
|---|---|
| **WhatsApp Business** | Segue em frente. É o caso normal. |
| **WhatsApp normal** | **Pára aqui.** Ela tem de passar para o Business e usá-lo umas semanas antes de o número ser elegível. Instalar o Business preserva as conversas (a migração faz-se dentro da própria app), mas a elegibilidade não é imediata. |

Se for o normal, o resto deste documento fica à espera. Não há atalho —
e descobrir isto a meio custa mais do que perguntar agora.

**Confirma também:** a app está actualizada? É preciso a versão 2.24.17
ou superior.

---

## Passo 1 · A conta Meta (Business Portfolio)

Vai a **business.facebook.com** e cria um portfólio no nome da **VOUX**
(não no nome do salão — a VOUX é quem gere, a cliente é quem usa).

Pede: nome legal da empresa, morada, site, email.

Não é preciso: página de Facebook, conta de anúncios, nem verificação do
negócio. A verificação faz-se depois, sem pressa — até 250 conversas
iniciadas por dia não é exigida, e 600 marcações/mês são cerca de 40/dia.

---

## Passo 2 · Por onde entra o número — a decisão que tens de tomar

**Isto não é opcional.** A Coexistence (o número dela na app *e* na API
ao mesmo tempo) só se liga por um fluxo chamado Embedded Signup, e a
Meta escreve nos pré-requisitos:

> *«You must already be a Solution Partner or Tech Provider.»*

A cliente não liga o número dela sozinha. Nós também não, sem esse
estatuto. O que se escolhe é **por qual dos dois**:

| | **Usar um BSP** | **A VOUX torna-se Tech Provider** |
|---|---|---|
| Como | Registas-te num (360dialog, Twilio, Infobip…) e usas o fluxo deles | Registas a VOUX na Meta e passas a ter o teu próprio fluxo |
| Prazo | Dias | Semanas (inclui business verification) |
| Custo | Margem do BSP sobre os ~17 €/mês | Só o custo Meta |
| Compensa | Uma cliente, ou poucas | Vários salões no mesmo sistema |

**Não muda uma linha de código.** Os dois caminhos dão o mesmo
`PHONE_NUMBER_ID` e o mesmo `ACCESS_TOKEN`, e é só isso que o sistema
conhece — falamos directamente com a Graph API nos dois casos. Trocar de
BSP mais tarde também não obriga a reescrever nada.

**Sugestão:** se isto vai ser produto para vários salões, o caminho Tech
Provider paga-se sozinho. Para a Nohora apenas, um BSP põe-te a
funcionar esta semana.

---

## Passo 3 · Ligar o número (Coexistence)

Seja qual for o caminho, é aqui que o número entra. O fluxo abre uma
janela da Meta e pede:

1. Entrar com a conta Facebook ligada ao portfólio.
2. Escolher **«usar um número que já está no WhatsApp Business»** — é
   este o passo da Coexistence. Se escolheres «número novo», perdes o
   ponto todo.
3. No telemóvel da Nohora: **Ferramentas de empresa › API do WhatsApp
   Business** e ler o código QR que aparece no ecrã.

**Avisa-a de duas coisas antes**, porque são irreversíveis na prática:

- **Perde as listas de difusão.** Se ela as usa para promoções, é preciso
  outra solução.
- **Tem de abrir a app pelo menos de 13 em 13 dias.** Se não abrir, a
  ligação cai e os envios param.

---

## Passo 4 · Submeter os modelos

No **WhatsApp Manager › Modelos de mensagem**.

São **3 modelos**, cada um com **3 traduções** (pt_PT, en_US, es_ES) —
na Meta isso é um nome só com três línguas, e não nove modelos
separados.

**Categoria: Utility.** Não Marketing — é cerca de um terço do preço e
não exige opt-in de marketing. Se a Meta reclassificar para Marketing, é
porque o texto soa promocional; o texto que temos não soa.

O texto exacto, já com os `{{n}}` no sítio certo, sai daqui:

```
node scripts/wa-modelos.mjs
```

Copia-se e cola-se tal e qual. **Não reescrevas o texto na Meta:** o que
está aprovado lá e o que o sistema envia têm de ser a mesma coisa, ou os
envios falham com o erro 132005.

Os nomes têm de ser exactamente estes: `confirm`, `reminder_eve`,
`reminder_today`.

A aprovação costuma demorar minutos, às vezes horas.

---

## Passo 5 · As cinco variáveis

No Netlify: **Site settings › Environment variables**.

| Variável | Onde se arranja |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Manager. É o **id**, não o número de telefone |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente de utilizador de sistema (ver abaixo) |
| `WHATSAPP_VERIFY_TOKEN` | Inventas tu. Qualquer frase. A Meta pede-a uma vez |
| `WHATSAPP_APP_SECRET` | developers.facebook.com › a tua App › Definições › Básica |
| `CRON_SECRET` | Gera com o comando abaixo |

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**O token tem de ser permanente.** O token de teste que a Meta mostra
primeiro expira em 24 horas. O permanente faz-se em **Definições do
negócio › Utilizadores › Utilizadores de sistema**: cria um, dá-lhe
acesso à conta WhatsApp, e gera o token com as permissões
`whatsapp_business_messaging` e `whatsapp_business_management`.

> **A integração acende no momento em que as duas primeiras existirem.**
> As outras três não a acendem — protegem-na. Escolhe uma hora calma.

---

## Passo 6 · O webhook

Em **developers.facebook.com › a tua App › WhatsApp › Configuração**:

- **URL de callback:** `https://<o-site>/api/whatsapp/webhook`
- **Token de verificação:** o mesmo `WHATSAPP_VERIFY_TOKEN` de cima
- **Subscrever o campo:** `messages`

A Meta bate na porta uma vez para confirmar. Se falhar, é quase sempre
uma de duas: o `WHATSAPP_VERIFY_TOKEN` ainda não está no Netlify, ou o
site ainda não foi publicado com o código novo.

Sem isto o sistema envia na mesma — só nunca fica a saber se as
mensagens chegaram.

---

## Passo 7 · Provar

Por esta ordem, e sem saltar nenhuma:

```
node scripts/wa-teste.mjs
```

Diz se o token abre a porta. Não envia nada.

```
node scripts/wa-teste.mjs +351SEUNUMERO confirm pt_PT Maria Valongo "sábado, 13 de setembro" 10:30 "Corte"
```

Manda uma mensagem a sério **para o teu próprio número**.

Depois, uma marcação verdadeira pelo site, também para o teu número. Se
o telemóvel apitar e a linha sair sozinha da fila «Confirmar» no balcão,
está feito.

```
node scripts/wa-estado.mjs
```

Mostra o que saiu e o que a Meta fez com cada mensagem.

---

## Se correr mal

| Erro | O que é |
|---|---|
| **132001** | O modelo não existe nessa língua, ou ainda não foi aprovado |
| **132000** | O número de parâmetros não bate certo com o modelo |
| **132005** | O texto na Meta não é igual ao que o sistema envia — alguém reescreveu um dos lados |
| **131026** | Aquele número não recebe: não tem WhatsApp, ou bloqueou-nos |
| **190** | O token expirou. Provavelmente usaste o de teste em vez do permanente |

---

## O que fica do lado do sistema

Nada disto é teu. Fica registado para saberes que existe:

- Duas migrações por aplicar (`node scripts/_prod.mjs migrate`)
- O branch `whatsapp` por juntar ao `main`

E uma decisão da casa, que não é técnica: **o lembrete da véspera está
nas 19:00**. Vale a pena confirmar com a Nohora. A razão da escolha está
no `WHATSAPP.md`, §2.1.
