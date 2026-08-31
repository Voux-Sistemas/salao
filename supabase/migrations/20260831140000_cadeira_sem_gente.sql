-- ---------------------------------------------------------------------
-- UMA CADEIRA NÃO É UMA PESSOA.
--
-- Ao domingo a casa vende horas antes de saber quem as vai fazer: a
-- dona sabe QUANTAS pessoas vão, não QUAIS. A saída encontrada foi criar
-- um perfil por cadeira — «Profissional 05» — dar-lhe as habilidades de
-- cabelo e uma escala de domingo, e repartir as marcações pelas pessoas
-- de verdade quando a escala se souber.
--
-- Funciona, e é a coisa certa a fazer. Mas o sistema não tem como saber
-- que aquele perfil não é gente, e por isso:
--
--   · a agenda mostra o nome da cadeira como mostraria o de uma colega,
--     e não se vê de relance o que ainda está por repartir;
--   · no fim do mês a produção e as comissões da cadeira não são de
--     ninguém, e ninguém foi avisado disso a tempo.
--
-- Esta coluna é a diferença. Uma linha na base, e a agenda passa a
-- dizer «por atribuir» em vez de um nome, o dia ganha um «passar todas
-- a…», e há como contar o que falta antes de o mês fechar.
--
-- NASCE FALSA PARA TODA A GENTE, que é o que toda a gente é. Marca-se à
-- mão na ficha, em «Mais detalhes», e só para os perfis que existem
-- para segurar horas.
-- ---------------------------------------------------------------------

alter table staff
  add column is_placeholder boolean not null default false;

comment on column staff.is_placeholder is
  'Perfil que existe para segurar horas até se saber quem as faz — uma cadeira, não uma pessoa. A agenda mostra-o como «por atribuir».';
