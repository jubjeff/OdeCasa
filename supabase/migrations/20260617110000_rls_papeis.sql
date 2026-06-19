-- F1-S2: Reescrita das RLS policies conforme tabela de permissões por papel
-- Pré-requisito: F1-S1 (operadores + operador_tem_acesso) aplicado

-- ── pedidos ───────────────────────────────────────────────────────────────────

drop policy if exists "pedidos: dono ve os proprios" on pedidos;
drop policy if exists "pedidos: dono ou operador ve" on pedidos;

create policy "pedidos: dono ou operador ve" on pedidos
  for select to authenticated
  using (
    exists (select 1 from lojas where lojas.id = pedidos.loja_id and lojas.dono_id = (select auth.uid()))
    or operador_tem_acesso(pedidos.loja_id, 'caixa')
  );

drop policy if exists "pedidos: dono atualiza status" on pedidos;
drop policy if exists "pedidos: dono ou operador atualiza" on pedidos;

create policy "pedidos: dono ou operador atualiza" on pedidos
  for update to authenticated
  using (
    exists (select 1 from lojas where lojas.id = pedidos.loja_id and lojas.dono_id = (select auth.uid()))
    or operador_tem_acesso(pedidos.loja_id, 'caixa')
  )
  with check (
    -- Dono sempre pode; caixa só avança (não cancela); atendente+ pode cancelar
    exists (select 1 from lojas where lojas.id = pedidos.loja_id and lojas.dono_id = (select auth.uid()))
    or (status != 'cancelado' and operador_tem_acesso(pedidos.loja_id, 'caixa'))
    or (status = 'cancelado'  and operador_tem_acesso(pedidos.loja_id, 'atendente'))
  );

-- ── itens_pedido ──────────────────────────────────────────────────────────────

drop policy if exists "itens: dono ve os proprios" on itens_pedido;
drop policy if exists "itens: dono ou operador ve" on itens_pedido;

create policy "itens: dono ou operador ve" on itens_pedido
  for select to authenticated
  using (
    exists (
      select 1 from pedidos p
      join lojas l on l.id = p.loja_id
      where p.id = itens_pedido.pedido_id
      and (l.dono_id = (select auth.uid()) or operador_tem_acesso(l.id, 'caixa'))
    )
  );

-- ── produtos — atendente+ ─────────────────────────────────────────────────────

drop policy if exists "produtos: dono gerencia" on produtos;
drop policy if exists "produtos: dono ou atendente gerencia" on produtos;

create policy "produtos: dono ou atendente gerencia" on produtos
  for all to authenticated
  using (
    exists (select 1 from lojas where lojas.id = produtos.loja_id and lojas.dono_id = (select auth.uid()))
    or operador_tem_acesso(produtos.loja_id, 'atendente')
  )
  with check (
    exists (select 1 from lojas where lojas.id = produtos.loja_id and lojas.dono_id = (select auth.uid()))
    or operador_tem_acesso(produtos.loja_id, 'atendente')
  );

-- ── categorias — atendente+ ───────────────────────────────────────────────────

drop policy if exists "categorias: dono gerencia" on categorias;
drop policy if exists "categorias: dono ou atendente gerencia" on categorias;

create policy "categorias: dono ou atendente gerencia" on categorias
  for all to authenticated
  using (
    exists (select 1 from lojas where lojas.id = categorias.loja_id and lojas.dono_id = (select auth.uid()))
    or operador_tem_acesso(categorias.loja_id, 'atendente')
  )
  with check (
    exists (select 1 from lojas where lojas.id = categorias.loja_id and lojas.dono_id = (select auth.uid()))
    or operador_tem_acesso(categorias.loja_id, 'atendente')
  );

-- ── lojas — leitura caixa+; edição gerente+ ───────────────────────────────────

drop policy if exists "lojas: operador le" on lojas;

create policy "lojas: operador le" on lojas
  for select to authenticated
  using (
    dono_id = (select auth.uid())
    or operador_tem_acesso(id, 'caixa')
  );

drop policy if exists "lojas: dono edita" on lojas;
drop policy if exists "lojas: dono ou gerente edita" on lojas;

create policy "lojas: dono ou gerente edita" on lojas
  for update to authenticated
  using (
    dono_id = (select auth.uid())
    or operador_tem_acesso(id, 'gerente')
  )
  with check (
    dono_id = (select auth.uid())
    or operador_tem_acesso(id, 'gerente')
  );

-- ── avaliacoes — gerente+ ────────────────────────────────────────────────────

drop policy if exists "avaliacao: dono ve da propria loja" on avaliacoes;
drop policy if exists "avaliacao: dono ou gerente ve" on avaliacoes;

create policy "avaliacao: dono ou gerente ve" on avaliacoes
  for select to authenticated
  using (
    exists (select 1 from lojas where lojas.id = avaliacoes.loja_id and lojas.dono_id = (select auth.uid()))
    or operador_tem_acesso(avaliacoes.loja_id, 'gerente')
  );

-- ── uso_mensal — gerente+ ────────────────────────────────────────────────────

drop policy if exists "uso: dono ve" on uso_mensal;
drop policy if exists "uso: dono ou gerente ve" on uso_mensal;

create policy "uso: dono ou gerente ve" on uso_mensal
  for select to authenticated
  using (
    exists (select 1 from lojas where lojas.id = uso_mensal.loja_id and lojas.dono_id = (select auth.uid()))
    or operador_tem_acesso(uso_mensal.loja_id, 'gerente')
  );
