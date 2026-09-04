-- ---------------------------------------------------------------------
-- A CLIENTE RESOLVE SOZINHA
--
-- Uma cliente quis desmarcar, pediu o código para entrar na área dela, e
-- ficou a olhar para seis quadrados vazios: o sistema não tem canal
-- automático nenhum, e o código fica no balcão à espera que alguém o
-- mande. Ninguém tem tempo para o mandar.
--
-- Três coisas, e nenhuma precisa de uma pessoa do salão.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 1. A CHAVE DA MARCAÇÃO
--
-- Uma marcação passa a ter uma chave própria, que vai num link na página
-- do «pronto»: `…/m/K7f2p9xQ…`. Ela guarda-o e abre aquela marcação de
-- qualquer aparelho, sem entrar em conta nenhuma.
--
-- É UMA CHAVE AO PORTADOR, e isso é escolha: quem tiver o link pode
-- desmarcar AQUELA marcação. É o mesmo que um link de confirmação de um
-- hotel, e o que está do outro lado é uma marcação — não a conta, não as
-- outras clientes, não o salão.
--
-- `unique` porque é por ela que se procura, e nula nas que já existem:
-- as marcações antigas continuam a funcionar como sempre, só não têm
-- link. Nasce com cada marcação nova.
-- ---------------------------------------------------------------------

alter table appointment
  add column if not exists manage_token text;

create unique index if not exists appointment_manage_token_idx
  on appointment (manage_token)
  where manage_token is not null;


-- ---------------------------------------------------------------------
-- 2. REMARCAR PODE SER MAIS PERTO DA HORA DO QUE DESMARCAR
--
-- Parece ao contrário e não é. Uma cliente que às 20 h da véspera já não
-- pode desmarcar NÃO VEM À MESMA — falta, e a casa perde a hora e o
-- dinheiro. Se puder remarcar, a casa perde a hora e mantém o dinheiro,
-- noutro dia. Entre uma falta e uma mudança, a casa quer a mudança.
--
-- Por isso a janela de remarcar é sua, e curta: quinze minutos, escolha
-- da casa. Fica em MINUTOS e não em horas porque o número que a dona
-- pediu não se escreve em horas.
--
-- A janela de desmarcar continua onde estava, em `cancel_window_hours`.
-- ---------------------------------------------------------------------

alter table unit
  add column if not exists reschedule_window_minutes int not null default 15;


-- ---------------------------------------------------------------------
-- 3. AS FICHAS QUE FICARAM COM O PAÍS ERRADO
--
-- O `normalisePhone` adivinhava se um número já trazia indicativo
-- olhando só para os dígitos, e seis regiões de Portugal colidem com
-- indicativos de outros países:
--
--     212 Lisboa → Marrocos          245 Ponte de Sor → Guiné-Bissau
--     238 Seia   → Cabo Verde        258 Viana        → Moçambique
--     239 Coimbra→ São Tomé          291 MADEIRA      → país nenhum
--
-- Ficaram guardados como «+212345678» em vez de «+351212345678» — e a
-- mesma pessoa a escrever o número de outra maneira criava uma segunda
-- ficha, sem ninguém dar por isso.
--
-- COMO SE DISTINGUE DE UM NÚMERO ESTRANGEIRO A SÉRIO: pelo comprimento.
-- Um E.164 verdadeiro traz o indicativo mais o número nacional — um
-- marroquino são doze dígitos, um francês onze. NOVE dígitos ao todo não
-- é um número internacional de país nenhum: é um número português a que
-- faltou o «351».
--
-- Corre-se duas vezes sem perigo: depois de reparado passa a ter doze
-- dígitos e deixa de bater na condição.
-- ---------------------------------------------------------------------

-- Antes de reparar, VER. Descomenta para conferir o que vai mudar:
--
--   select id, name, phone, '+351' || regexp_replace(phone, '\D', '', 'g') as fica
--     from client
--    where length(regexp_replace(phone, '\D', '', 'g')) = 9
--    order by name;

update client
   set phone = '+351' || regexp_replace(phone, '\D', '', 'g')
 where phone is not null
   and length(regexp_replace(phone, '\D', '', 'g')) = 9;

update staff
   set phone = '+351' || regexp_replace(phone, '\D', '', 'g')
 where phone is not null
   and length(regexp_replace(phone, '\D', '', 'g')) = 9;
