-- =====================================================================
-- 0003 · Gente: equipa (papéis, habilidades, escala, ausências),
--        clientes, sessões e códigos de uso único.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Equipa. Uma linha = uma pessoa. O papel vive em staff_role.
-- O telefone é o identificador de entrada da equipa.
-- ---------------------------------------------------------------------
create table staff (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references org(id) on delete cascade,

  name          text not null,
  phone         text not null,
  email         text,
  password_hash text,          -- scrypt; nulo enquanto não define senha
  avatar_url    text,
  bio           text,
  display_color text not null default '#D9C08A',

  -- só profissionais que aceitam marcação online entram no funil público
  accepts_online_booking boolean not null default true,

  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, phone)
);
create trigger staff_updated_at before update on staff
  for each row execute function set_updated_at();
create unique index staff_email_idx on staff(org_id, lower(email)) where email is not null;

alter table price_override
  add constraint price_override_staff_fk
  foreign key (staff_id) references staff(id) on delete cascade;

-- ---------------------------------------------------------------------
-- Papéis. unit_id NULO significa "a rede toda".
-- (o suporte não vive aqui: é uma lista de telefones numa variável de
--  ambiente, e vê tudo em todas as lojas.)
-- ---------------------------------------------------------------------
create table staff_role (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  role       text not null check (role in ('owner','manager','professional')),
  unit_id    uuid references unit(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- dona é sempre escopo rede
  check (role <> 'owner' or unit_id is null),
  unique nulls not distinct (staff_id, role, unit_id)
);
create index staff_role_staff_idx on staff_role(staff_id);
create index staff_role_unit_idx on staff_role(unit_id);

-- Lojas onde a profissional atende.
create table staff_unit (
  staff_id uuid not null references staff(id) on delete cascade,
  unit_id  uuid not null references unit(id) on delete cascade,
  primary key (staff_id, unit_id)
);

-- Habilidades: que profissional executa que serviço.
-- Quem não tem a habilidade nunca aparece como opção nesse serviço.
create table staff_skill (
  staff_id   uuid not null references staff(id) on delete cascade,
  service_id uuid not null references service(id) on delete cascade,
  primary key (staff_id, service_id)
);
create index staff_skill_service_idx on staff_skill(service_id);

-- ---------------------------------------------------------------------
-- Escala recorrente COM VIGÊNCIA.
-- Trocar de escala é fechar a antiga (valid_to) e abrir uma nova —
-- nunca editar a existente, senão o passado da agenda muda junto.
-- valid_from inclusivo, valid_to inclusivo (nulo = sem fim).
-- ---------------------------------------------------------------------
create table staff_schedule (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  unit_id    uuid not null references unit(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  starts_min int not null check (starts_min between 0 and 1440),
  ends_min   int not null check (ends_min between 0 and 1440),
  valid_from date not null,
  valid_to   date,
  created_at timestamptz not null default now(),
  check (ends_min > starts_min),
  check (valid_to is null or valid_to >= valid_from),
  -- a mesma pessoa não pode estar escalada em dois sítios à mesma hora
  exclude using gist (
    staff_id with =,
    weekday with =,
    int4range(starts_min, ends_min) with &&,
    daterange(valid_from, valid_to, '[]') with &&
  )
);
create index staff_schedule_lookup_idx on staff_schedule(unit_id, weekday, valid_from);
create index staff_schedule_staff_idx on staff_schedule(staff_id, weekday);

-- ---------------------------------------------------------------------
-- Ausências: folga, férias, formação, bloqueio avulso.
-- Dia inteiro ou pedaço do dia (guardado sempre em instantes UTC).
-- ---------------------------------------------------------------------
create table staff_absence (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  unit_id    uuid references unit(id) on delete set null,
  kind       text not null check (kind in ('day_off','vacation','training','block')),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index staff_absence_lookup_idx
  on staff_absence using gist (staff_id, tstzrange(starts_at, ends_at));

-- ---------------------------------------------------------------------
-- Clientes. O TELEFONE É A IDENTIDADE e é único na rede: a mesma
-- cliente nas duas lojas é a mesma ficha, e o histórico atravessa-as.
-- ---------------------------------------------------------------------
create table client (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references org(id) on delete cascade,

  phone      text not null,
  name       text not null,
  email      text,
  birthdate  date,
  language   text not null default 'pt' check (language in ('pt','en','es')),

  preferred_unit_id  uuid references unit(id) on delete set null,
  preferred_staff_id uuid references staff(id) on delete set null,

  drink_preference text,
  allergies        text,
  service_notes    text,
  tags             text[] not null default '{}',

  no_show_count  int not null default 0 check (no_show_count >= 0),
  first_visit_at timestamptz,
  last_visit_at  timestamptz,

  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, phone)
);
create trigger client_updated_at before update on client
  for each row execute function set_updated_at();
create index client_name_idx on client using gin (to_tsvector('simple', name));
create index client_tags_idx on client using gin (tags);

-- Notas internas: visíveis só à equipa, nunca à cliente.
create table client_note (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references client(id) on delete cascade,
  author_id  uuid references staff(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index client_note_client_idx on client_note(client_id, created_at desc);

-- ---------------------------------------------------------------------
-- Sessões. A equipa entra com palavra-passe; a cliente com código.
-- São portas separadas e não se cruzam — daí subject_type.
-- ---------------------------------------------------------------------
create table session (
  id           uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('staff','client')),
  subject_id   uuid not null,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent   text,
  ip           inet
);
create index session_subject_idx on session(subject_type, subject_id);
create index session_expiry_idx on session(expires_at);

-- ---------------------------------------------------------------------
-- Código de uso único. Tem prazo, tentativas limitadas, e serve para
-- UMA coisa só (um código pedido para recuperar palavra-passe não abre
-- sessão de cliente).
-- ---------------------------------------------------------------------
create table otp_code (
  id           uuid primary key default gen_random_uuid(),
  purpose      text not null check (purpose in ('client_login','staff_password_reset')),
  target       text not null,              -- telefone (cliente) ou e-mail (equipa)
  code_hash    text not null,
  -- Não há canal automático de envio: é uma pessoa que abre o WhatsApp e
  -- manda o código. Para o poder ler, ele fica também em claro — vive
  -- minutos, serve um só propósito e é apagado ao ser usado.
  code_plain   text,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  max_attempts int not null default 5,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now(),
  ip           inet
);
create index otp_lookup_idx on otp_code(purpose, target, created_at desc);
