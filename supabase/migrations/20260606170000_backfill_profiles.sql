-- Garante que todo usuário em auth.users tenha uma linha em profiles.
-- A migration 20260606120000 só fez UPDATE (não INSERT) para usuários
-- que já existiam sem linha em profiles, causando violação de FK ao
-- inserir avaliações (cliente_id references profiles(id)).

insert into public.profiles (id, email, nome)
select
  id,
  email,
  raw_user_meta_data->>'nome'
from auth.users
on conflict (id) do update
  set email = excluded.email,
      nome  = coalesce(public.profiles.nome, excluded.nome);
