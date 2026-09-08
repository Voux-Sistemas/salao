# O WhatsApp passa a enviar sozinho

Roteiro da integração com a WhatsApp Cloud API. Escrito antes de se
tocar em código, para que o que se vai partir esteja escrito antes de
partir.

Estado: **fases 1 e 2 feitas**. O sistema continua a comportar-se como sempre
— sem as variáveis de ambiente da Meta, nada disto se liga.

---

## 0 · O que isto contraria

Está escrito no topo do `lib/whatsapp.ts`, e é a regra que sustenta o
desenho actual dos avisos:

> O contacto com a cliente é por WhatsApp, e o sistema NÃO envia
> sozinho: prepara a mensagem e abre a conversa. Uma pessoa carrega no
> botão. Não há integração, não há trabalhador de fundo, não há estado
> para dessincronizar — há uma ligação wa.me e um registo de envio.

A casa pediu o contrário. Isto não se apaga: **passa a ser uma regra com
duas metades**, e a segunda metade é nova.

- **Confirmação e lembrete da véspera** saem sozinhos. São factos da
  marcação, previsíveis, e é aí que a casa perde tempo hoje.
- **Pedir avaliação e recuperar cliente** continuam à mão. São
  conversas, não avisos. Automatizar um pedido de avaliação é o começo
  do spam, e o número da casa é que paga a reputação.
- **O que falhar volta à mão.** O botão de hoje não desaparece: passa a
  ser a rede de segurança de quem não recebeu.

O `lib/notices.ts` fica. A fila-consulta é boa arquitectura e continua a
ser a fonte da verdade de "quem falta avisar". O que muda é **quem a
despacha**: hoje é uma pessoa, passa a ser também um relógio.

---

## 1 · O que a Meta obriga

Factos verificados em Setembro de 2026, não suposições.

### 1.1 Coexistence — o número dela continua no telemóvel dela

A migração clássica de um número para a Cloud API desliga-o da app do
WhatsApp. **Não é o único caminho.** Desde Maio de 2025 existe a
*Coexistence*: o mesmo número fica activo na app do WhatsApp Business
**e** na Cloud API ao mesmo tempo.

- Sincroniza até 6 meses de histórico e os contactos.
- A Nohora continua a conversar pelo telemóvel, como sempre.
- O sistema envia pelo mesmo número que as clientes já conhecem.
- O que a app envia aparece na API como *echo*, e vice-versa.
- Global desde Maio de 2026. Portugal incluído.

O que se perde ao ligar a Coexistence: listas de difusão, grupos pela
API, chamadas de voz/vídeo pela API, catálogo, *view once* e mensagens
temporárias. O débito fica travado em 20 mensagens por segundo — o que
para quatro lojas de um salão é folga a mais.

**É este o caminho.** Resolve o problema que não tinha solução: as
clientes recebem do número que conhecem, e ela não perde a ferramenta.

### 1.1.1 O que é preciso ter, e o que não é

Isto anda muito confundido. O que é mesmo obrigatório:

- **Meta Business Portfolio** (o antigo Business Manager), no nome da
  VOUX.
- **WhatsApp Business Account** dentro dele.
- O número **já a funcionar na app WhatsApp Business** — a app de
  empresa, não o WhatsApp normal.
- Um **BSP** para fazer o *Embedded Signup* da Coexistence.

O que **não** é preciso:

- **Conta de anúncios.** Não tem nada a ver com isto.
- **Página de Facebook.** Não é requisito da Cloud API. Só faz falta
  para o selo azul (*Official Business Account*) — que, de qualquer
  maneira, **não existe em Coexistence**. Quem quiser o selo tem de ir
  pelo *Meta Verified*, que é outra coisa e paga-se à parte.
- **Verificação do negócio.** Não bloqueia o arranque. Ver 1.1.3.

### 1.1.2 Duas condições que não estão à vista

