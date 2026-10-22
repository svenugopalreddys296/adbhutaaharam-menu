-- Adbhutaaharam QR Menu: run this script in Supabase -> SQL Editor.
-- Create the first admin account in Supabase Authentication before running
-- the final INSERT section below. Never expose a service_role key in frontend files.

create extension if not exists pgcrypto;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  category text not null check (char_length(trim(category)) between 1 and 60),
  description text,
  price numeric(10,2) not null check (price >= 0),
  price_display text,
  is_must_try boolean not null default false,
  image_url text,
  is_vegetarian boolean not null default false,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, name)
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.menu_items enable row level security;
alter table public.admins enable row level security;

-- Anyone can read menu data. The UI marks unavailable items instead of hiding them.
drop policy if exists "Public can read menu items" on public.menu_items;
create policy "Public can read menu items"
on public.menu_items for select
to anon, authenticated
using (true);

-- Admins can read only their own admin record.
drop policy if exists "Admins can read own admin record" on public.admins;
create policy "Admins can read own admin record"
on public.admins for select
to authenticated
using (auth.uid() = user_id);

-- Only accounts listed in public.admins may create, update, or delete menu items.
drop policy if exists "Admins can insert menu items" on public.menu_items;
create policy "Admins can insert menu items"
on public.menu_items for insert
to authenticated
with check (exists (select 1 from public.admins where admins.user_id = auth.uid()));

drop policy if exists "Admins can update menu items" on public.menu_items;
create policy "Admins can update menu items"
on public.menu_items for update
to authenticated
using (exists (select 1 from public.admins where admins.user_id = auth.uid()))
with check (exists (select 1 from public.admins where admins.user_id = auth.uid()));

drop policy if exists "Admins can delete menu items" on public.menu_items;
create policy "Admins can delete menu items"
on public.menu_items for delete
to authenticated
using (exists (select 1 from public.admins where admins.user_id = auth.uid()));

-- IMPORTANT: after creating your admin user in Supabase Authentication,
-- copy that user's UUID and run the following command separately, replacing
-- YOUR_AUTH_USER_UUID with the real UUID:
-- insert into public.admins (user_id) values ('YOUR_AUTH_USER_UUID');
