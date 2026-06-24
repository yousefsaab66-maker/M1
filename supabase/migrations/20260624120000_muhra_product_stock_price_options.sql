-- MUHRA: inventory + optional price slots (up to 9 per product).
alter table public.products
  add column if not exists stock integer,
  add column if not exists price_options jsonb;

comment on column public.products.stock is 'Null = untracked (in stock). 0 = out of stock. Positive = quantity on hand.';
comment on column public.products.price_options is 'Up to 9 optional price slots with staff enable flags.';
