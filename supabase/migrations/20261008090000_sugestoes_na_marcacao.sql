-- ---------------------------------------------------------------------
-- EXTRAS NA MARCAÇÃO
--
-- Quem escolhe uma coloração no funil vê, por cima da barra de «Escolher
-- hora», um pequeno extra que se junta bem — um tratamento hidratante,
-- uma ampola. O extra não é uma coisa nova: é outro serviço da ementa,
-- com o seu preço e a sua duração, e juntá-lo é o mesmo que escolhê-lo
-- na família dele.
--
-- Esta tabela só guarda a lista: «quem escolher ESTE serviço vê ESTE
-- como sugestão». É a casa que a monta, na ficha de cada serviço, e no
-- máximo duas por serviço (a regra vive no código, que é quem diz porquê
-- à dona).
--
-- SÓ ACRESCENTA. Não toca em nenhuma tabela que já existe, em nenhuma
-- marcação nem em nenhum serviço. Sem linhas aqui, o funil fica igual ao
-- de hoje — é assim que a funcionalidade nasce desligada.
-- ---------------------------------------------------------------------

create table if not exists service_suggestion (
  org_id       uuid not null references org(id) on delete cascade,
  -- o serviço que, escolhido, faz aparecer a sugestão
  service_id   uuid not null references service(id) on delete cascade,
  -- o serviço sugerido
  suggested_id uuid not null references service(id) on delete cascade,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),

  primary key (service_id, suggested_id),
  -- um serviço não se sugere a si próprio
  check (service_id <> suggested_id)
);

-- Para a ficha de um serviço saber, sem varrer a tabela, quem o sugere.
create index if not exists service_suggestion_suggested_idx
  on service_suggestion(suggested_id);

-- Como as restantes: RLS ligado sem políticas — por PostgREST não se vê
-- nada; o servidor entra como dono da tabela.
alter table service_suggestion enable row level security;
