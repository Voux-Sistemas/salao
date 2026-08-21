-- =====================================================================
-- 0005 · Dinheiro: pagamentos, caixa e comissões.
-- Todo o dinheiro é inteiro, em cêntimos. Nunca vírgula flutuante.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pagamentos: uma linha por método, porque uma visita pode ser meia
-- em cartão e meia em dinheiro.
-- ---------------------------------------------------------------------
create table payment (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointment(id) on delete cascade,
  unit_id        uuid not null references unit(id) on delete restrict,
  method         text not null check (method in ('cash','debit','credit','other')),
  amount_cents   int  not null check (amount_cents > 0),
  note           text,
  received_by_staff_id uuid references staff(id) on delete set null,
  received_at    timestamptz not null default now()
);
create index payment_appointment_idx on payment(appointment_id);
create index payment_unit_day_idx on payment(unit_id, received_at);

-- ---------------------------------------------------------------------
-- Caixa, por loja e por dia.
-- esperado = abertura + entradas − sangrias
-- ---------------------------------------------------------------------
create table cash_session (
  id      uuid primary key default gen_random_uuid(),
  unit_id uuid not null references unit(id) on delete restrict,

  business_date date not null,     -- dia no fuso da loja
  status        text not null default 'open' check (status in ('open','closed')),

  opening_cents      int not null check (opening_cents >= 0),
  opened_at          timestamptz not null default now(),
  opened_by_staff_id uuid references staff(id) on delete set null,

  expected_cents     int,          -- calculado no fecho
  counted_cents      int,          -- contado fisicamente na gaveta
  difference_cents   int,          -- contado − esperado
  closing_note       text,
  closed_at          timestamptz,
  closed_by_staff_id uuid references staff(id) on delete set null,

  unique (unit_id, business_date)
);
-- só um caixa aberto por loja de cada vez
create unique index cash_session_one_open_idx on cash_session(unit_id) where status = 'open';

create table cash_movement (
  id              uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references cash_session(id) on delete cascade,
  kind            text not null check (kind in ('sale','reinforcement','withdrawal','adjustment')),
  -- assinado: entradas positivas, sangrias negativas
  amount_cents    int  not null check (amount_cents <> 0),
  note            text,
  payment_id      uuid references payment(id) on delete set null,
  appointment_id  uuid references appointment(id) on delete set null,
  by_staff_id     uuid references staff(id) on delete set null,
  created_at      timestamptz not null default now(),
  check ((kind = 'withdrawal') = (amount_cents < 0) or kind = 'adjustment')
);
create index cash_movement_session_idx on cash_movement(cash_session_id, created_at);
create unique index cash_movement_payment_idx on cash_movement(payment_id) where payment_id is not null;

-- ---------------------------------------------------------------------
-- Comissões.
-- Regra em percentagem, com precedência do mais específico ao mais
-- genérico:  profissional + serviço -> profissional -> serviço -> casa.
-- ---------------------------------------------------------------------
create table commission_rule (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  staff_id   uuid references staff(id) on delete cascade,
  service_id uuid references service(id) on delete cascade,
  percent    numeric(5,2) not null check (percent >= 0 and percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (org_id, staff_id, service_id)
);
create trigger commission_rule_updated_at before update on commission_rule
  for each row execute function set_updated_at();

-- Pagamento em lote, por profissional.
create table commission_payout (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references org(id) on delete cascade,
  staff_id     uuid not null references staff(id) on delete restrict,
  total_cents  int  not null check (total_cents > 0),
  entry_count  int  not null check (entry_count > 0),
  note         text,
  paid_at      timestamptz not null default now(),
  paid_by_staff_id uuid references staff(id) on delete set null
);
create index commission_payout_staff_idx on commission_payout(staff_id, paid_at desc);

-- ---------------------------------------------------------------------
-- Entrada de comissão: gerada NO FECHO da comanda, item a item.
-- A percentagem fica congelada junto com o valor — mudar a regra amanhã
-- nunca reescreve comissão já gerada.
-- ---------------------------------------------------------------------
create table commission_entry (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references org(id) on delete cascade,
  unit_id uuid not null references unit(id) on delete restrict,

  appointment_id      uuid not null references appointment(id) on delete cascade,
  appointment_item_id uuid not null unique references appointment_item(id) on delete cascade,
  staff_id            uuid not null references staff(id) on delete restrict,

  -- base = preço congelado do item − rateio proporcional do desconto
  item_price_cents int not null check (item_price_cents >= 0),
  discount_share_cents int not null default 0 check (discount_share_cents >= 0),
  base_cents       int not null check (base_cents >= 0),
  percent          numeric(5,2) not null check (percent >= 0 and percent <= 100),
  amount_cents     int not null check (amount_cents >= 0),

  status     text not null default 'pending' check (status in ('pending','paid')),
  payout_id  uuid references commission_payout(id) on delete set null,
  paid_at    timestamptz,
  generated_at timestamptz not null default now(),

  check ((status = 'paid') = (paid_at is not null))
);
create index commission_entry_staff_status_idx on commission_entry(staff_id, status, generated_at);
create index commission_entry_unit_idx on commission_entry(unit_id, generated_at);
create index commission_entry_payout_idx on commission_entry(payout_id);