**A conta tem de ter história.** A Meta decide a elegibilidade pela
idade da conta e pela qualidade das mensagens. Um número acabado de pôr
na app não entra. Se a Nohora usa o WhatsApp *normal* e não o Business,
tem de passar primeiro para o Business — e depois esperar.

**A app tem de ser aberta a cada 13 dias.** Se ficar mais tempo fechada,
a ligação cai e as mensagens deixam de sair. Para quem usa o telemóvel
todos os dias não é problema, mas é uma dependência que passa a viver no
telefone dela — e tem de ser dita à cliente.

### 1.1.3 O limite de 250, e porque não nos trava

Um portfolio **não verificado** começa com **250 conversas iniciadas por
24 horas**.

    600 marcações/mês ≈ 20/dia × 2 mensagens = ~40/dia

Cabe à vontade. **Arranca-se sem verificação**, que é imediata. A
verificação do negócio (documentos da empresa, dias de espera) sobe o
limite para 1.000 e depois desbloqueia sem tecto — trata-se dela em
paralelo, sem pressa, porque não bloqueia nada agora.

### 1.2 As mensagens têm de ser modelos aprovados

Fora de uma janela de conversa aberta, só se pode enviar um **template**
aprovado pela Meta. Os modelos que existem hoje em `DEFAULT_TEMPLATES`
não servem como estão: são texto livre.

Cada modelo tem de ser submetido e aprovado (categoria *Utility*, que é
a barata e a correcta — confirmações e lembretes não são marketing). A
aprovação demora de minutos a 24 horas. Um modelo reprovado não envia
nada.

O corpo do modelo usa marcadores posicionais (`{{1}}`, `{{2}}`), não os
nossos `{cliente}`. Isto obriga a uma tradução entre o que a casa
escreve e o que a Meta recebe — e é onde mora metade do trabalho da fase 3.

**Três modelos × três línguas = nove submissões.** A língua é um campo
do template na Meta, não texto nosso.

### 1.3 O preço, com a tarifa certa

O salão é em Portugal. A tarifa é a de *Rest of Western Europe*, em
euros — **não** a do Brasil, que foi usada num orçamento anterior e está
errada.

| Categoria | Por mensagem |
|---|---|
| Utility (o nosso caso) | ~0,0142 € |
| Marketing | ~0,0490 € |
| Authentication | ~0,0142 € |

**A partir de 1 de Outubro de 2026 a isenção da janela de 24 horas
acaba.** Até aí, uma utility enviada dentro de uma conversa aberta era
grátis. Deixa de ser. Qualquer conta que se faça daqui para a frente tem
de assumir **todas as mensagens pagas**.

Para 600 marcações/mês, com confirmação + lembrete:

    1200 mensagens × 0,0142 € = 17,04 €/mês

Dezassete euros. É o custo directo da Meta, sem BSP e sem margem. O
número anterior (R$ 52) morre aqui.

---

## 2 · As decisões já tomadas

- **Agendador:** Netlify Scheduled Functions. Já hospedam o projecto,
  não acrescenta fornecedor nem conta nova.
- **Conta Meta:** fica na VOUX, que revende à cliente.
- **Número:** por Coexistence, o número que o salão já usa.

---

## 3 · O caminho

Cada fase termina com o sistema a funcionar. Nenhuma fase deixa o
projecto num estado intermédio que não se possa entregar.

### Fase 1 · A porta para fora (sem enviar nada) — FEITA

Um módulo novo, `lib/whatsapp/cloud.ts`, que sabe falar com a Meta e
mais nada. Sem UI, sem agendador, sem tocar na fila.

- `sendTemplate()` — monta o pedido, trata dos erros com significado
  (número inválido, modelo reprovado, limite atingido), devolve o
  `wamid` ou uma falha tipada.
- Variáveis de ambiente novas, todas opcionais: sem elas o sistema
  comporta-se **exactamente como hoje**. É esta a rede que impede o
  projecto de partir enquanto isto não estiver pronto.
- Um script `scripts/wa-teste.mjs` que manda uma mensagem a um número
  nosso pela linha de comandos. É por aqui que se prova que a conta está
  bem ligada, antes de qualquer código de produção depender disso.

