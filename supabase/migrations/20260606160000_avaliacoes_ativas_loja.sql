alter table lojas
  add column if not exists avaliacoes_ativas boolean not null default true;
