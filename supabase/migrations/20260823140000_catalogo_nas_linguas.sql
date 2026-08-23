-- ---------------------------------------------------------------------
-- O catálogo nas três línguas.
--
-- A montra fala português, inglês e espanhol — mas só a moldura falava.
-- O texto que a cliente lê de facto são as sessenta e sete linhas do
-- preçário, e essas saíam da base de dados sempre em português: uma
-- inglesa mudava a língua no rodapé, o menu mudava à volta e o preçário
-- continuava a dizer "Descoloração raíz". Traduzir a moldura e deixar o
-- conteúdo é pior do que não traduzir nada, porque promete o que não
-- cumpre.
--
-- Uma coluna por língua, e não uma tabela de traduções: são três
-- línguas fixas, decididas no `lib/i18n/config.ts`, e uma tabela à
-- parte custaria um join em todas as consultas do preçário para
-- guardar o mesmo.
--
-- Nulo é o caso normal, não uma falha: um serviço criado ao balcão
-- amanhã nasce sem tradução e mostra-se em português a toda a gente,
-- como se mostrava antes. Quem quiser traduzi-lo escreve-o na ficha do
-- serviço, na gestão.
-- ---------------------------------------------------------------------

alter table service_category add column if not exists name_en text;
alter table service_category add column if not exists name_es text;

comment on column service_category.name_en is
  'Nome da categoria em inglês. Nulo = mostra o nome em português.';
comment on column service_category.name_es is
  'Nome da categoria em espanhol. Nulo = mostra o nome em português.';

alter table service add column if not exists name_en text;
alter table service add column if not exists name_es text;
alter table service add column if not exists description_en text;
alter table service add column if not exists description_es text;

comment on column service.name_en is
  'Nome do serviço em inglês. Nulo = mostra o nome em português.';
comment on column service.name_es is
  'Nome do serviço em espanhol. Nulo = mostra o nome em português.';

-- As traduções do preçário de casa não vivem aqui: vivem em
-- `scripts/catalogo-linguas.mjs`, que o `seed-real.mjs` escreve ao
-- semear e o `scripts/traduzir.mjs` aplica a uma base já semeada. Uma
-- migração que traz dados de um salão em particular deixa de servir
-- para o esquema.

-- ---------------------------------------------------------------------
-- Escolher a coluna certa sem repetir o `case` em cada consulta.
--
-- Devolve o texto na língua pedida e cai no português quando a tradução
-- é nula OU está em branco — um campo deixado vazio na gestão grava ''
-- e não `null`, e '' na montra é pior do que a palavra portuguesa.
-- ---------------------------------------------------------------------
create or replace function name_in(lang text, pt text, en text, es text)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(
    nullif(btrim(case lang when 'en' then en when 'es' then es end), ''),
    pt
  )
$$;

comment on function name_in(text, text, text, text) is
  'Texto na língua da cliente, com o português como rede.';
