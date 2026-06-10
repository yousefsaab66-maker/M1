-- MUHRA: optional product videos (R2 URLs) alongside images
alter table public.products
  add column if not exists videos text[] not null default '{}';
