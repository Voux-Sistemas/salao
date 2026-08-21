-- =====================================================================
-- 0007 · Funções de precedência e fecho de acesso.
--
-- As duas regras de precedência do sistema vivem aqui, em SQL, para
-- existirem num sítio só:
--   preço/duração:  profissional+loja -> profissional -> loja -> base
--   comissão:       profissional+serviço -> profissional -> serviço -> casa
-- =====================================================================

-- ---------------------------------------------------------------------
-- Preço e duração efectivos de um serviço para (loja, profissional).
-- Cada campo resolve-se independentemente pelo mais específico que o
-- preencha; se ninguém preencher, cai no valor-base do serviço.
-- ---------------------------------------------------------------------
create or replace function effective_service_pricing(
  p_service uuid,
  p_unit    uuid,
  p_staff   uuid
) returns table (price_cents int, duration_minutes int)
language sql stable as $$
  with ranked as (
    select
      po.price_cents,
      po.duration_minutes,
      case
        when po.staff_id is not null and po.unit_id is not null then 3
        when po.staff_id is not null then 2
        else 1
      end as specificity
    from price_override po
    where po.service_id = p_service
      and (po.unit_id  is null or po.unit_id  = p_unit)
      and (po.staff_id is null or po.staff_id = p_staff)
  )
  select
    coalesce(
      (select r.price_cents from ranked r
        where r.price_cents is not null
        order by r.specificity desc limit 1),
      s.base_price_cents
    ),
    coalesce(
      (select r.duration_minutes from ranked r
        where r.duration_minutes is not null
        order by r.specificity desc limit 1),
      s.duration_minutes
    )
  from service s
  where s.id = p_service;
$$;

-- ---------------------------------------------------------------------
-- Percentagem de comissão efectiva. Nulo = não há sequer regra da casa
-- (a aplicação trata como zero e não gera entrada).
-- ---------------------------------------------------------------------
create or replace function effective_commission_percent(
  p_org     uuid,
  p_staff   uuid,
  p_service uuid
) returns numeric
language sql stable as $$
  select cr.percent
  from commission_rule cr
  where cr.org_id = p_org
    and (cr.staff_id   is null or cr.staff_id   = p_staff)
    and (cr.service_id is null or cr.service_id = p_service)
  order by
    case
      when cr.staff_id is not null and cr.service_id is not null then 3
      when cr.staff_id is not null then 2
      when cr.service_id is not null then 1
      else 0
    end desc
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Fecho de acesso.
-- A aplicação fala com a base de dados por ligação directa (papel dono
-- da tabela), nunca pela API pública. Liga-se RLS sem políticas: quem
-- chegar por PostgREST com a chave anónima não vê nada.
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
  end if;
end $$;
