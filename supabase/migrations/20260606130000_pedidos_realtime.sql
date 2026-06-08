-- Habilita o Realtime na tabela de pedidos para que o cliente receba a
-- mudança de status na hora (sino de notificações), sem precisar recarregar.
-- Sem isto, o canal postgres_changes conecta mas nunca recebe eventos, e só
-- o polling de reforço (20s) atualiza — daí a sensação de "só no refresh".

-- replica identity full: garante que o registro completo (incl. cliente_id)
-- vá no WAL, para o filtro `cliente_id=eq.<id>` casar em UPDATE/DELETE.
alter table pedidos replica identity full;

-- Adiciona a tabela à publicação do Realtime (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table pedidos;
  end if;
end $$;
