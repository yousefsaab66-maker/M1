-- Per-category size groups (necklace / bracelet / ring) for staff-managed products.
alter table public.products
  add column if not exists size_options jsonb;
