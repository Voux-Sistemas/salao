-- ---------------------------------------------------------------------
-- O TURNO EXTRA — O CONTRÁRIO DA AUSÊNCIA.
--
-- A casa já sabia dizer «esta pessoa NÃO vem neste dia»: são as folgas,
-- as férias, a formação e os bloqueios, todos em `staff_absence`. Não
-- sabia dizer «esta pessoa VEM neste dia, e só neste» — faltava-lhe a
-- outra metade do par.
--
-- Sem ela, dar um sábado por mês a alguém obrigava a escalá-la a TODOS
-- os sábados na escala semanal, e depois a marcar folga nos três que
-- ela não faz. Três mentiras para dizer uma verdade — e é assim que o
-- domingo desta casa está hoje: a migração que o abriu escalou todas as
-- colaboradoras de cabelo a todos os domingos, para sempre, e por isso
-- a agenda promete gente que não está lá.
--
-- UMA LINHA POR DATA, E NÃO UMA REGRA QUE SE REPETE. «O primeiro sábado
-- de cada mês» parece arrumado até alguém trocar com uma colega, e a
-- partir daí o sistema mente todos os meses sem ninguém dar por isso.
-- Uma data marcada está sempre certa; é mais trabalho a escrever e
-- menos a desmentir.
--
-- A ORDEM PASSA A SER: semana + extras − ausências. O extra soma-se ao
-- que a escala semanal já dá; a ausência continua a descontar por cima
-- dos dois. Uma pessoa com turno extra num dia em que também marcou
-- folga não trabalha — e é o que se quer, porque a folga é a decisão
-- mais recente.
-- ---------------------------------------------------------------------

create table staff_shift (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  unit_id    uuid not null references unit(id) on delete cascade,
  day        date not null,
  starts_min int not null check (starts_min between 0 and 1440),
  ends_min   int not null check (ends_min between 0 and 1440),
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_min > starts_min),

  -- A mesma pessoa não pode ter dois turnos extra sobrepostos no mesmo
  -- dia, nem sequer em lojas diferentes: ela é uma só. É a mesma
  -- restrição que a escala semanal já tem, escrita para datas em vez
  -- de dias da semana.
  exclude using gist (
    staff_id with =,
    day with =,
    int4range(starts_min, ends_min) with &&
  )
);

-- Os dois caminhos por onde isto é lido: o motor pergunta «quem está de
-- serviço nesta loja neste dia», a ficha pergunta «que extras tem esta
-- pessoa».
create index staff_shift_lookup_idx on staff_shift(unit_id, day);
create index staff_shift_staff_idx on staff_shift(staff_id, day);
