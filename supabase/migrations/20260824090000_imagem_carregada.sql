-- =====================================================================
-- 0012 · A fotografia carregada do telemóvel.
--
-- Até aqui a fotografia de um serviço era um endereço: ou um caminho do
-- repositório (/fotos/...) ou um https:// de fora. Pedir um endereço à
-- dona é pedir-lhe uma coisa de informático — ela tem a fotografia no
-- rolo do telemóvel, e é dali que ela deve entrar.
--
-- O ficheiro guarda-se aqui dentro, na base de dados, e serve-se por
-- /imagens/<id>. Não é uma heresia ao tamanho desta casa: são dezenas
-- de fotografias pequenas (o telemóvel encolhe-as antes de enviar, o
-- limite duro está no check), não um álbum. E poupa uma conta, uma
-- chave e um bucket que mais ninguém ia gerir.
--
-- A `service.image_url` continua a ser um endereço — agora aponta para
-- cá. O esquema do serviço não muda.
-- =====================================================================

create table if not exists uploaded_image (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,

  -- Só o que um <img> mostra em qualquer telemóvel.
  mime       text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),

  bytes      bytea not null,

  -- O tamanho repetido fora do bytea, para se poder olhar sem pesar.
  -- 4 MB é o tecto duro; o normal, depois de encolhida, são ~200 KB.
  byte_size  int not null check (byte_size > 0 and byte_size <= 4194304),

  created_at timestamptz not null default now()
);

-- Como as restantes: RLS ligado sem políticas — por PostgREST não se vê
-- nada; o servidor entra como dono da tabela.
alter table uploaded_image enable row level security;
