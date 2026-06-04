-- Coluna de logo na tabela lojas
alter table lojas
  add column if not exists logo_url text;

-- Bucket público "lojas" para logos das lojas
insert into storage.buckets (id, name, public)
values ('lojas', 'lojas', true)
on conflict (id) do update set public = true;

-- Remove policies antigas se existirem (idempotente)
drop policy if exists "leitura publica lojas"    on storage.objects;
drop policy if exists "upload autenticado lojas" on storage.objects;
drop policy if exists "update autenticado lojas" on storage.objects;
drop policy if exists "delete autenticado lojas" on storage.objects;

-- Leitura pública: qualquer um pode ver as logos
create policy "leitura publica lojas"
on storage.objects for select
using ( bucket_id = 'lojas' );

-- Upload: apenas usuários autenticados
create policy "upload autenticado lojas"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'lojas' );

-- Atualização: apenas usuários autenticados
create policy "update autenticado lojas"
on storage.objects for update
to authenticated
using ( bucket_id = 'lojas' );

-- Exclusão: apenas usuários autenticados
create policy "delete autenticado lojas"
on storage.objects for delete
to authenticated
using ( bucket_id = 'lojas' );
