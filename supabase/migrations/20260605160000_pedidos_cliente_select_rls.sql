-- Permite que o cliente logado leia os próprios pedidos e seus itens.
-- (As policies existentes davam acesso apenas ao dono, via loja_id.)

alter table pedidos enable row level security;
alter table itens_pedido enable row level security;

-- Cliente vê os próprios pedidos
drop policy if exists "pedidos: cliente ve os proprios" on pedidos;
create policy "pedidos: cliente ve os proprios"
on pedidos for select
to authenticated
using (cliente_id = (select auth.uid()));

-- Cliente vê os itens dos próprios pedidos
drop policy if exists "itens: cliente ve dos proprios pedidos" on itens_pedido;
create policy "itens: cliente ve dos proprios pedidos"
on itens_pedido for select
to authenticated
using (
  exists (
    select 1 from pedidos
    where pedidos.id = itens_pedido.pedido_id
      and pedidos.cliente_id = (select auth.uid())
  )
);
