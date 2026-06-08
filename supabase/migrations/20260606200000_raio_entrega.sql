alter table lojas add column if not exists latitude numeric(10,7);
alter table lojas add column if not exists longitude numeric(10,7);
alter table lojas add column if not exists raio_maximo_km numeric(5,1) default 10;
alter table lojas add column if not exists faixas_entrega jsonb;
