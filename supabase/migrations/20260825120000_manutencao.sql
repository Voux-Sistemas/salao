-- ---------------------------------------------------------------------
-- FECHAR A CASA PARA OBRAS.
--
-- A meio de um deploy, o pior que pode acontecer é uma cliente estar a
-- meio de uma marcação: o funil guarda passos entre pedidos, e um
-- servidor que muda por baixo dela deixa-a com meia marcação feita e
-- nenhuma resposta. Isto é o interruptor que fecha a porta antes.
--
-- Guarda-se a HORA em que fechou, não um sim/não. Duas razões: quem
-- entra a seguir precisa de saber há quanto tempo está fechado — dez
-- minutos é obra, três horas é alguém que se esqueceu de desligar — e
-- um `null` diz «aberto» sem precisar de valor nenhum por omissão.
--
-- Fica na `org` e não numa tabela de definições porque é uma só linha
-- por rede, e uma tabela de uma linha é uma tabela a mais.
-- ---------------------------------------------------------------------

alter table org add column if not exists maintenance_since timestamptz;

-- O que dizer a quem bater à porta. Vazio mostra a frase de sempre.
alter table org add column if not exists maintenance_note text;
