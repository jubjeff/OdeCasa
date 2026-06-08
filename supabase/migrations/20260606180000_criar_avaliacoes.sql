-- Tabela de avaliações de pedidos por clientes.
-- Um cliente só pode avaliar um pedido entregue; a nota aparece publicamente na loja.

create table if not exists public.avaliacoes (
  id          uuid        primary key default gen_random_uuid(),
  pedido_id   uuid        references public.pedidos(id)  on delete cascade,
  loja_id     uuid        references public.lojas(id)    on delete cascade,
  cliente_id  uuid        references public.profiles(id) on delete set null,
  nota        int         not null check (nota between 1 and 5),
  comentario  text,
  criado_em   timestamptz not null default now()
);

-- Índices para as consultas mais comuns
create index if not exists avaliacoes_loja_id_idx    on public.avaliacoes (loja_id);
create index if not exists avaliacoes_pedido_id_idx  on public.avaliacoes (pedido_id);
create index if not exists avaliacoes_cliente_id_idx on public.avaliacoes (cliente_id);

-- RLS
alter table public.avaliacoes enable row level security;

-- Qualquer pessoa (inclusive anônimo) pode ler avaliações
create policy "avaliacao: leitura publica"
  on public.avaliacoes for select
  to anon, authenticated
  using (true);

-- Apenas o próprio cliente autenticado insere sua avaliação
create policy "avaliacao: cliente insere propria avaliacao"
  on public.avaliacoes for insert
  to authenticated
  with check (cliente_id = auth.uid());

-- Garante linha em profiles para todos os usuários existentes
-- (FK cliente_id → profiles(id) exige que a linha exista)
insert into public.profiles (id, email, nome)
select id, email, raw_user_meta_data->>'nome'
from auth.users
on conflict (id) do update
  set email = excluded.email,
      nome  = coalesce(public.profiles.nome, excluded.nome);
