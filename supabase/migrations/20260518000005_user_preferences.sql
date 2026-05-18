-- ============================================================================
-- EP Cloud :: 005 :: User notification preferences
-- ============================================================================

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notify_security boolean not null default true,
  notify_share_activity boolean not null default true,
  notify_storage_warnings boolean not null default true,
  notify_product_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.tg_set_updated_at();

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "user_preferences_insert_own"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_preferences_update_own"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.user_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;
