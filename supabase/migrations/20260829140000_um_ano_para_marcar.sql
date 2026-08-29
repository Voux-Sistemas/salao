-- ---------------------------------------------------------------------
-- UM ANO PARA MARCAR.
--
-- A cliente conseguia marcar até outubro e mais nada. Não era limite do
-- sistema: era o valor guardado em cada loja — sessenta dias — e o
-- calendário obedecia-lhe, parando a seta do mês quando lá chegava.
--
-- Quem quer marcar as madeixas de Dezembro em Setembro não podia. Numa
-- casa onde as clientes marcam a próxima ao sair desta, sessenta dias é
-- pouco: um brushing de casamento marca-se com meio ano de avanço.
--
-- TRÊS CENTOS E SESSENTA E CINCO, e não «sem limite»: um horizonte
-- infinito enche o calendário de meses que a casa não sabe se vai ter
-- equipa para cumprir, e uma marcação que ninguém consegue honrar é
-- pior do que uma marcação que não se fez.
-- ---------------------------------------------------------------------

update unit set max_lead_days = 365;

-- E as lojas que nascerem daqui para a frente nascem com o mesmo ano.
-- O valor de fábrica eram noventa dias, escrito quando o sistema ainda
-- não tinha calendário nenhum — só uma fita de sete dias, onde um ano
-- de horizonte não servia para nada.
alter table unit alter column max_lead_days set default 365;