**Prova:** uma mensagem chega ao meu telemóvel. Zero linhas de UI mudadas.

### Fase 2 · O registo do que sai — FEITA

A tabela `notification_log` regista hoje que *alguém carregou no botão*.
Passa a ter de registar também *o que a Meta fez com a mensagem*.

Migração nova, só com colunas novas e todas nulas — **nada do que existe
muda de forma**, e o código actual continua a escrever como escrevia:

    channel          já existe, default 'whatsapp'
    provider_id      o wamid da Meta          (novo, nulo)
    delivery_state   queued|sent|delivered|read|failed  (novo, nulo)
    delivery_error   o que a Meta disse       (novo, nulo)
    delivered_at     (novo, nulo)
    read_at          (novo, nulo)
    sent_by_staff_id já existe — nulo passa a significar "foi o sistema"

Um `notification_log` com `sent_by_staff_id` nulo é um envio automático.
Não é preciso coluna nova para isso.

**Feito** em `supabase/migrations/20260908150000_notificacao_estado_entrega.sql`.
Além do que estava previsto, leva um índice parcial em `provider_id` —
é por ele que os webhooks da fase 6 encontram a linha a partir do wamid,
e sem ele cada aviso de estado varria a tabela toda.

**Prova:** `npm run typecheck` e `npm run build` passam. Só colunas
novas e nulas: nenhuma coluna existente muda, e o
`unique (appointment_id, routine)` — o único guarda contra o aviso
repetido — fica intacto. A repetibilidade é a da casa: `add column if
not exists`, `create index if not exists`, e a restrição dentro de um
`do $$ ... if not exists (select 1 from pg_constraint) ...`, o mesmo
padrão do `20260822120000_rate_limit.sql`.

**POR CORRER.** A migração está escrita mas ainda não foi aplicada a
lado nenhum — não há base local a correr nesta máquina, e contra a
Supabase não se corre sem alguém decidir. Aplica-se com:

    node scripts/_prod.mjs migrate --status    (só diz o que falta)
    node scripts/_prod.mjs migrate             (aplica)

Enquanto não correr, nada quebra: o código de hoje não lê nem escreve
nenhuma destas colunas.

### Fase 3 · Os modelos, dos dois lados

O `message_template` guarda o texto que a casa escreve. Passa a guardar
também o nome do modelo aprovado na Meta e a ordem dos marcadores.

- Submeter os nove modelos (3 rotinas × 3 línguas) na categoria Utility.
- Uma função que pega no nosso `{cliente}, {loja}, {dia}, {hora}` e
  produz o array de parâmetros posicionais que a Meta espera.
- **A ordem dos marcadores é um contrato.** Se a casa reescrever o texto
  e trocar a ordem, a mensagem sai trocada. A UI de gestão tem de
  impedir isso, não avisar depois.

**Prova:** uma confirmação real, com o modelo aprovado, chega formatada
como o `composeMessage` diz que devia chegar.

### Fase 4 · A confirmação sai sozinha

O primeiro envio automático. É o mais fácil dos dois: acontece no
momento da marcação, não precisa de relógio.

- No fim do `createAppointment`, depois de a transacção fechar.
- **Fora da transacção, sempre.** Se a Meta estiver em baixo, a marcação
  faz-se na mesma. Uma marcação perdida por causa de uma mensagem é o
  pior resultado possível.
- Falhou? Grava a falha e a linha **fica na fila** para alguém despachar
  à mão. Ninguém fica sem aviso em silêncio.

**Prova:** marco pelo site, o telemóvel apita, e a linha sai da fila de
«Confirmar» sozinha.

### Fase 5 · O relógio da véspera

A Netlify Scheduled Function. Corre de hora a hora, em UTC.

- O endpoint interno é protegido por segredo partilhado. Não é público.
- Para cada loja, no **fuso da loja**, pergunta: já são as 19:00 aqui?
  Uma função que corre em UTC não pode assumir a hora de Lisboa.
