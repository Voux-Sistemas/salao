-- ---------------------------------------------------------------------
-- DESMARCAR ATÉ MEIA HORA ANTES
--
-- A janela era de 24 horas, e apanhámo-la a trabalhar contra a casa: uma
-- marcação de sábado ao meio-dia deixava de se cancelar na sexta à
-- tarde. A cliente que não pode vir e não consegue dizê-lo NÃO VEM À
-- MESMA — falta, e a casa perde a hora e o dinheiro, sem sequer saber
-- que a hora vagou.
--
-- Trinta minutos, escolha da dona.
--
-- E TRINTA MINUTOS NÃO É UMA HORA INTEIRA. A coluna guardava horas, e
-- por isso não é um `update` — é uma mudança de unidade.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 1. A COLUNA NOVA, EM MINUTOS
--
-- Fica ao lado da de remarcar, que já nasceu em minutos, e as duas
-- passam a falar a mesma língua. Uma janela que se mede em horas não
-- consegue dizer «meia hora», e era essa a única coisa que faltava
-- dizer.
-- ---------------------------------------------------------------------

alter table unit
  add column if not exists cancel_window_minutes int not null default 30
    check (cancel_window_minutes >= 0);


-- ---------------------------------------------------------------------
-- 2. O QUE LÁ ESTAVA, CONVERTIDO
--
-- Primeiro traz-se o que cada loja tinha, em minutos — para que nenhuma
-- perca a sua regra por causa da mudança de unidade. Só depois é que a
-- regra nova entra, e entra num passo à parte, à vista.
-- ---------------------------------------------------------------------

update unit
   set cancel_window_minutes = cancel_window_hours * 60;


-- ---------------------------------------------------------------------
-- 3. E A REGRA NOVA
--
-- Trinta minutos em todas as lojas. Se um dia quiser diferente numa
-- delas, muda-se no Admin → Unidades → Regras de marcação, que agora tem
-- o campo em minutos.
-- ---------------------------------------------------------------------

update unit set cancel_window_minutes = 30;


-- ---------------------------------------------------------------------
-- 4. A COLUNA VELHA FICA, POR AGORA
--
-- O código deixou de a ler e deixou de a escrever, mas ela fica onde
-- está mais uns dias: é a única cópia do que cada loja tinha antes, e
-- apagá-la no mesmo dia em que se muda a regra é ficar sem caminho de
-- volta.
--
-- Quando estiver satisfeito com os trinta minutos, corra esta linha:
--
--   alter table unit drop column cancel_window_hours;
--
-- Não há pressa nenhuma. Uma coluna que ninguém lê não custa nada.
-- ---------------------------------------------------------------------
