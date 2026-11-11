-- 관리자가 첨부 파일을 삭제할 수 있도록 권한을 추가한다. 관리자만 가능하다.
begin;

grant delete on public.church_cms_assets to authenticated;

create policy cms_assets_delete on public.church_cms_assets
  for delete to authenticated
  using (public.is_church_admin());

create policy church_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'church-media' and public.is_church_admin());

commit;
