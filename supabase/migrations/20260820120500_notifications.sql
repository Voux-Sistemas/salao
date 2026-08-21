-- =====================================================================
-- 0006 · Avisos.
--
-- Não existe agendador. A fila de avisos é uma CONSULTA: "quem se
-- enquadra nesta rotina e ainda não tem registo de envio". O que impede
-- o aviso duplicado é o próprio registo.
--   Enviar é gravar; gravar é sair da fila.
--
-- E a regra que não se pode confundir: mandar a confirmação NÃO é a
-- cliente confirmar. São dois factos distintos — um é uma mensagem que
-- saiu (esta tabela), o outro é o estado da marcação.
-- =====================================================================

create table message_template (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  routine    text not null check (routine in
               ('confirm','reminder_eve','reminder_today','review','winback')),
  language   text not null check (language in ('pt','en','es')),
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, routine, language)
);
create trigger message_template_updated_at before update on message_template
  for each row execute function set_updated_at();

create table notification_log (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references org(id) on delete cascade,
  unit_id uuid not null references unit(id) on delete cascade,

  appointment_id uuid not null references appointment(id) on delete cascade,
  client_id      uuid not null references client(id) on delete cascade,
  routine        text not null check (routine in
                   ('confirm','reminder_eve','reminder_today','review','winback')),

  channel          text not null default 'whatsapp',
  message_snapshot text,
  sent_by_staff_id uuid references staff(id) on delete set null,
  sent_at          timestamptz not null default now(),

  -- é este registo, e só ele, que tira a linha da fila
  unique (appointment_id, routine)
);
create index notification_log_unit_idx on notification_log(unit_id, sent_at desc);
create index notification_log_client_idx on notification_log(client_id, sent_at desc);
