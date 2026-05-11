-- MUHRA: public bucket for staff-uploaded catalogue images (Next.js uploads via service role)
-- Apply in Supabase → SQL Editor (or migrations pipeline)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'muhra-products',
  'muhra-products',
  true,
  12582912, -- 12 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_muhra_products_public_read" on storage.objects;

create policy "storage_muhra_products_public_read"
  on storage.objects
  for select
  using (bucket_id = 'muhra-products');
