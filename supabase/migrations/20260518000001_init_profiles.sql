-- ============================================================================
-- EP Cloud :: 001 :: User profiles + auto-creation trigger + RLS
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint username_length check (
    username is null or (char_length(username) between 3 and 30)
  ),
  constraint username_format check (
    username is null or username ~ '^[a-zA-Z0-9_-]+$'
  ),
  constraint full_name_length check (
    full_name is null or char_length(full_name) <= 100
  ),
  constraint avatar_url_length check (
    avatar_url is null or char_length(avatar_url) <= 2048
  )
);

comment on table public.profiles is 'User profile data linked 1:1 to auth.users.';

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using ((select auth.uid()) = id);
