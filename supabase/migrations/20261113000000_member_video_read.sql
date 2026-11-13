-- 승인된 회원이 회원 전용 영상(church-media/members/)을 열람할 수 있게 한다.
-- 방문객(anon)은 여전히 열람할 수 없다. 관리자 권한은 기존 정책이 그대로 적용된다.
begin;

create policy church_media_member_read on storage.objects
  for select to authenticated
  using (bucket_id = 'church-media' and name like 'members/%' and public.is_approved_member());

commit;
