-- Adiciona coluna tempo_entrega_min à tabela lojas.
-- Tempo médio de entrega em minutos. Nullable: se null, não exibe nada no cardápio.
alter table lojas add column if not exists tempo_entrega_min integer;
