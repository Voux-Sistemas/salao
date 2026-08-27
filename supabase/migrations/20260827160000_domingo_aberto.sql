-- O DOMINGO ABRE EM VALONGO.
--
-- A casa já abria no papel: `business_hours` tem a linha do dia 0, das
-- 9h às 21h. O que faltava era gente. Ao domingo só a Profissional 04
-- estava escalada, e as habilidades dela são mãos e pés — que é
-- precisamente o que ao domingo passa a ser sob consulta. Resultado:
-- a porta aberta e nem uma hora para oferecer.
--
-- Esta migração dá turno de domingo a quem faz cabelo, coloração,
-- tratamentos capilares e barbearia. A cliente não escolhe ninguém —
-- essa regra vive no código, em `lib/sunday.ts` — e por isso não há
-- aqui nada a dizer sobre quem atende quem: as quatro ficam escaladas,
-- o motor reparte por quem estiver livre à hora marcada, e no salão
-- decidem entre si como já fazem.
--
-- A Maia não abre ao domingo e não se toca: não tem linha de dia 0 em
-- `business_hours`, que é como esta base diz «fechado».
--
-- Escreve-se pelo `public_alias` e não pelo nome: os identificadores
-- nascem em cada instalação e os nomes reais não se põem em ficheiros
-- que vão para o repositório.

begin;

insert into staff_schedule (staff_id, unit_id, weekday, starts_min, ends_min, valid_from)
select st.id,
       u.id,
       0,
       b.opens_min,
       b.closes_min,
       current_date
  from staff st
  join unit u on u.slug = 'valongo'
  join staff_unit su on su.staff_id = st.id and su.unit_id = u.id
  join business_hours b on b.unit_id = u.id and b.weekday = 0
 where st.is_active
   and st.accepts_online_booking
   -- Quem sabe fazer cabelo. É a habilidade que define quem serve ao
   -- domingo, e não uma lista de nomes que envelhece à primeira
   -- pessoa que entra ou sai da equipa.
   and exists (
     select 1
       from staff_skill ss
       join service s on s.id = ss.service_id and s.is_active
       join service_category c on c.id = s.category_id
      where ss.staff_id = st.id
        and c.slug in ('cabelo', 'coloracao', 'tratamentos-capilares', 'barbearia')
   )
   -- Quem já tiver turno de domingo em vigor fica como está: esta
   -- migração acrescenta, não reescreve. Sem isto a restrição de
   -- exclusão da tabela rejeitava a linha repetida e levava a
   -- transacção inteira atrás dela.
   and not exists (
     select 1
       from staff_schedule sch
      where sch.staff_id = st.id
        and sch.unit_id = u.id
        and sch.weekday = 0
        and (sch.valid_to is null or sch.valid_to >= current_date)
   );

commit;
