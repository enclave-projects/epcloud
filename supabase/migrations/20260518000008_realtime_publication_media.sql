-- ============================================================================
-- EP Cloud :: 008 :: Add media + share_links to supabase_realtime publication
-- ============================================================================
-- Without this, postgres_changes subscriptions on public.media never fire,
-- and the UI doesn't refresh when uploads / thumbnail-generation finish.

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end$$;

alter publication supabase_realtime add table public.media;
alter publication supabase_realtime add table public.share_links;
