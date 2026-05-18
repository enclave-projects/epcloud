-- ============================================================================
-- EP Cloud :: 004 :: Encrypted, signed share links + view tracking
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  password_hash text,
  expires_at timestamptz,
  max_views int,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  allowed_origins text,
  allow_download boolean not null default false,
  allow_embed boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint max_views_positive check (max_views is null or max_views > 0),
  constraint allowed_origins_length check (
    allowed_origins is null or char_length(allowed_origins) <= 2048
  )
);

create index share_links_owner_created
  on public.share_links (owner_id, created_at desc);
create index share_links_media on public.share_links (media_id);
create index share_links_active
  on public.share_links (token_hash)
  where revoked_at is null;

create trigger share_links_set_updated_at
  before update on public.share_links
  for each row execute function public.tg_set_updated_at();

alter table public.share_links enable row level security;

create policy "share_links_select_own"
  on public.share_links for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "share_links_insert_own"
  on public.share_links for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "share_links_update_own"
  on public.share_links for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "share_links_delete_own"
  on public.share_links for delete to authenticated
  using ((select auth.uid()) = owner_id);

create table public.share_link_views (
  id bigserial primary key,
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  viewer_ip_hash text,
  viewer_user_agent text,
  origin text,
  outcome text not null check (
    outcome in (
      'success', 'expired', 'revoked', 'view_limit',
      'invalid_password', 'origin_denied', 'rate_limited', 'not_found'
    )
  ),
  viewed_at timestamptz not null default now()
);
create index share_link_views_link_time
  on public.share_link_views (share_link_id, viewed_at desc);

alter table public.share_link_views enable row level security;
create policy "share_link_views_owner_read"
  on public.share_link_views for select to authenticated
  using (
    exists (
      select 1
      from public.share_links sl
      where sl.id = share_link_id
        and sl.owner_id = (select auth.uid())
    )
  );

create or replace function public.hash_share_password(p_password text)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select extensions.crypt(p_password, extensions.gen_salt('bf', 10));
$$;

revoke all on function public.hash_share_password(text) from public;
grant execute on function public.hash_share_password(text) to authenticated;

create or replace function public.resolve_share_link(
  p_token_hash text,
  p_password text,
  p_origin text,
  p_ip_hash text,
  p_user_agent text
)
returns table (
  link_id uuid,
  media_id uuid,
  storage_path text,
  thumbnail_path text,
  mime_type text,
  kind public.media_kind,
  size_bytes bigint,
  width int,
  height int,
  duration_seconds numeric,
  original_filename text,
  allow_download boolean,
  allow_embed boolean,
  outcome text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.share_links%rowtype;
  v_media public.media%rowtype;
  v_outcome text;
  v_origin_ok boolean;
begin
  select * into v_row from public.share_links
   where token_hash = p_token_hash
   for update;

  if not found then
    insert into public.share_link_views
      (share_link_id, viewer_ip_hash, viewer_user_agent, origin, outcome)
    values
      (uuid_nil(), p_ip_hash, left(coalesce(p_user_agent, ''), 256),
       left(coalesce(p_origin, ''), 256), 'not_found');
    return query select null::uuid, null::uuid, null::text, null::text,
                        null::text, null::public.media_kind, null::bigint,
                        null::int, null::int, null::numeric, null::text,
                        null::boolean, null::boolean, 'not_found'::text;
    return;
  end if;

  v_outcome := 'success';

  if v_row.revoked_at is not null then
    v_outcome := 'revoked';
  elsif v_row.expires_at is not null and v_row.expires_at < now() then
    v_outcome := 'expired';
  elsif v_row.max_views is not null and v_row.view_count >= v_row.max_views then
    v_outcome := 'view_limit';
  elsif v_row.password_hash is not null
    and (p_password is null
         or extensions.crypt(p_password, v_row.password_hash) <> v_row.password_hash)
  then
    v_outcome := 'invalid_password';
  end if;

  if v_outcome = 'success'
     and v_row.allowed_origins is not null
     and length(coalesce(p_origin, '')) > 0
  then
    select exists (
      select 1
      from unnest(string_to_array(v_row.allowed_origins, ',')) as o(origin)
      where lower(trim(o.origin)) = lower(p_origin)
    ) into v_origin_ok;

    if not coalesce(v_origin_ok, false) then
      v_outcome := 'origin_denied';
    end if;
  end if;

  insert into public.share_link_views
    (share_link_id, viewer_ip_hash, viewer_user_agent, origin, outcome)
  values
    (v_row.id, p_ip_hash, left(coalesce(p_user_agent, ''), 256),
     left(coalesce(p_origin, ''), 256), v_outcome);

  if v_outcome <> 'success' then
    return query select v_row.id, null::uuid, null::text, null::text,
                        null::text, null::public.media_kind, null::bigint,
                        null::int, null::int, null::numeric, null::text,
                        null::boolean, null::boolean, v_outcome;
    return;
  end if;

  update public.share_links
    set view_count = view_count + 1,
        last_viewed_at = now()
  where id = v_row.id;

  select * into v_media from public.media where id = v_row.media_id;
  if not found then
    return query select v_row.id, null::uuid, null::text, null::text,
                        null::text, null::public.media_kind, null::bigint,
                        null::int, null::int, null::numeric, null::text,
                        null::boolean, null::boolean, 'not_found'::text;
    return;
  end if;

  return query select
    v_row.id,
    v_media.id,
    v_media.storage_path,
    v_media.thumbnail_path,
    v_media.mime_type,
    v_media.kind,
    v_media.size_bytes,
    v_media.width,
    v_media.height,
    v_media.duration_seconds,
    v_media.original_filename,
    v_row.allow_download,
    v_row.allow_embed,
    'success'::text;
end;
$$;

revoke all on function public.resolve_share_link(text, text, text, text, text)
  from public;
grant execute on function public.resolve_share_link(text, text, text, text, text)
  to service_role;
