-- 회원 전용 파일(members/)은 공개 글에 붙어 있어도 방문객이 읽을 수 없게 한다.
begin;

drop policy if exists church_media_published_read on storage.objects;
create policy church_media_published_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'church-media' and name not like 'members/%' and public.church_asset_is_public(name));

drop policy if exists cms_assets_published on public.church_cms_assets;
create policy cms_assets_published on public.church_cms_assets
  for select to anon, authenticated
  using (object_path not like 'members/%' and public.church_asset_is_public(object_path));

commit;
