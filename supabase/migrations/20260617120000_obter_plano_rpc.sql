-- Função security definer para expor dados de plano a donos E operadores ativos.
-- Contorna o RLS de assinaturas (que é exclusivo ao dono) sem abrir a tabela
-- para operadores — eles só conseguem o resultado desta chamada controlada.

create or replace function obter_plano_loja(p_loja_id uuid)
returns json language plpgsql security definer as $$
declare
  v_autorizado boolean;
  v_resultado  json;
begin
  -- Verifica que o caller é dono OU operador ativo da loja
  select (
    exists (
      select 1 from lojas
      where id = p_loja_id
      and dono_id = (select auth.uid())
    )
    or exists (
      select 1 from operadores
      where loja_id = p_loja_id
      and user_id   = (select auth.uid())
      and status    = 'ativo'
    )
  ) into v_autorizado;

  if not v_autorizado then
    return null;
  end if;

  -- Lê assinaturas+planos ignorando RLS (security definer)
  select row_to_json(r) into v_resultado
  from (
    select
      a.status            as assinatura_status,
      a.vence_em,
      pl.id               as plano_id,
      pl.nome             as plano_nome,
      pl.preco_mensal,
      pl.limite_pedidos_mes,
      pl.features
    from assinaturas a
    join planos pl on pl.id = a.plano_id
    where a.loja_id = p_loja_id
    limit 1
  ) r;

  return v_resultado; -- null quando loja não tem assinatura cadastrada
end;
$$;
