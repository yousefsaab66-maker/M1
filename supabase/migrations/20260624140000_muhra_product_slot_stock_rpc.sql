-- MUHRA: per-slot inventory in price_options / product_options JSONB + atomic adjust RPCs.

comment on column public.products.price_options is
  'Up to 9 optional price slots; each may include optional stock (null/omitted = use global stock).';
comment on column public.products.product_options is
  'Up to 9 optional variant slots; each may include optional stock (null/omitted = use global stock).';

-- Returns new stock (slot or global), or: -1 insufficient, -2 not found, -3 unlimited (null stock).
create or replace function public.decrement_product_stock(
  p_product_id uuid,
  p_qty integer,
  p_price_slot_index integer default null,
  p_product_option_slot_index integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_new integer;
  v_price_opts jsonb;
  v_product_opts jsonb;
  v_opts jsonb;
  v_elem jsonb;
  v_slot_stock integer;
  v_idx integer;
  v_use_price boolean;
begin
  if p_qty is null or p_qty <= 0 then
    return -1;
  end if;

  select stock, price_options, product_options
    into v_stock, v_price_opts, v_product_opts
    from products
    where id = p_product_id
    for update;

  if not found then
    return -2;
  end if;

  v_use_price := p_price_slot_index is not null
    and p_price_slot_index >= 0
    and p_price_slot_index < 9;

  if v_use_price then
    v_opts := v_price_opts;
    v_idx := p_price_slot_index;
  elsif p_product_option_slot_index is not null
    and p_product_option_slot_index >= 0
    and p_product_option_slot_index < 9 then
    v_opts := v_product_opts;
    v_idx := p_product_option_slot_index;
    v_use_price := false;
  else
    v_opts := null;
  end if;

  if v_opts is not null
    and jsonb_typeof(v_opts) = 'array'
    and jsonb_array_length(v_opts) > v_idx then
    v_elem := v_opts -> v_idx;
    if v_elem ? 'stock' and v_elem ->> 'stock' is not null then
      v_slot_stock := (v_elem ->> 'stock')::integer;
      if v_slot_stock < p_qty then
        return -1;
      end if;
      v_new := v_slot_stock - p_qty;
      v_opts := jsonb_set(v_opts, array[v_idx::text, 'stock'], to_jsonb(v_new), false);
      if v_use_price then
        update products
          set price_options = v_opts, updated_at = now()
          where id = p_product_id;
      else
        update products
          set product_options = v_opts, updated_at = now()
          where id = p_product_id;
      end if;
      return v_new;
    end if;
  end if;

  -- Fallback: global stock
  select stock into v_stock from products where id = p_product_id;
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

create or replace function public.increment_product_stock(
  p_product_id uuid,
  p_qty integer,
  p_price_slot_index integer default null,
  p_product_option_slot_index integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_new integer;
  v_price_opts jsonb;
  v_product_opts jsonb;
  v_opts jsonb;
  v_elem jsonb;
  v_slot_stock integer;
  v_idx integer;
  v_use_price boolean;
begin
  if p_qty is null or p_qty <= 0 then
    return -1;
  end if;

  select stock, price_options, product_options
    into v_stock, v_price_opts, v_product_opts
    from products
    where id = p_product_id
    for update;

  if not found then
    return -2;
  end if;

  v_use_price := p_price_slot_index is not null
    and p_price_slot_index >= 0
    and p_price_slot_index < 9;

  if v_use_price then
    v_opts := v_price_opts;
    v_idx := p_price_slot_index;
  elsif p_product_option_slot_index is not null
    and p_product_option_slot_index >= 0
    and p_product_option_slot_index < 9 then
    v_opts := v_product_opts;
    v_idx := p_product_option_slot_index;
    v_use_price := false;
  else
    v_opts := null;
  end if;

  if v_opts is not null
    and jsonb_typeof(v_opts) = 'array'
    and jsonb_array_length(v_opts) > v_idx then
    v_elem := v_opts -> v_idx;
    if v_elem ? 'stock' and v_elem ->> 'stock' is not null then
      v_slot_stock := (v_elem ->> 'stock')::integer;
      v_new := v_slot_stock + p_qty;
      v_opts := jsonb_set(v_opts, array[v_idx::text, 'stock'], to_jsonb(v_new), false);
      if v_use_price then
        update products
          set price_options = v_opts, updated_at = now()
          where id = p_product_id;
      else
        update products
          set product_options = v_opts, updated_at = now()
          where id = p_product_id;
      end if;
      return v_new;
    end if;
  end if;

  select stock into v_stock from products where id = p_product_id;
  if v_stock is null then
    return -3;
  end if;

  v_new := v_stock + p_qty;
  update products set stock = v_new, updated_at = now() where id = p_product_id;
  return v_new;
end;
$$;
