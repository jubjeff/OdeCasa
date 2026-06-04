-- Habilita RLS na tabela categorias (idempotente)
alter table categorias enable row level security;

-- Remove a policy se já existir (evita erro de duplicata)
drop policy if exists "dono acessa categorias da própria loja" on categorias;

-- Dono só acessa categorias da própria loja (via lojas.dono_id)
create policy "dono acessa categorias da própria loja"
on categorias for all
using (
  loja_id in (
    select id from lojas where dono_id = auth.uid()
  )
);
