-- ============================================================================
-- EP Cloud :: 002 :: Auth audit log, rate limiting & brute-force protection
-- ============================================================================

create table public.auth_audit_log (
  id bigserial primary key,
  email_hash text not null,
  ip_hash text,
  user_agent text,
  event_type text not null check (
    event_type in (
      'login_success',
      'login_failure',
      'signup_success',
      'signup_failure',
      'password_reset_request',
      'rate_limit_block',
      'brute_force_block'
    )
  ),
  created_at timestamptz not null default now()
);

create index auth_audit_log_email_created
  on public.auth_audit_log (email_hash, created_at desc);
create index auth_audit_log_created
  on public.auth_audit_log (created_at desc);

alter table public.auth_audit_log enable row level security;

create table public.rate_limit_buckets (
  bucket_key text primary key,
  hit_count int not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);

alter table public.rate_limit_buckets enable row level security;

create or replace function public.hash_token(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(lower(coalesce(input, '')), 'sha256'), 'hex');
$$;

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_max_hits int,
  p_window_seconds int,
  p_block_seconds int default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.rate_limit_buckets%rowtype;
  v_now timestamptz := now();
begin
  select * into v_row
  from public.rate_limit_buckets
  where bucket_key = p_bucket_key
  for update;

  if not found then
    insert into public.rate_limit_buckets (bucket_key, hit_count, window_started_at)
    values (p_bucket_key, 1, v_now);
    return true;
  end if;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return false;
  end if;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) < v_now then
    update public.rate_limit_buckets
    set hit_count = 1,
        window_started_at = v_now,
        blocked_until = null
    where bucket_key = p_bucket_key;
    return true;
  end if;

  if v_row.hit_count + 1 > p_max_hits then
    update public.rate_limit_buckets
    set blocked_until = case
          when p_block_seconds is not null
            then v_now + make_interval(secs => p_block_seconds)
          else v_row.blocked_until
        end
    where bucket_key = p_bucket_key;
    return false;
  end if;

  update public.rate_limit_buckets
  set hit_count = v_row.hit_count + 1
  where bucket_key = p_bucket_key;
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, int, int, int) from public;
grant execute on function public.consume_rate_limit(text, int, int, int) to anon, authenticated;

create or replace function public.check_brute_force(
  p_email text,
  p_max_failures int default 5,
  p_window_minutes int default 15
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email_hash text := public.hash_token(p_email);
  v_failures int;
begin
  select count(*) into v_failures
  from public.auth_audit_log
  where email_hash = v_email_hash
    and event_type in ('login_failure', 'signup_failure')
    and created_at > now() - make_interval(mins => p_window_minutes);

  return v_failures < p_max_failures;
end;
$$;

revoke all on function public.check_brute_force(text, int, int) from public;
grant execute on function public.check_brute_force(text, int, int) to anon, authenticated;

create or replace function public.record_auth_attempt(
  p_email text,
  p_event_type text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_type not in (
    'login_success', 'login_failure',
    'signup_success', 'signup_failure',
    'password_reset_request',
    'rate_limit_block', 'brute_force_block'
  ) then
    raise exception 'invalid event_type %', p_event_type;
  end if;

  insert into public.auth_audit_log (email_hash, user_agent, event_type)
  values (
    public.hash_token(p_email),
    left(coalesce(p_user_agent, ''), 256),
    p_event_type
  );
end;
$$;

revoke all on function public.record_auth_attempt(text, text, text) from public;
grant execute on function public.record_auth_attempt(text, text, text) to anon, authenticated;
