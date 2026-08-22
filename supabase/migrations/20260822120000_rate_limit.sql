-- =====================================================================
-- 0008 · Travão de repetição.
--
-- As portas públicas — entrar, pedir código, marcar — não tinham limite
-- nenhum. O código de uso único já só aceita cinco tentativas, mas nada
-- impedia pedir mil códigos: cinco tentativas vezes mil é outra coisa.
--
-- O contador vive na base de dados e não na memória do servidor, porque
-- em produção o servidor não é um só. Dois pedidos podem cair em duas
-- máquinas diferentes e têm de contar para o mesmo balde.
-- =====================================================================

create table if not exists rate_limit (
  bucket        text primary key,
  hits          int not null default 0,
  window_starts timestamptz not null default now()
);

-- Para a limpeza periódica encontrar os baldes velhos sem varrer tudo.
create index if not exists rate_limit_window_idx on rate_limit(window_starts);

-- ---------------------------------------------------------------------
-- Conta uma tentativa e diz se ela ainda cabe.
--
-- A janela é deslizante por reinício: passado o tempo, o balde esvazia e
-- recomeça do um. Tudo numa instrução só — o `on conflict` é atómico, e
-- é isso que o torna à prova de dois pedidos ao mesmo instante.
--
-- Devolve TRUE quando a tentativa é permitida, FALSE quando estourou.
-- ---------------------------------------------------------------------
create or replace function rate_limit_hit(
  p_bucket text,
  p_limit  int,
  p_window interval
) returns boolean
language plpgsql as $$
declare
  v_hits int;
begin
  insert into rate_limit (bucket, hits, window_starts)
       values (p_bucket, 1, now())
  on conflict (bucket) do update
     set hits = case
                  when rate_limit.window_starts < now() - p_window then 1
                  else rate_limit.hits + 1
                end,
         window_starts = case
                  when rate_limit.window_starts < now() - p_window then now()
                  else rate_limit.window_starts
                end
    returning hits into v_hits;

  return v_hits <= p_limit;
end $$;

-- ---------------------------------------------------------------------
-- Baldes que ninguém tocou há um dia não têm nada que ficar.
-- ---------------------------------------------------------------------
create or replace function purge_rate_limits() returns void
language sql as $$
  delete from rate_limit where window_starts < now() - interval '1 day';
$$;

-- ---------------------------------------------------------------------
-- A migração 0007 ligou a RLS às tabelas que existiam nessa altura.
-- Esta nasceu depois, por isso tranca-se a si própria.
-- ---------------------------------------------------------------------
alter table rate_limit enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.rate_limit from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.rate_limit from authenticated';
  end if;
end $$;
