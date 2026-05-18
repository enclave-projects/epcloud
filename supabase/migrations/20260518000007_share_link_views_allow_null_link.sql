-- ============================================================================
-- EP Cloud :: 007 :: Allow share_link_views.share_link_id to be NULL
-- ============================================================================
-- The 'not_found' audit path needs to log attempts against tokens that
-- don't match any row. Allow NULL for share_link_id and use it explicitly.

alter table public.share_link_views
  alter column share_link_id drop not null;

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
      (null, p_ip_hash, left(coalesce(p_user_agent, ''), 256),
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
