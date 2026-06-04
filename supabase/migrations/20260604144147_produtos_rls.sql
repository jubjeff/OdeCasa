-- Habilita RLS na tabela produtos (idempotente)
alter table produtos enable row level security;

-- Remove se já existir (evita duplicata)
drop policy if exists "dono acessa produtos da própria loja" on produtos;

-- Dono só acessa produtos da própria loja (via lojas.dono_id)
create policy "dono acessa produtos da própria loja"
on produtos for all
using (
  loja_id in (
    select id from lojas where dono_id = auth.uid()
  )
);
