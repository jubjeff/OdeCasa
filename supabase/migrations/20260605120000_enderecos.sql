-- Tabela de endereços salvos do cliente
create table if not exists enderecos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references profiles(id) on delete cascade,
  apelido text,
  endereco text not null,
  complemento text,
  referencia text,
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Índice para buscar os endereços de um cliente
create index if not exists enderecos_cliente_id_idx on enderecos (cliente_id);

-- Habilita RLS (idempotente)
alter table enderecos enable row level security;

-- Remove a policy se já existir (evita erro de duplicata)
drop policy if exists "endereços: cliente gerencia os próprios" on enderecos;

-- Cliente só acessa/gerencia os próprios endereços
create policy "endereços: cliente gerencia os próprios"
on enderecos for all
to authenticated
using (cliente_id = (select auth.uid()))
with check (cliente_id = (select auth.uid()));
