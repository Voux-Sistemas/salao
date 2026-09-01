-- ---------------------------------------------------------------------
-- ONDE É QUE ESTE APARELHO ESTÁ
--
-- Na lista dos aparelhos, «iPad · visto há 4 min» não chega: com um
-- tablet em cada salão, ela precisa de saber QUAL. Sem isso, trancar um
-- à distância é escolher à sorte.
--
-- NÃO É GEOGRAFIA, É A LOJA — e é melhor assim. Uma cidade tirada do
-- endereço de rede mente: numa rede móvel dá o nó da operadora, numa
-- fixa dá a central do fornecedor, e um salão em Valongo aparecia como
-- «Porto». Uma cidade errada é pior do que nenhuma, porque ela decidia
-- com ela.
--
-- A loja é o que a casa já sabe de certeza: é a agenda que aquele
-- aparelho abriu da última vez.
--
-- `on delete set null` porque uma loja pode fechar, e uma sessão que
-- ficou a apontar para ela continua a ser uma sessão válida.
-- ---------------------------------------------------------------------

-- Repetível, pela mesma razão que a migração anterior: esta casa corre
-- as migrações à mão, e colar o mesmo ficheiro duas vezes tem de ser
-- inofensivo.
alter table session
  add column if not exists last_unit_id uuid
    references unit(id) on delete set null;
