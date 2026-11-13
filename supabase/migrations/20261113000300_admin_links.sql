-- 관리자가 글에 외부 링크(https://)를 첨부할 수 있게 save_church_content의 첨부 검사를 고친다.
-- 나머지 동작(권한 검사, 버전 검사, 이력 기록, 원본 복원)은 기존과 같다.
begin;

create or replace function public.save_church_content(record_key text,new_value jsonb,expected_revision bigint,restore_original boolean default false)
returns bigint language plpgsql security invoker set search_path='' as $$
declare current_row public.church_cms_site%rowtype; previous jsonb; f jsonb; clean jsonb;
begin
 if not public.is_church_admin() then raise exception '관리자만 저장할 수 있습니다.' using errcode='42501'; end if;
 select * into current_row from public.church_cms_site where id='main' for update;
 if current_row.revision<>expected_revision then raise exception '다른 화면에서 수정되었습니다. 새로고침해 주세요.' using errcode='40001'; end if;
 select payload into previous from public.church_cms_edits where source_key=record_key;
 if not restore_original then
  if coalesce(new_value->>'key','')<>record_key or coalesce(new_value->>'kind','') not in ('post','page') or length(coalesce(new_value->>'title','')) not between 1 and 160 or length(coalesce(new_value->>'bodyText',''))>200000 or jsonb_typeof(new_value->'addedFiles') is distinct from 'array' then raise exception '제목·본문·첨부를 확인해 주세요.'; end if;
  if new_value->>'kind'='post' and record_key<>'post-'||(new_value->>'boardId')||'-'||(new_value->>'id') or new_value->>'kind'='page' and record_key<>'page-'||(new_value->>'id') then raise exception '글 식별자가 올바르지 않습니다.'; end if;
  if not exists(select 1 from jsonb_array_elements(current_row.payload->'menus'->'groups') g,lateral jsonb_array_elements(g->'children') i where i->>'kind'=case when new_value->>'kind'='post' then 'board' else 'page' end and i->>'id'=case when new_value->>'kind'='post' then new_value->>'boardId' else new_value->>'id' end) then raise exception '메뉴를 찾지 못했습니다.'; end if;
  for f in select jsonb_array_elements(new_value->'addedFiles') loop
   if coalesce(f->>'url','') ~ '^https://[^[:space:]]{1,2000}$' then
    if length(coalesce(f->>'name','')) not between 1 and 255 then raise exception '링크 이름을 입력해 주세요.'; end if;
    continue;
   end if;
   if coalesce(f->>'url','') not like 'storage:%' or not exists(select 1 from public.church_cms_assets where object_path=substr(f->>'url',9) and owner_key=record_key) then raise exception '이 글의 첨부파일이 아닙니다.'; end if;
  end loop;
  clean=jsonb_build_object('key',record_key,'kind',new_value->>'kind','id',new_value->>'id','boardId',new_value->'boardId','title',trim(new_value->>'title'),'bodyText',coalesce(new_value->>'bodyText',''),'date',new_value->>'date','replaceBody',coalesce((new_value->>'replaceBody')::boolean,true),'hidden',coalesce((new_value->>'hidden')::boolean,false),'addedFiles',new_value->'addedFiles','updatedAt',now());
 end if;
 insert into public.church_cms_history(entity,source_key,previous) values('content',record_key,previous);
 if restore_original then delete from public.church_cms_edits where source_key=record_key;
 else insert into public.church_cms_edits(source_key,payload) values(record_key,clean) on conflict(source_key) do update set payload=excluded.payload,updated_at=now(); end if;
 update public.church_cms_site set revision=revision+1,updated_at=now() where id='main' returning revision into expected_revision;
 return expected_revision;
end; $$;

revoke all on function public.save_church_content(text,jsonb,bigint,boolean) from public,anon;
grant execute on function public.save_church_content(text,jsonb,bigint,boolean) to authenticated;

commit;
