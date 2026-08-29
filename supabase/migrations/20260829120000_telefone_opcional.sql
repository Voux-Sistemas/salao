-- ---------------------------------------------------------------------
-- O TELEFONE DEIXA DE SER OBRIGATÓRIO.
--
-- Nem toda a gente quer deixar o número para marcar um brushing, e a
-- dona não quer perder essas marcações. A partir daqui, uma ficha pode
-- nascer sem telefone.
--
-- O QUE ISTO CUSTA, ESCRITO AQUI PARA QUEM VIER A SEGUIR: o telefone
-- era a identidade da cliente — é ele que faz a mesma pessoa ser a
-- mesma ficha nas duas lojas. Uma ficha sem número não se reconhece na
-- visita seguinte: nasce outra. É o preço da porta aberta, e foi
-- aceite.
--
-- O `unique (org_id, phone)` FICA COMO ESTÁ. Em Postgres, dois nulos
-- não colidem num índice único: continuam a poder existir mil fichas
-- sem número, e continua a ser impossível haver duas com o mesmo.
-- ---------------------------------------------------------------------

alter table client alter column phone drop not null;

-- Um número em branco não é «sem número»: é uma linha que ocupa o lugar
-- da identidade sem servir para nada, e que ainda por cima colide com a
-- linha em branco seguinte. Se alguma entrou antes desta migração, sai
-- agora.
update client set phone = null where btrim(coalesce(phone, '')) = '';

-- E daqui para a frente é a base a garanti-lo, não a aplicação.
alter table client
  add constraint client_phone_nao_vazio
  check (phone is null or btrim(phone) <> '');
