-- MUHRA: Expo push tokens (customers + staff)

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  role text not null check (role in ('customer', 'staff')),
  phone text,
  staff_user text,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_role_idx on public.push_tokens (role);
create index if not exists push_tokens_phone_idx on public.push_tokens (phone) where phone is not null;

alter table public.push_tokens enable row level security;

-- No public policies: service role only via API routes.
