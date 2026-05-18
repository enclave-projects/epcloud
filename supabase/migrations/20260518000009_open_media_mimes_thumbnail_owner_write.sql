-- ============================================================================
-- EP Cloud :: 009 :: Open `media` bucket to any mime type + allow owners to
--                    write their own thumbnails (for client-side video frame
--                    generation, since edge-runtime can't run ffmpeg).
-- ============================================================================

update storage.buckets
   set allowed_mime_types = null
 where id = 'media';

create policy "thumbnail_objects_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'thumbnails'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "thumbnail_objects_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'thumbnails'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'thumbnails'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "thumbnail_objects_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'thumbnails'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
