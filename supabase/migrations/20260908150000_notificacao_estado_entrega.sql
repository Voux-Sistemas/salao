-- ---------------------------------------------------------------------
-- O QUE A META FEZ COM A MENSAGEM
--
-- O `notification_log` regista hoje uma coisa só: que ALGUÉM CARREGOU NO
-- BOTÃO. Isso bastava enquanto a mensagem saía pelo telemóvel de quem
-- estava ao balcão — o envio era um gesto humano, e um gesto humano ou
-- aconteceu ou não aconteceu.
--
-- Quando é o sistema a enviar, deixa de bastar. Entre «pedimos à Meta
-- que enviasse» e «a cliente leu» há quatro estados, e três formas de
-- correr mal — e nenhuma delas dá para adivinhar olhando para uma linha
-- que só sabe dizer a hora a que foi criada.
--
-- SÓ COLUNAS NOVAS, TODAS NULAS. Nada do que existe muda de forma: nem
-- uma coluna, nem o `unique (appointment_id, routine)` que é o único
-- guarda contra o aviso repetido. O código de hoje continua a escrever
-- exactamente como escrevia, e continua a funcionar exactamente como
-- funciona — as colunas novas ficam nulas e ninguém dá por elas.
--
-- Repetível de propósito: esta casa corre as migrações à mão, e colar o
-- mesmo ficheiro duas vezes tem de ser inofensivo.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 1. O NOME DA MENSAGEM DO LADO DA META
--
-- A Meta devolve um `wamid` a cada envio, e é por esse nome — e só por
-- esse — que os avisos de estado a identificam mais tarde. Sem o
-- guardar, um webhook que diga «a de id X foi lida» não tem forma de
-- saber a que marcação pertence.
--
-- Nulo quando foi uma pessoa a enviar pelo telemóvel: aí não há wamid
-- nenhum, porque a mensagem nunca passou pela Meta.
-- ---------------------------------------------------------------------

alter table notification_log
  add column if not exists provider_id text;

-- Por onde os webhooks entram: chega um wamid, procura-se a linha. Sem
-- isto, cada aviso de estado varre a tabela inteira.
--
-- Parcial porque a esmagadora maioria das linhas não tem wamid — só as
-- que passaram pela Meta contam para este índice.
create index if not exists notification_log_provider_idx
  on notification_log(provider_id)
  where provider_id is not null;


-- ---------------------------------------------------------------------
-- 2. EM QUE PÉ ESTÁ
--
-- Os cinco estados são os da Meta, e a ordem entre eles é real:
--
--   queued      pedimos, ainda não sabemos          (é nosso)
--   sent        a Meta aceitou e mandou             (dela)
--   delivered   chegou ao telemóvel                 (dela)
--   read        a cliente abriu                     (dela)
--   failed      não saiu, ou saiu e voltou          (dela ou nossa)
--
-- Um estado nulo NÃO É UM ESTADO EM FALTA: é uma linha das antigas, ou
-- uma que uma pessoa gravou ao carregar no botão. Essas não têm estado
-- de entrega porque nunca houve entrega para acompanhar — o telemóvel
-- de quem enviou é que sabe, e nunca nos disse.
--
-- O check aceita o nulo sem o dizer: em Postgres uma restrição só reprova
-- o que é falso, e `null in (...)` dá nulo, não falso. Não se acrescenta
-- `or delivery_state is null` — seria a repetir uma regra que a
-- linguagem já garante.
-- ---------------------------------------------------------------------

alter table notification_log
  add column if not exists delivery_state text;

-- Pergunta-se antes, em vez de tentar e apanhar o erro: um `exception
-- when duplicate_object` engolia calado qualquer outro engano na mesma
-- instrução. É a forma que o `rate_limit` já usa nesta casa.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'notification_log_delivery_state_check'
       and conrelid = 'public.notification_log'::regclass
  ) then
    alter table notification_log
      add constraint notification_log_delivery_state_check
      check (delivery_state in ('queued','sent','delivered','read','failed'));
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. O QUE CORREU MAL, POR PALAVRAS
--
-- Quando o estado é `failed`, isto diz porquê — e diz na forma que
-- interessa a quem tem de resolver, não em código de erro. «O número
-- não recebe» e «o modelo não foi aprovado» são a mesma falha para a
-- cliente e problemas completamente diferentes para nós.
--
-- Guarda-se o texto e não o número porque o número obriga a ir à
-- documentação da Meta para ter significado, e daqui a um ano essa
-- página já mudou.
-- ---------------------------------------------------------------------

alter table notification_log
  add column if not exists delivery_error text;


-- ---------------------------------------------------------------------
-- 4. AS DUAS HORAS QUE NÃO SÃO A DO ENVIO
--
-- O `sent_at` que já existe é a hora a que a linha nasceu — o momento
-- em que decidimos enviar. Não é a hora a que chegou, e muito menos a
-- hora a que foi lida: essas duas vêm da Meta, mais tarde, por webhook,
-- e podem vir horas depois se o telemóvel esteve desligado.
--
-- Três horas distintas, três colunas. Escrever a de chegada por cima da
-- de envio era perder a única prova de quando o sistema agiu.
-- ---------------------------------------------------------------------

alter table notification_log
  add column if not exists delivered_at timestamptz;

alter table notification_log
  add column if not exists read_at timestamptz;


-- ---------------------------------------------------------------------
-- 5. QUEM ENVIOU — E PORQUE NÃO FAZ FALTA COLUNA NENHUMA
--
-- O `sent_by_staff_id` já existe e já aceita nulo. A partir de agora
-- esse nulo passa a querer dizer uma coisa concreta:
--
--   preenchido   foi uma pessoa, ao balcão
--   nulo         foi o sistema
--
-- Não se acrescenta um `is_automatic` nenhum. Duas colunas a dizer o
-- mesmo facto é a forma mais certa de um dia discordarem uma da outra —
-- e então já não se sabe qual delas mente.
--
-- (Antes desta migração o nulo aparecia nas linhas do sistema de
-- semeadura, que não são de ninguém. Continuam a ler-se como
-- automáticas, e é o que são.)
-- ---------------------------------------------------------------------

comment on column notification_log.sent_by_staff_id is
  'Quem carregou no botão. Nulo = foi o sistema a enviar.';

comment on column notification_log.provider_id is
  'O wamid da Meta. Nulo = não passou pela Cloud API.';

comment on column notification_log.delivery_state is
  'queued|sent|delivered|read|failed. Nulo = envio manual, sem rasto.';
