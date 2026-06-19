-- Pedidos manuais (balcão)
-- Adiciona coluna `origem` e `criado_por` à tabela pedidos,
-- e ajusta as RLS policies de INSERT para permitir que operadores
-- (atendente+) criem pedidos manuais sem quebrar o checkout público.

-- ── 1. Novas colunas ──────────────────────────────────────────────────────────

alter table pedidos
  add column if not exists origem text not null default 'delivery'
    check (origem in ('delivery', 'manual'));

alter table pedidos
  add column if not exists criado_por uuid references profiles(id);

create index if not exists pedidos_loja_origem_idx on pedidos(loja_id, origem);

-- ── 2. RLS — INSERT em pedidos ────────────────────────────────────────────────
-- Policy adicional: operadores (atendente+) e donos podem criar pedidos manuais.
-- A policy existente de checkout anônimo/cliente NÃO é removida aqui — apenas
-- acrescentamos um novo motivo válido para permitir INSERT.

drop policy if exists "pedidos: operador insere manual" on pedidos;

create policy "pedidos: operador insere manual" on pedidos
  for insert to authenticated
  with check (
    origem = 'manual'
    and criado_por = (select auth.uid())
    and (
      exists (
        select 1 from lojas
        where lojas.id = pedidos.loja_id
          and lojas.dono_id = (select auth.uid())
      )
      or operador_tem_acesso(loja_id, 'atendente')
    )
  );

-- ── 3. RLS — INSERT em itens_pedido ───────────────────────────────────────────
-- Permite que atendente+ insira itens de pedidos manuais da própria loja.

drop policy if exists "itens: operador insere para pedido manual" on itens_pedido;

create policy "itens: operador insere para pedido manual" on itens_pedido
  for insert to authenticated
  with check (
    exists (
      select 1 from pedidos p
      join lojas l on l.id = p.loja_id
      where p.id = itens_pedido.pedido_id
        and p.origem = 'manual'
        and (
          l.dono_id = (select auth.uid())
          or operador_tem_acesso(l.id, 'atendente')
        )
    )
  );
