-- ---------------------------------------------------------------------
-- O DOMINGO PASSA A SER MARCADO, E NÃO PRESUMIDO.
--
-- CORRE ESTA DEPOIS DA OUTRA, E SÓ QUANDO O SALÃO ESTIVER PRONTO PARA
-- MARCAR OS DOMINGOS. Ela apaga a escala de domingo; a partir daqui,
-- um domingo sem turno extra marcado é um domingo sem ninguém, e a
-- montra deixa de oferecer horas nesse dia.
--
-- ---------------------------------------------------------------------
--
-- Em 27 de agosto abriu-se o domingo em Valongo, e para o abrir depressa
-- deu-se turno de domingo PERMANENTE — todos os domingos, para sempre —
-- a todas as colaboradoras que sabem fazer cabelo. Está escrito na
-- migração `20260827160000_domingo_aberto.sql`: dia 0, das 9h às 21h,
-- válido a partir daquele dia e sem fim.
--
-- Foi o que abriu a porta, e nessa altura foi o certo. Mas o que ficou
-- escrito na base não é o que acontece no salão: ao domingo vai UMA, e
-- o sistema julga que vão todas. Como ao domingo a cliente não escolhe
-- com quem — essa regra vive no `lib/sunday.ts` — o motor reparte a
-- marcação por quem «está escalado», e escaladas estão as quatro. A
-- agenda de segunda-feira aparece com o nome de quem não lá esteve.
--
-- Não era um erro de código. Era uma escala que não correspondia à
-- realidade, e agora há onde escrever a realidade: o turno extra.
--
-- FECHA-SE A VIGÊNCIA, NÃO SE APAGA A LINHA. É a regra desta casa para
-- escalas: o passado da agenda tem de continuar a explicar-se sozinho.
-- Apagar a linha faria os domingos que já correram passarem a parecer
-- dias em que ninguém estava escalado; fechada ontem, cada domingo
-- continua a ser lido pela escala que vigorava nele.
-- ---------------------------------------------------------------------

update staff_schedule
   set valid_to = current_date - 1
 where weekday = 0
   and (valid_to is null or valid_to > current_date - 1)
   and valid_from <= current_date;

-- Uma escala de domingo que ainda nem começou não tem passado para
-- proteger: essa apaga-se.
delete from staff_schedule
 where weekday = 0
   and valid_from > current_date;
