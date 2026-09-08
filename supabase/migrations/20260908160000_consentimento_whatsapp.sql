-- ---------------------------------------------------------------------
-- QUEM NÃO QUER RECEBER, NÃO RECEBE
--
-- Enquanto era uma pessoa a carregar no botão, isto resolvia-se sozinho:
-- quem dissesse «não me mandem mais mensagens» era ouvido por quem
-- estava ao balcão, e não se carregava mais no botão para aquela ficha.
-- A regra vivia na cabeça da equipa, e chegava.
--
-- A partir do momento em que é o sistema a enviar, deixa de chegar. Um
-- relógio não ouve ninguém. Se a vontade da cliente não estiver escrita
-- numa coluna, o sistema passa por cima dela todas as noites às sete.
--
-- E NÃO É SÓ EDUCAÇÃO, É A LEI. A casa é europeia e isto é RGPD: uma
-- comunicação automatizada tem de poder ser recusada, e a recusa tem de
-- ser respeitada por todos os envios sem excepção.
--
-- Repetível, como todas as outras.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 1. A RECUSA
--
-- Uma data e não um booleano: «desde quando» responde a perguntas que
-- «sim ou não» não responde — se foi antes ou depois de uma queixa, se
-- foi ela a pedir no balcão ou a carregar em «parar» na mensagem.
--
-- Nulo é o normal: nunca recusou. Não se assume recusa por omissão,
-- porque a cliente que marca uma hora está à espera de ser avisada dela
-- — a confirmação de uma marcação não é publicidade.
-- ---------------------------------------------------------------------

alter table client
  add column if not exists whatsapp_opted_out_at timestamptz;

comment on column client.whatsapp_opted_out_at is
  'Quando pediu para não receber mensagens. Nulo = nunca pediu.';


-- ---------------------------------------------------------------------
-- 2. E PORQUE NÃO HÁ COLUNA DE «CONSENTIMENTO»
--
-- A pergunta óbvia é porque não existe aqui um `whatsapp_consent_at` ao
-- lado. A resposta é que já existe, com outro nome, e duplicá-lo era
-- criar duas verdades sobre o mesmo facto.
--
-- O consentimento para receber a confirmação de uma marcação É A
-- MARCAÇÃO. A cliente deu o número, escolheu a hora e carregou em
-- marcar; o `appointment.created_at` é o registo desse momento, com
-- data, hora e origem. Uma segunda coluna a dizer «e também consentiu»
-- não acrescentava prova nenhuma — repetia a que já lá está.
--
-- Isto vale para as mensagens de SERVIÇO, que são as duas que se
-- automatizam: a confirmação da marcação que ela própria fez, e o
-- lembrete da véspera dessa mesma marcação. São Utility na Meta pela
-- mesma razão por que são legítimas aqui: falam da coisa que ela pediu.
--
-- NÃO VALE PARA MARKETING. No dia em que a casa quiser mandar uma
-- promoção, isto não serve de base legal e é preciso um consentimento
-- explícito e separado — outra coluna, outra pergunta, outro ecrã. As
-- rotinas `review` e `winback` ficam à mão também por isto, e não só
-- por serem mais caras.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 3. ONDE A RECUSA É LIDA
--
-- Num sítio só: o `base()` do `lib/notices.ts`, que é a espinha das
-- cinco filas. Uma ficha com recusa sai da fila pela mesma porta por
-- onde já sai uma ficha sem telemóvel — e sai das cinco de uma vez,
-- incluindo as três que continuam a ser despachadas à mão.
--
-- Ficar fora da fila é a forma mais forte de a respeitar: não é o
-- envio que se trava, é a linha que deixa de aparecer a quem podia
-- carregar no botão. Ninguém tem de se lembrar da regra.
-- ---------------------------------------------------------------------

create index if not exists client_opt_out_idx
  on client(org_id)
  where whatsapp_opted_out_at is not null;


-- ---------------------------------------------------------------------
-- 4. A QUE HORAS SE MANDA O LEMBRETE DA VÉSPERA
--
-- Uma hora, e não uma escolha do programador. As 19:00 são um palpite
-- razoável — as clientes já saíram do trabalho e ainda não se deitaram
-- — mas quem sabe a que horas as suas clientes lêem o telemóvel é a
-- casa, e não eu.
--
-- POR LOJA, e não por rede: um salão numa zona de escritórios e outro
-- num bairro não têm o mesmo fim de tarde.
--
-- É a hora LOCAL DA LOJA. O relógio que dispara isto corre em UTC — é
-- uma função na Netlify — e a conversão faz-se lá, contra o `timezone`
-- que cada loja já tem. Guardar aqui uma hora UTC era guardar uma hora
-- que muda sozinha em Março e em Outubro.
-- ---------------------------------------------------------------------

alter table unit
  add column if not exists reminder_hour int not null default 19
    check (reminder_hour between 0 and 23);

comment on column unit.reminder_hour is
  'Hora local da loja a que sai o lembrete da véspera. 0-23.';
