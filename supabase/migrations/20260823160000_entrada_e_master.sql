-- ---------------------------------------------------------------------
-- A ENTRADA DEIXA DE SER O TELEMÓVEL, E NASCE UM DEGRAU ACIMA DA DONA.
--
-- Duas coisas que andavam juntas e por isso vêm juntas.
--
-- Primeira: até aqui a equipa entrava pelo telemóvel, porque o telemóvel
-- já era a identidade da cliente e pareceu natural que fosse a de toda a
-- gente. Não é. O telemóvel é para falar com a pessoa — muda de operadora,
-- muda de país, e não é coisa que se escreva vinte vezes por dia. Cada
-- pessoa passa a poder ter um nome de entrada seu, qualquer texto, e o
-- telemóvel volta a ser só o telemóvel.
--
-- Fica NULO por omissão e a porta continua a aceitar o telemóvel, por
-- isso ninguém fica de fora enquanto não se escrever nome nenhum.
--
-- Segunda: acima da dona passa a haver quem monta o sistema. A dona faz
-- a gestão da casa dela toda — equipa, catálogo, preços, comissões,
-- caixa — mas abrir e fechar unidades mexe na forma do sistema, não na
-- operação do salão, e isso fica de fora.
-- ---------------------------------------------------------------------

-- --- o nome de entrada -----------------------------------------------

alter table staff add column if not exists login text;

/*
 * `lower()` no índice porque «Admin» e «admin» têm de ser a mesma pessoa
 * — ninguém se lembra de como escreveu o próprio nome de entrada. E
 * `where login is not null` para que os nulos não colidam entre si:
 * enquanto ninguém escolher nome, toda a gente tem nulo.
 */
create unique index if not exists staff_login_idx
  on staff (org_id, lower(login))
  where login is not null;

-- Nome de entrada vazio é o mesmo que não ter. Sem isto, dois espaços em
-- branco passavam pelo índice como valores distintos.
alter table staff drop constraint if exists staff_login_check;
alter table staff add constraint staff_login_check
  check (login is null or length(btrim(login)) >= 3);

-- --- o degrau novo ----------------------------------------------------

alter table staff_role drop constraint if exists staff_role_role_check;
alter table staff_role add constraint staff_role_role_check
  check (role in ('master', 'owner', 'manager', 'professional'));

-- Quem está acima da loja não se prende a nenhuma: master e dona são
-- sempre escopo rede, como a dona já era.
alter table staff_role drop constraint if exists staff_role_check;
alter table staff_role add constraint staff_role_check
  check (role not in ('master', 'owner') or unit_id is null);
