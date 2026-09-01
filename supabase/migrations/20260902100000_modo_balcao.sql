-- ---------------------------------------------------------------------
-- O MODO BALCÃO
--
-- A dona deixa o login dela aberto num tablet em cada salão, para as
-- funcionárias marcarem. Ela quase nunca lá está.
--
-- A trava NÃO é um cadeado no ecrã. É uma marca NESTA SESSÃO, lida pelo
-- servidor antes de responder seja o que for: escrever «/admin» na barra
-- não abre nada, porque quem recusa é o servidor e não o botão que está
-- escondido.
--
-- É por APARELHO e não por conta: o telemóvel dela continua inteiro,
-- cada tablet tem a sua marca, e ela pode trancar um à distância sem
-- tocar nos outros.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- CORRER ISTO DUAS VEZES NÃO PARTE NADA.
--
-- O `if not exists` está aqui por uma razão concreta: esta casa corre as
-- migrações à mão, no editor do Supabase, e um `alter table` com três
-- colunas falha INTEIRO se uma delas já lá estiver. Foi o que aconteceu
-- — a coluna nova ficou por acrescentar porque as duas velhas já
-- existiam, e a mensagem falava só da primeira.
--
-- Assim, colar o ficheiro todo é sempre seguro: o que falta entra, o
-- que já está fica quieto.
-- ---------------------------------------------------------------------

alter table session
  -- Quando esta sessão foi posta no balcão. Nulo = sessão normal.
  add column if not exists balcao_at timestamptz,
  -- Até quando é que a dona a destrancou aqui. Passado ou nulo = trancada.
  --
  -- É um INSTANTE e não um booleano de propósito: uma sessão destrancada
  -- volta ao balcão sozinha, sem depender de ninguém se lembrar de a
  -- fechar. Se dependesse, o tablet ficava aberto de par em par na
  -- terceira vez que ela se distraísse.
  add column if not exists elevado_ate timestamptz;

-- Só as poucas sessões de balcão interessam a estas perguntas.
create index if not exists session_balcao_idx on session (subject_id)
  where balcao_at is not null;

-- ---------------------------------------------------------------------
-- O CÓDIGO DO BALCÃO
--
-- Para o dia em que o tablet se desligar com ela noutro salão. As
-- funcionárias escrevem-no e o tablet volta ao balcão — e MAIS NADA.
--
-- APONTA AO CONTRÁRIO DE UMA SENHA: em vez de guardar o que está
-- fechado, abre só o que já podia estar aberto. É por isso que pode
-- andar escrito num papel ao lado do tablet: não dá acesso a nada que
-- as funcionárias não tenham ali à frente o dia todo.
--
-- Guardado com o mesmo `hashPassword` da equipa. Um código de seis
-- dígitos não tem entropia nenhuma — o que o protege é só abrir o
-- balcão, e a casa poder trocá-lo num gesto.
-- ---------------------------------------------------------------------

-- GUARDA-SE TAMBEM EM CLARO, como os codigos de entrada da cliente ja
-- fazem no `otp_code`. Um codigo que ela nao pode voltar a ver nao serve
-- de nada: quando o tablet se desligar ela esta noutro salao e precisa de
-- o ditar ao telefone. O que o torna aceitavel e o que ele abre — o
-- balcao, e nada mais. O resumo fica na mesma, porque e por ele que se
-- verifica.
alter table org
  add column if not exists balcao_code_hash text,
  add column if not exists balcao_code_plain text,
  add column if not exists balcao_code_set_at timestamptz;
