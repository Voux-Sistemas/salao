-- ---------------------------------------------------------------------
-- PRECISÃO E ENCAIXE
--
-- Este salão trabalha de outra maneira, e o sistema estava a impedi-lo.
--
-- 1. DUAS CLIENTES AO MESMO TEMPO. A `staff_block` tinha uma restrição
--    de exclusão — uma profissional, um horário, e a base recusava tudo
--    o resto. É a trava certa para um salão que atende uma de cada vez;
--    é a trava errada para este, onde a raiz de uma coloração repousa
--    quarenta minutos e nesse intervalo cabe um corte inteiro. A
--    restrição sai. A trava passa a viver no motor, que continua a
--    tratar a profissional como ocupada para quem marca pelo SITE — a
--    sobreposição é uma decisão de quem está ao balcão a olhar para a
--    pessoa, não um acidente de quem marca pelo telemóvel às duas da
--    manhã.
--
-- 2. AS FOLGAS SAEM. Cada serviço reservava um bocado antes e outro
--    depois. É tempo real numa casa que precisa de arrumar entre
--    clientes; aqui é tempo perdido no livro, e era ele que fazia um
--    corte de trinta minutos ocupar quarenta e cinco.
--
-- 3. A ANTECEDÊNCIA MÍNIMA SAI. Duas horas de aviso protegem uma casa
--    que não quer ser apanhada de surpresa. Esta quer: se são 17h58 e
--    há vaga às 18h, a vaga é para vender. O que não se marca é o
--    passado, e isso o motor já sabe.
--
-- 4. A GRELHA APERTA — MAS SÓ AO BALCÃO. Os horários eram oferecidos de
--    quinze em quinze minutos, e uma vaga que começasse às 17h50 só
--    aparecia às 18h. Ao balcão passam a ser cinco, mais a hora exacta
--    de agora; no site ficam os quinze, senão a página das horas viram
--    cento e trinta botões. Isto decide-se no motor, por canal — a
--    coluna da loja continua a valer para o site.
-- ---------------------------------------------------------------------

-- 1 -------------------------------------------------------------------
-- A restrição de exclusão sai, e com ela o índice GiST que a servia.
-- O `staff_block` continua a existir e a ser escrito: é ele que diz à
-- agenda e ao site quem está ocupado. O que deixa de fazer é RECUSAR.
alter table staff_block drop constraint if exists staff_block_staff_id_during_excl;

-- Sem a restrição, as consultas de ocupação perdem o índice que as
-- servia. Este devolve-lho — sem exclusividade, só para procurar.
create index if not exists staff_block_staff_during_idx
  on staff_block using gist (staff_id, during);

-- O recurso físico NÃO se duplica. Uma profissional desdobra-se entre
-- duas cadeiras; um lavatório não se parte ao meio. A restrição da
-- `resource_block` fica exactamente como estava.

-- 2 -------------------------------------------------------------------
-- As folgas de todos os serviços a zero, e o valor por omissão também:
-- um serviço novo nasce sem folga, como os outros.
update service
   set buffer_before_minutes = 0,
       buffer_after_minutes  = 0
 where buffer_before_minutes <> 0
    or buffer_after_minutes  <> 0;

alter table service alter column buffer_before_minutes set default 0;
alter table service alter column buffer_after_minutes  set default 0;

-- As marcações que já estão no livro guardam a folga com que foram
-- feitas — mudar o passado seria reescrever o que aconteceu. Só as
-- FUTURAS se endireitam, e com elas os blocos que ocupam a agenda.
update appointment_item ai
   set buffer_before_minutes = 0,
       buffer_after_minutes  = 0
  from appointment a
 where a.id = ai.appointment_id
   and ai.starts_at >= now()
   and (ai.buffer_before_minutes <> 0 or ai.buffer_after_minutes <> 0);

-- O bloco volta a ser exactamente o serviço: sem as folgas à volta, o
-- tempo que sobra à profissional é o tempo que ela tem mesmo.
update staff_block sb
   set during = tstzrange(ai.starts_at, ai.ends_at, '[)')
  from appointment_item ai
 where ai.id = sb.appointment_item_id
   and ai.starts_at >= now()
   and sb.during <> tstzrange(ai.starts_at, ai.ends_at, '[)');

update resource_block rb
   set during = tstzrange(ai.starts_at, ai.ends_at, '[)')
  from appointment_item ai
 where ai.id = rb.appointment_item_id
   and ai.starts_at >= now()
   and rb.during <> tstzrange(ai.starts_at, ai.ends_at, '[)');

-- 3 -------------------------------------------------------------------
-- Sem antecedência mínima: o piso passa a ser o relógio.
--
-- A `slot_granularity_minutes` NÃO se toca. Ela é a grelha do site, e
-- quinze minutos é o que mantém a página das horas legível. A grelha
-- apertada do balcão é decidida no motor, por canal.
update unit
   set min_lead_minutes = 0
 where min_lead_minutes <> 0;

alter table unit alter column min_lead_minutes set default 0;
