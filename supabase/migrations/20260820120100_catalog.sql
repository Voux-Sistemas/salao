-- =====================================================================
-- 0002 · Catálogo: categorias, serviços, recursos consumidos e exceções
--        de preço/duração. O catálogo é da REDE.
-- =====================================================================

create table service_category (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  slug       text not null,
  name       text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table service (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references org(id) on delete cascade,
  category_id uuid not null references service_category(id) on delete restrict,

  slug        text not null,
  name        text not null,
  description text,

  base_price_cents int not null check (base_price_cents >= 0),
  duration_minutes int not null check (duration_minutes > 0),

  -- folgas (buffer) antes e depois: fazem parte do bloco de ocupação
  -- da profissional, mas não do horário que a cliente vê.
  buffer_before_minutes int not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes  int not null default 0 check (buffer_after_minutes >= 0),

  -- interruptor de "marcável online": desligado, some do funil público
  -- sem deixar de existir no balcão.
  bookable_online boolean not null default true,

  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, slug)
);
create trigger service_updated_at before update on service
  for each row execute function set_updated_at();
create index service_category_idx on service(category_id) where is_active;

-- Que tipos de recurso o serviço consome, e quantos de cada.
create table service_resource_requirement (
  service_id       uuid not null references service(id) on delete cascade,
  resource_type_id uuid not null references resource_type(id) on delete restrict,
  quantity         int  not null default 1 check (quantity > 0),
  primary key (service_id, resource_type_id)
);

-- ---------------------------------------------------------------------
-- Exceção de preço/duração.
-- Precedência (do mais específico para o mais genérico):
--   profissional + loja  ->  profissional  ->  loja  ->  preço-base
-- ---------------------------------------------------------------------
create table price_override (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  service_id uuid not null references service(id) on delete cascade,
  unit_id    uuid references unit(id) on delete cascade,
  staff_id   uuid, -- FK adicionada em 0003 (staff ainda não existe)

  price_cents      int check (price_cents >= 0),
  duration_minutes int check (duration_minutes > 0),

  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (unit_id is not null or staff_id is not null),
  check (price_cents is not null or duration_minutes is not null),
  unique nulls not distinct (service_id, unit_id, staff_id)
);
create trigger price_override_updated_at before update on price_override
  for each row execute function set_updated_at();
create index price_override_service_idx on price_override(service_id);
