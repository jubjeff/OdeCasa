-- Painel da PLATAFORMA (/admin) — visão do dono da plataforma sobre todas as lojas.
-- O dono da plataforma é marcado com profiles.is_admin = true.
-- O RLS hoje limita tudo por loja (dono_id); aqui abrimos leitura geral SÓ para o admin.

/* ── 1. Flag de admin ─────────────────────────────────────── */
alter table profiles add column if not exists is_admin boolean not null default false;

/* ── 2. Contato do dono em profiles (pro painel mostrar e-mail/nome) ──
   Hoje o e-mail vive em auth.users (não acessível pelo anon key) e o nome em
   user_metadata. Espelhamos os dois em profiles, com backfill + trigger de sync. */
alter table profiles add column if not exists email text;
alter table profiles add column if not exists nome  text;

-- Backfill do que já existe em auth.users
update profiles p
set email = u.email,
    nome  = coalesce(p.nome, u.raw_user_meta_data->>'nome')
from auth.users u
where u.id = p.id;

-- Mantém email/nome sincronizados ao criar/atualizar o usuário no Auth.
-- security definer: roda como dono da função, ignorando RLS (sem recursão).
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, new.raw_user_meta_data->>'nome')
  on conflict (id) do update
    set email = excluded.email,
        nome  = coalesce(public.profiles.nome, excluded.nome);
  return new;
end;
$$;

drop trigger if exists on_auth_user_sync_contact on auth.users;
create trigger on_auth_user_sync_contact
after insert or update on auth.users
for each row execute function public.sync_profile_from_auth();

/* ── 3. Data de criação da loja (idempotente; outras tabelas usam criado_em) ── */
alter table lojas add column if not exists criado_em timestamptz not null default now();

/* ── 4. Função auxiliar: o usuário atual é admin da plataforma? ──
   security definer para LER profiles sem disparar RLS — evita recursão
   quando a própria policy de profiles precisa checar is_admin. */
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

/* ── 5. Policies do admin (leitura geral + ativar/desativar loja) ── */

-- Admin enxerga todas as lojas
drop policy if exists "admin ve todas as lojas" on lojas;
create policy "admin ve todas as lojas"
on lojas for select to authenticated
using (public.is_platform_admin());

-- Admin enxerga todos os pedidos
drop policy if exists "admin ve todos os pedidos" on pedidos;
create policy "admin ve todos os pedidos"
on pedidos for select to authenticated
using (public.is_platform_admin());

-- Admin enxerga todos os profiles (pra mostrar o dono de cada loja)
drop policy if exists "admin ve todos os profiles" on profiles;
create policy "admin ve todos os profiles"
on profiles for select to authenticated
using (public.is_platform_admin());

-- Admin ativa/desativa qualquer loja
drop policy if exists "admin atualiza lojas" on lojas;
create policy "admin atualiza lojas"
on lojas for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());
