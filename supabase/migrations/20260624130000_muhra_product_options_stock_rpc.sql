-- MUHRA: product variant options (up to 9 slots) + atomic stock adjust RPCs.
alter table public.products
  add column if not exists product_options jsonb;

comment on column public.products.product_options is 'Up to 9 optional product variant/description slots with staff enable flags.';

-- Returns new stock, or negative codes: -1 insufficient, -2 not found, -3 unlimited (null stock).
create or replace function public.decrement_product_stock(p_product_id uuid, p_qty integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_new integer;
begin
  if p_qty is null or p_qty <= 0 then
    return -1;
  end if;

  select stock into v_stock from products where id = p_product_id for update;
  if not found then
    return -2;
  end if;
  if v_stock is null then
    return -3;
  end if;
  if v_stock < p_qty then
    return -1;
  end if;

  v_new := v_stock - p_qty;
  update products set stock = v_new, updated_at = now() where id = p_product_id;
  return v_new;
end;
$$;

create or replace function public.increment_product_stock(p_product_id uuid, p_qty integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_new integer;
begin
  if p_qty is null or p_qty <= 0 then
    return -1;
  end if;

  select stock into v_stock from products where id = p_product_id for update;
  if not found then
    return -2;
  end if;
  if v_stock is null then
    return -3;
  end if;

  v_new := v_stock + p_qty;
  update products set stock = v_new, updated_at = now() where id = p_product_id;
  return v_new;
end;
$$;
