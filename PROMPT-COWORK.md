# Prompt para o Claude Cowork

Copia tudo o que está dentro da caixa a seguir e cola no Cowork.

Antes de colar, duas coisas:

- **Faz login no Facebook / Meta no browser do Cowork primeiro.** O
  Cowork abre sites e preenche formulários, mas a autenticação (palavra-
  passe, 2FA, SMS) é tua. Se entrares antes de começar, ele não encalha.
- **Usa o modo Manual** nas permissões, pelo menos da primeira vez. Isto
  cria uma conta a sério, com o nome legal da empresa. Vale a pena ver o
  que ele escreve antes de submeter.

---

```
Vais criar uma conta Meta Business e ligar a WhatsApp Cloud API para um
sistema de marcações de um salão de cabeleireiro. Trabalha no browser.

CONTEXTO
A VOUX é a minha empresa de software. A Nohora é a cliente, dona do
salão. A conta Meta fica no nome da VOUX; o número de WhatsApp é o da
Nohora, que ela já usa no WhatsApp Business no telemóvel dela.

O objetivo final é obter cinco valores que eu vou pôr no meu servidor.
Guarda-os à medida que os encontrares e devolve-mos todos no fim:

  WHATSAPP_PHONE_NUMBER_ID   o id do número (não é o número de telefone)
  WHATSAPP_ACCESS_TOKEN      token permanente de utilizador de sistema
  WHATSAPP_APP_SECRET        o App Secret da app Meta
  WHATSAPP_VERIFY_TOKEN      uma frase que TU inventas (guarda-a)
  CRON_SECRET                ignora este, é meu e gero-o eu

REGRAS
- Para quando precisares de mim: login, 2FA, código por SMS, verificação
  de identidade, e o passo do QR code. Diz exatamente o que precisas.
- Não inventes dados da empresa. Se um campo pedir morada, NIF, nome
  legal ou site e eu não to tiver dado, pergunta.
- Não pagues nada nem aceites planos pagos sem me perguntares primeiro.
- Se um ecrã não corresponder ao que descrevo abaixo, para e descreve-me
  o que vês. A Meta muda a interface com frequência — não adivinhes.

PASSO 1 — Business Portfolio
Vai a business.facebook.com e cria um novo portfólio de negócio no nome
da VOUX. Vai pedir nome legal, morada, site e email — pergunta-me esses
valores, não os inventes.
Não é preciso página de Facebook, conta de anúncios, nem verificação do
negócio nesta fase.

PASSO 2 — App Meta
Em developers.facebook.com, cria uma App do tipo Business e adiciona-lhe
o produto WhatsApp.
Em Definições > Básica, copia o App Secret (é o WHATSAPP_APP_SECRET).

PASSO 3 — Ligar o número (ATENÇÃO, é o passo mais importante)
No fluxo de configuração do WhatsApp, escolhe a opção de usar um número
QUE JÁ ESTÁ NO WHATSAPP BUSINESS — isto chama-se Coexistence.
NÃO escolhas "criar número novo" nem "registar um número novo". Se
escolheres essa, todo o trabalho fica errado e a cliente perde o
WhatsApp dela.
Este passo vai mostrar um QR code que tem de ser lido no telemóvel da
Nohora. Para aqui e avisa-me — eu trato dessa parte.

Se este ecrã pedir para escolher um "Solution Partner" ou "Tech
Provider", para e diz-me. É uma decisão minha e ainda não a tomei.

PASSO 4 — Os modelos de mensagem
No WhatsApp Manager > Modelos de mensagem, cria TRÊS modelos, cada um
com TRÊS traduções (pt_PT, en_US, es_ES). Na Meta isso é um nome só com
três línguas por baixo, e não nove modelos separados.

Categoria de TODOS: Utility. Nunca Marketing.

Os nomes têm de ser exatamente: confirm, reminder_eve, reminder_today

O texto de cada um vou-to colar a seguir a este prompt. Usa-o LETRA POR
LETRA, incluindo as linhas em branco, os asteriscos e a pontuação. Não
melhores o texto, não corrijas nada, não mudes maiúsculas. O que estiver
aprovado na Meta tem de ser idêntico ao que o meu sistema envia, ou os
envios falham com o erro 132005.

Quando a Meta pedir exemplos para os {{1}}, {{2}}, etc., usa os que eu
te dou junto com o texto.

PASSO 5 — Token permanente
Em Definições do negócio > Utilizadores > Utilizadores de sistema:
cria um utilizador de sistema, dá-lhe acesso à conta de WhatsApp, e gera
um token com as permissões whatsapp_business_messaging e
whatsapp_business_management.
Tem de ser este token, permanente. O token de teste que a Meta mostra
primeiro expira em 24 horas e não serve.

PASSO 6 — Webhook
Em developers.facebook.com > a App > WhatsApp > Configuração:
  URL de callback:        [EU DOU-TE O ENDEREÇO QUANDO CHEGARES AQUI]
  Token de verificação:   inventa uma frase e guarda-a
  Campo a subscrever:     messages

NO FIM
Devolve-me:
  1. Os quatro valores (phone number id, access token, app secret,
     verify token)
  2. O estado de aprovação de cada um dos nove modelos
  3. Tudo o que tenha corrido de forma diferente do que descrevi acima
```

---

## O que colar a seguir

O Cowork vai precisar do texto exato dos modelos. Corre isto:

```
node scripts/wa-modelos.mjs
```

Copia o resultado todo e cola no Cowork como segunda mensagem, logo a
seguir ao prompt.

## O que ele NÃO vai conseguir fazer

Fica com estes na mão:

- **Login, 2FA, SMS** — a autenticação é tua
- **O QR code do passo 3** — precisa do telemóvel da Nohora
- **A decisão BSP vs Tech Provider** — é tua, ver META.md passo 2
- **O endereço do webhook** — só depois do site publicado com o código
  novo

## Se ele fizer asneira

O erro caro é o passo 3: escolher "número novo" em vez de Coexistence.
Se isso acontecer, o número da Nohora sai do WhatsApp Business dela e
ela perde o acesso às conversas no telemóvel. O prompt avisa disso duas
vezes, mas confirma tu esse ecrã antes de ele avançar.

Os modelos são reversíveis — apaga-se e submete-se outra vez. O portfólio
também.
