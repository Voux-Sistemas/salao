-- O nome que sai para fora.
--
-- As profissionais são prestadoras de serviço independentes. Pôr o nome
-- verdadeiro no funil público, encostado às horas em que cada uma está
-- livre, é publicar a escala de cada uma a quem quiser olhar: basta
-- abrir a marcação numa semana e noutra para saber quando é que a
-- Fulana trabalha, quando falta e quando está de férias.
--
-- Com esta coluna preenchida, a cliente vê "Profissional 1" e o nome
-- verdadeiro fica só do lado de dentro, para quem trabalha na casa.
-- Nula, mostra-se o nome — é o que faz sentido para quem não se importa.

alter table staff add column public_alias text;

comment on column staff.public_alias is
  'Nome mostrado à cliente no site. Nulo = mostra o nome verdadeiro.';
