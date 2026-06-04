-- Cria o bucket público "produtos" para fotos de produtos
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do update set public = true;

-- Remove policies antigas se existirem (idempotente)
drop policy if exists "leitura publica produtos"         on storage.objects;
drop policy if exists "upload autenticado produtos"      on storage.objects;
drop policy if exists "update autenticado produtos"      on storage.objects;
drop policy if exists "delete autenticado produtos"      on storage.objects;

-- Leitura pública: qualquer um pode ver as imagens
create policy "leitura publica produtos"
on storage.objects for select
using ( bucket_id = 'produtos' );

-- Upload: apenas usuários autenticados
create policy "upload autenticado produtos"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'produtos' );

-- Atualização: apenas usuários autenticados
create policy "update autenticado produtos"
on storage.objects for update
to authenticated
using ( bucket_id = 'produtos' );

-- Exclusão: apenas usuários autenticados
create policy "delete autenticado produtos"
on storage.objects for delete
to authenticated
using ( bucket_id = 'produtos' );
