-- ============================================================================
-- EP Cloud :: 003 :: Folders, media, storage buckets & RLS
-- ============================================================================

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint folder_name_length check (char_length(name) between 1 and 100),
  constraint folder_name_no_slash check (name !~ '/')
);

create unique index folders_owner_parent_name
  on public.folders (owner_id, coalesce(parent_id::text, ''), lower(name));
create index folders_owner_parent on public.folders (owner_id, parent_id);

create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.tg_set_updated_at();

alter table public.folders enable row level security;

create policy "folders_select_own"
  on public.folders for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "folders_insert_own"
  on public.folders for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "folders_update_own"
  on public.folders for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "folders_delete_own"
  on public.folders for delete to authenticated
  using ((select auth.uid()) = owner_id);

create type public.media_kind as enum ('image', 'video', 'other');
create type public.media_status as enum ('uploading', 'processing', 'ready', 'failed');

create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  storage_path text not null unique,
  thumbnail_path text,
  original_filename text not null,
  mime_type text not null,
  kind public.media_kind not null default 'other',
  status public.media_status not null default 'uploading',
  size_bytes bigint not null default 0,
  width int,
  height int,
  duration_seconds numeric(10, 3),
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint original_filename_length check (
    char_length(original_filename) between 1 and 255
  ),
  constraint mime_type_length check (char_length(mime_type) between 1 and 127),
  constraint size_non_negative check (size_bytes >= 0),
  constraint width_non_negative check (width is null or width >= 0),
  constraint height_non_negative check (height is null or height >= 0),
  constraint duration_non_negative check (
    duration_seconds is null or duration_seconds >= 0
  )
);

create index media_owner_created on public.media (owner_id, created_at desc);
create index media_owner_folder on public.media (owner_id, folder_id);
create index media_owner_kind on public.media (owner_id, kind);
create index media_owner_status on public.media (owner_id, status);

create extension if not exists pg_trgm with schema extensions;
create index media_filename_trgm
  on public.media using gin (original_filename extensions.gin_trgm_ops);

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.tg_set_updated_at();

alter table public.media enable row level security;

create policy "media_select_own"
  on public.media for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "media_insert_own"
  on public.media for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "media_update_own"
  on public.media for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "media_delete_own"
  on public.media for delete to authenticated
  using ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'media', 'media', false, 2147483648,
    array[
      'image/jpeg','image/png','image/webp','image/avif','image/gif','image/heic','image/heif',
      'video/mp4','video/webm','video/quicktime','video/x-matroska','video/x-msvideo',
      'audio/mpeg','audio/ogg','audio/wav','audio/mp4',
      'application/pdf'
    ]::text[]
  ),
  (
    'thumbnails', 'thumbnails', false, 10485760,
    array['image/jpeg','image/webp']::text[]
  )
on conflict (id) do nothing;

create policy "media_objects_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
create policy "media_objects_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
create policy "media_objects_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
create policy "media_objects_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "thumbnail_objects_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'thumbnails'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create or replace function public.get_user_storage_usage()
returns table (
  used_bytes bigint,
  file_count bigint,
  image_count bigint,
  video_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(size_bytes), 0)::bigint as used_bytes,
    count(*)::bigint as file_count,
    count(*) filter (where kind = 'image')::bigint as image_count,
    count(*) filter (where kind = 'video')::bigint as video_count
  from public.media
  where owner_id = (select auth.uid())
    and status in ('processing', 'ready');
$$;

grant execute on function public.get_user_storage_usage() to authenticated;
