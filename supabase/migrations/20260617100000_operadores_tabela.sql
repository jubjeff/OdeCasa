-- F1-S1: Tabela operadores + funções helper de papel

create table if not exists operadores (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references lojas(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  email text not null,
  papel text not null default 'atendente'
    check (papel in ('gerente','atendente','caixa')),
  status text not null default 'pendente'
    check (status in ('pendente','ativo','inativo')),
  convidado_por uuid references profiles(id) on delete set null,
  invite_token text unique,
  invite_expires_at timestamptz,
  criado_em timestamptz not null default now(),
  unique(loja_id, email)
);

create index if not exists operadores_loja_id_idx on operadores(loja_id);
create index if not exists operadores_user_id_idx on operadores(user_id);
create index if not exists operadores_invite_token_idx on operadores(invite_token) where invite_token is not null;

alter table operadores enable row level security;

-- Dono: CRUD completo nos operadores da própria loja
drop policy if exists "op: dono gerencia proprios" on operadores;
create policy "op: dono gerencia proprios" on operadores
  for all to authenticated
  using (
    exists (
      select 1 from lojas
      where lojas.id = operadores.loja_id
      and lojas.dono_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from lojas
      where lojas.id = operadores.loja_id
      and lojas.dono_id = (select auth.uid())
    )
  );

-- Operador vê apenas a própria linha
drop policy if exists "op: operador ve a propria linha" on operadores;
create policy "op: operador ve a propria linha" on operadores
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Admin da plataforma: acesso total
drop policy if exists "op: admin full" on operadores;
create policy "op: admin full" on operadores
  for all to authenticated
  using (
    (select is_admin from profiles where id = (select auth.uid())) = true
  )
  with check (
    (select is_admin from profiles where id = (select auth.uid())) = true
  );

-- ── Funções helper ────────────────────────────────────────────────────────────

-- Verifica se o usuário é operador ativo com papel mínimo exigido
create or replace function operador_tem_acesso(
  p_loja_id uuid,
  p_min_papel text default 'caixa'
)
returns boolean language sql security definer as $$
  select exists (
    select 1 from operadores
    where loja_id = p_loja_id
    and user_id = (select auth.uid())
    and status = 'ativo'
    and case p_min_papel
      when 'gerente'   then papel = 'gerente'
      when 'atendente' then papel in ('gerente', 'atendente')
      else                  papel in ('gerente', 'atendente', 'caixa')
    end
  );
$$;

-- Retorna o papel do usuário logado em uma loja: 'dono' | papel | null
create or replace function meu_papel_na_loja(p_loja_id uuid)
returns text language sql security definer as $$
  select coalesce(
    (
      select papel from operadores
      where loja_id = p_loja_id
      and user_id = (select auth.uid())
      and status = 'ativo'
      limit 1
    ),
    case
      when exists (
        select 1 from lojas
        where id = p_loja_id
        and dono_id = (select auth.uid())
      ) then 'dono'
      else null
    end
  );
$$;