- Reaproveita o `loadQueue(unit, 'reminder_eve')` que já existe. É a
  mesma fila que a pessoa vê — não há duas verdades.
- **A trava contra o duplo envio é a que já existe:** o `unique
  (appointment_id, routine)` do `notification_log`. Grava-se antes de
  enviar; se a gravação falhar por conflito, é porque já foi. Duas
  execuções em simultâneo não mandam duas mensagens.
- A hora é da casa, configurável por loja. As 19:00 são um exemplo.

**Prova:** o lembrete chega às 19:00 sem ninguém lá estar. Corro a
função duas vezes seguidas e a cliente recebe uma mensagem só.

### Fase 6 · O que a Meta responde

Um webhook em `app/api/whatsapp/webhook/route.ts`.

- `GET` para a verificação inicial da Meta (o *challenge*).
- `POST` para os estados: entregue, lida, falhada.
- **A assinatura tem de ser verificada** (`X-Hub-Signature-256`). Um
  webhook aberto é uma porta aberta.
- Uma mensagem falhada volta à fila. Uma lida actualiza a linha.

**Prova:** mando uma mensagem, leio-a no telemóvel, e o balcão passa a
dizer «lida» sem eu recarregar nada.

### Fase 7 · O balcão passa a mostrar isto

A página de avisos deixa de ser só uma fila: passa a ser fila **e**
registo.

- As rotinas automáticas mostram o estado por marcação.
- O que falhou fica em destaque, com o botão de hoje ao lado.
- «Pedir avaliação» e «Recuperar cliente» ficam exactamente como estão.
- A faixa que hoje diz «O sistema nunca envia nada sozinho» tem de ser
  reescrita. Passa a dizer o que é verdade.

**Prova:** a pré-visualização que se mostrou à cliente e o ecrã real
dizem a mesma coisa.

### Fase 8 · O que a lei obriga

Não é opcional e não é o fim da lista por ser menos importante.

- **Opt-out.** Toda a mensagem tem de permitir parar de as receber. Um
  campo na ficha da cliente, respeitado por todos os envios.
- **Consentimento.** Tem de haver registo de que a cliente aceitou
  receber. O sítio é o funil de marcação.
- É RGPD, e a casa é europeia.

**Prova:** uma cliente com opt-out não recebe nada, e isso vê-se na
ficha dela.

---

## 4 · O que só tu podes fazer

Nada disto é código. Sem isto, as fases 3 em diante ficam paradas.

Por ordem. O primeiro ponto pode matar o plano todo, por isso é o
primeiro.

1. **Perguntar à Nohora qual app ela usa.** O WhatsApp *Business* (a
   app de empresa) ou o WhatsApp normal? Se for o normal, a Coexistence
   não está disponível já: tem de passar para o Business e ganhar
   história antes de ser elegível. **Confirma isto antes de tudo o
   resto.**
2. **Criar o Meta Business Portfolio** no nome da VOUX. Não é preciso
   verificar o negócio para arrancar (ver 1.1.3) — a verificação faz-se
   em paralelo, sem pressa.
3. **Escolher o BSP** que faz o Embedded Signup da Coexistence.
4. **Avisar a Nohora de duas coisas:** que perde as listas de difusão, e
   que tem de abrir a app pelo menos de 13 em 13 dias ou os envios
   param.
5. **Decidir a hora do lembrete.** As 19:00 são um palpite meu.
6. **Confirmar o preço à cliente:** ~17 €/mês de custo Meta para 600
   marcações, mais a vossa margem.

Não é preciso: conta de anúncios, página de Facebook, nem verificação do
negócio para começar.

---

## 5 · O que eu não vou fazer sem te perguntar

- Enviar seja o que for para um número real de uma cliente.
- Mudar o comportamento do balcão antes da fase 7.
- Automatizar «avaliação» ou «recuperar cliente».
- Tocar no `lib/notices.ts` de forma que mude o que a fila mostra hoje.
