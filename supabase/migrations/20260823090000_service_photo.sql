-- ---------------------------------------------------------------------
-- Fotografia do serviço.
--
-- O preçário tem sessenta e sete linhas de texto. Uma fotografia ao
-- lado de "Balayage" vende o que a palavra não vende — mas nunca vai
-- haver sessenta e sete fotografias, e a maioria vai ficar sem nenhuma
-- para sempre. Por isso a coluna nasce a permitir nulo e o desenho
-- trata a ausência como o caso normal, não como falha: sem endereço
-- sai um quadrado com as iniciais do serviço sobre papel, desenhado
-- pelo `PhotoFallback` em `components/photo.tsx`.
--
-- É um endereço, não um ficheiro: serve tanto `/fotos/...` do
-- repositório como um dia o Supabase Storage, sem mudar o esquema.
-- ---------------------------------------------------------------------
alter table service add column if not exists image_url text;

-- O texto alternativo é o que uma leitora de ecrã ouve e o que aparece
-- se a imagem não carregar. Separado do endereço porque muda com a
-- língua da casa, e porque o nome do serviço nem sempre descreve a foto.
alter table service add column if not exists image_alt text;
