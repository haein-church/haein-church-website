-- 관리자가 회원 전용 파일을 올릴 수 있게 한다 (church-media/members/).
-- 공개 파일은 기존대로 <user-id>/ 아래에 저장된다.
begin;

alter table public.church_cms_assets drop constraint if exists church_cms_assets_object_path_check;
alter table public.church_cms_assets add constraint church_cms_assets_object_path_check
  check (object_path ~ '^(members|[a-f0-9-]+)/[a-f0-9-]+\.(jpg|jpeg|png|webp|gif|pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx|zip|mp3|mp4|m4a|wav)$');

create policy church_media_members_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'church-media' and public.is_church_admin()
    and name ~ '^members/[a-f0-9-]+\.(jpg|jpeg|png|webp|gif|pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx|zip|mp3|mp4|m4a|wav)$');

commit;
