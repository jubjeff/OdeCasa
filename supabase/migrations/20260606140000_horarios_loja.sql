-- Adiciona coluna horarios à tabela lojas.
-- Estrutura por dia: { "seg": { "aberto": true, "abre": "08:00", "fecha": "22:00" }, ... }
alter table lojas add column if not exists horarios jsonb;
