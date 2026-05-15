-- MUHRA: إعدادات الموقع (نصوص، فئات، الصفحة الرئيسية) — صف واحد يُقرأ من كل الأجهزة
-- طبّق من Supabase → SQL → New query

create table if not exists public.site_settings (
  id text primary key default 'default',
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, content)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_public_select" on public.site_settings;
create policy "site_settings_public_select"
  on public.site_settings
  for select
  using (true);
