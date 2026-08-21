-- =====================================================================
-- 0004 · Marcação: o envelope, os seus itens, os blocos de ocupação e
--        o registo de mudanças de estado.
--
-- Invariantes que este ficheiro sustenta:
--   · "Horário ocupado" = "existe bloco". Cancelar APAGA os blocos;
--     não existe bloco cancelado para filtrar em cada consulta.
--   · Overbooking é problema da base de dados: as restrições de
--     exclusão abaixo é que são a trava definitiva, não a aplicação.
--   · Preço e duração ficam CONGELADOS no item no momento em que se
--     marca. Mexer na tabela de preços nunca reescreve o passado.
-- =====================================================================

create table appointment (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references org(id) on delete cascade,
  unit_id uuid not null references unit(id) on delete restrict,

  client_id uuid not null references client(id) on delete restrict,

  status text not null default 'booked' check (status in (
    'booked','confirmed','checked_in','in_service','completed',
    'cancelled_by_client','cancelled_by_salon','no_show'
  )),
  source text not null default 'site' check (source in (
    'site','counter','phone','whatsapp','walk_in'
  )),

  -- envelope: do início do primeiro serviço ao fim do último
  starts_at timestamptz not null,
  ends_at   timestamptz not null,

  client_note   text,   -- observação escrita pela cliente
  internal_note text,   -- nunca visível à cliente
  language      text not null default 'pt' check (language in ('pt','en','es')),

  -- remarcar é criar uma marcação nova a apontar para a antiga
  rescheduled_from_id uuid references appointment(id) on delete set null,

  -- desconto: no máximo um por marcação, com motivo e autor.
  -- não mexe no preço congelado dos itens; é abatido por cima.
  discount_cents       int not null default 0 check (discount_cents >= 0),
  discount_reason      text,
  discount_by_staff_id uuid references staff(id) on delete set null,
  discount_at          timestamptz,

  -- fecho da comanda: trava novos pagamentos e descontos,
  -- e é o gatilho das comissões
  closed_at          timestamptz,
  closed_by_staff_id uuid references staff(id) on delete set null,

  created_by_staff_id uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ends_at > starts_at),
  check (discount_cents = 0 or discount_reason is not null)
);
create trigger appointment_updated_at before update on appointment
  for each row execute function set_updated_at();
create index appointment_unit_day_idx on appointment(unit_id, starts_at);
create index appointment_client_idx on appointment(client_id, starts_at desc);
create index appointment_status_idx on appointment(status, starts_at);
create unique index appointment_rescheduled_from_idx
  on appointment(rescheduled_from_id) where rescheduled_from_id is not null;

-- ---------------------------------------------------------------------
-- Itens: cada serviço dentro da marcação guarda a SUA profissional, o
-- SEU horário, o SEU preço e a SUA duração.
-- ---------------------------------------------------------------------
create table appointment_item (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointment(id) on delete cascade,
  service_id     uuid not null references service(id) on delete restrict,
  staff_id       uuid not null references staff(id) on delete restrict,

  starts_at timestamptz not null,   -- horário do serviço (sem as folgas)
  ends_at   timestamptz not null,

  price_cents      int not null check (price_cents >= 0),   -- congelado
  duration_minutes int not null check (duration_minutes > 0),-- congelado
  service_name     text not null,                            -- congelado

  buffer_before_minutes int not null default 0,
  buffer_after_minutes  int not null default 0,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointment_item_appointment_idx on appointment_item(appointment_id, sort_order);
create index appointment_item_staff_day_idx on appointment_item(staff_id, starts_at);

-- ---------------------------------------------------------------------
-- Bloco de ocupação da profissional. Inclui as folgas (buffers) do
-- serviço: a cliente vê o horário do serviço, a agenda ocupa o bloco.
-- A restrição de exclusão é a trava definitiva contra overbooking.
-- ---------------------------------------------------------------------
create table staff_block (
  id                  uuid primary key default gen_random_uuid(),
  staff_id            uuid not null references staff(id) on delete cascade,
  unit_id             uuid not null references unit(id) on delete cascade,
  appointment_item_id uuid not null references appointment_item(id) on delete cascade,
  during              tstzrange not null,
  created_at          timestamptz not null default now(),
  exclude using gist (staff_id with =, during with &&)
);
create index staff_block_unit_idx on staff_block using gist (unit_id, during);
create index staff_block_item_idx on staff_block(appointment_item_id);

-- ---------------------------------------------------------------------
-- Bloco de ocupação do recurso físico. Sem isto, duas colorações
-- agendam para o mesmo lavatório.
-- ---------------------------------------------------------------------
create table resource_block (
  id                  uuid primary key default gen_random_uuid(),
  resource_id         uuid not null references resource(id) on delete cascade,
  appointment_item_id uuid not null references appointment_item(id) on delete cascade,
  during              tstzrange not null,
  created_at          timestamptz not null default now(),
  exclude using gist (resource_id with =, during with &&)
);
create index resource_block_item_idx on resource_block(appointment_item_id);

-- ---------------------------------------------------------------------
-- Cada mudança de estado fica registada com quem a fez, quando e porquê.
-- ---------------------------------------------------------------------
create table appointment_status_event (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointment(id) on delete cascade,
  from_status    text,
  to_status      text not null,
  by_staff_id    uuid references staff(id) on delete set null,
  by_client      boolean not null default false,
  reason         text,
  at             timestamptz not null default now()
);
create index appointment_status_event_idx on appointment_status_event(appointment_id, at);

-- ---------------------------------------------------------------------
-- Cancelar liberta o horário. Rede de segurança ao nível da base de
-- dados para o invariante "cancelar apaga o bloco" — a aplicação faz o
-- mesmo dentro da transação, mas isto garante-o mesmo se alguém mexer
-- no estado por SQL directo.
-- ---------------------------------------------------------------------
create or replace function free_blocks_on_cancel() returns trigger
language plpgsql as $$
begin
  if new.status in ('cancelled_by_client','cancelled_by_salon')
     and old.status is distinct from new.status then
    delete from staff_block
      where appointment_item_id in (select id from appointment_item where appointment_id = new.id);
    delete from resource_block
      where appointment_item_id in (select id from appointment_item where appointment_id = new.id);
  end if;
  return new;
end;
$$;

create trigger appointment_free_blocks
  after update of status on appointment
  for each row execute function free_blocks_on_cancel();
