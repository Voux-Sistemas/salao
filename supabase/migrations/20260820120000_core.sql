-- =====================================================================
-- 0001 · Núcleo: extensões, rede, lojas, horários, recursos físicos
-- Convenções globais:
--   · Dinheiro é sempre inteiro em cêntimos (nunca vírgula flutuante).
--   · Instantes são sempre timestamptz (UTC); converte-se na borda com
--     o fuso da loja (unit.timezone), nunca com o do servidor.
--   · Horas-do-dia recorrentes guardam-se em minutos desde a meia-noite
--     (0..1440) para permitir aritmética e restrições de sobreposição.
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Utilitário: updated_at
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- A rede (organização). Uma linha. Catálogo e equipa pertencem-lhe.
-- ---------------------------------------------------------------------
create table org (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null,
  slug             text        not null unique,
  timezone         text        not null default 'Europe/Lisbon',
  currency         text        not null default 'EUR',
  default_language text        not null default 'pt' check (default_language in ('pt','en','es')),
  whatsapp_phone   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger org_updated_at before update on org
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Loja (unidade). O horário, o preço e a agenda podem variar por loja.
-- ---------------------------------------------------------------------
create table unit (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references org(id) on delete cascade,

  slug   text not null,
  name   text not null,
  timezone text not null,

  address_line text,
  postal_code  text,
  city         text,
  country      text default 'PT',
  latitude     numeric(9,6),
  longitude    numeric(9,6),

  phone          text,
  email          text,
  whatsapp_phone text,

  -- Regras de marcação (1.3)
  min_lead_minutes          int not null default 120  check (min_lead_minutes >= 0),
  max_lead_days             int not null default 90   check (max_lead_days > 0),
  slot_granularity_minutes  int not null default 15   check (slot_granularity_minutes between 5 and 120),
  gap_between_services_minutes int not null default 0 check (gap_between_services_minutes >= 0),
  cancel_window_hours       int not null default 24   check (cancel_window_hours >= 0),
  -- estratégia para "sem preferência"
  assignment_strategy text not null default 'balance_load'
    check (assignment_strategy in ('balance_load','first_available','least_busy_week')),

  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, slug)
);
create trigger unit_updated_at before update on unit
  for each row execute function set_updated_at();
create index unit_org_idx on unit(org_id) where is_active;

-- Fotos da loja
create table unit_photo (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references unit(id) on delete cascade,
  url        text not null,
  alt        text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index unit_photo_unit_idx on unit_photo(unit_id, sort_order);

-- ---------------------------------------------------------------------
-- Horário de funcionamento: por dia da semana, várias faixas no mesmo
-- dia (é assim que se representa a pausa de almoço).
-- weekday: 0=domingo .. 6=sábado (igual ao Date#getDay do JS).
-- ---------------------------------------------------------------------
create table business_hours (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references unit(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  opens_min  int not null check (opens_min between 0 and 1440),
  closes_min int not null check (closes_min between 0 and 1440),
  check (closes_min > opens_min),
  -- duas faixas do mesmo dia não se podem sobrepor
  exclude using gist (
    unit_id with =,
    weekday with =,
    int4range(opens_min, closes_min) with &&
  )
);
create index business_hours_unit_idx on business_hours(unit_id, weekday);

-- ---------------------------------------------------------------------
-- Feriados e horários especiais. Se existir QUALQUER linha para a data,
-- ela substitui por completo o horário normal desse dia.
--   is_closed = true  -> fechado o dia todo (opens/closes ficam nulos)
--   is_closed = false -> faixa especial (podem existir várias)
-- ---------------------------------------------------------------------
create table special_hours (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references unit(id) on delete cascade,
  on_date    date not null,
  is_closed  boolean not null default false,
  opens_min  int check (opens_min between 0 and 1440),
  closes_min int check (closes_min between 0 and 1440),
  note       text,
  created_at timestamptz not null default now(),
  check (
    (is_closed and opens_min is null and closes_min is null)
    or (not is_closed and opens_min is not null and closes_min is not null and closes_min > opens_min)
  ),
  exclude using gist (
    unit_id with =,
    on_date with =,
    int4range(coalesce(opens_min, 0), coalesce(closes_min, 1440)) with &&
  )
);
create index special_hours_unit_date_idx on special_hours(unit_id, on_date);

-- ---------------------------------------------------------------------
-- Recursos físicos: o TIPO é da rede, a INSTÂNCIA é da loja.
-- (duas cabines na loja A = duas linhas em resource)
-- ---------------------------------------------------------------------
create table resource_type (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  slug       text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table resource (
  id               uuid primary key default gen_random_uuid(),
  unit_id          uuid not null references unit(id) on delete cascade,
  resource_type_id uuid not null references resource_type(id) on delete restrict,
  name             text not null,
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index resource_unit_type_idx on resource(unit_id, resource_type_id) where is_active;
