-- 권한 분리
-- 주 관리자(마스터): 메뉴, 대표 슬라이더, 대표 페이지(안내 페이지), 관리자 관리
-- 부관리자: 게시글과 자료(사진·파일·링크·동영상)의 등록·수정·삭제만 가능
begin;

-- 1) 메뉴와 대표 슬라이더 저장은 주 관리자만
create or replace function public.save_church_site(section text,new_value jsonb,expected_revision bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare current_row public.church_cms_site%rowtype; g jsonb; item jsonb; old_group jsonb; old_item jsonb; ids text[]='{}'; slugs text[]='{}';
begin
 if not public.is_church_master() then raise exception '주 관리자만 메뉴와 대표 슬라이더를 저장할 수 있습니다.' using errcode='42501'; end if;
 select * into current_row from public.church_cms_site where id='main' for update;
 if current_row.revision<>expected_revision then raise exception '다른 화면에서 수정되었습니다. 새로고침해 주세요.' using errcode='40001'; end if;
 if section='menus' then
  if jsonb_typeof(new_value->'groups') is distinct from 'array' or jsonb_array_length(new_value->'groups') not between 1 and 16 then raise exception '메뉴 구성이 올바르지 않습니다.'; end if;
  for g in select jsonb_array_elements(new_value->'groups') loop
   if coalesce(g->>'slug','') !~ '^[a-z][a-z0-9-]{0,39}$' or g->>'slug'=any(slugs) or length(coalesce(g->>'name','')) not between 1 and 40 or jsonb_typeof(g->'children') is distinct from 'array' then raise exception '상위 메뉴를 확인해 주세요.'; end if;
   slugs=array_append(slugs,g->>'slug');
   for item in select jsonb_array_elements(g->'children') loop
    if coalesce(item->>'kind','') not in ('board','page') or coalesce(item->>'id','') !~ '^(\d+|local-[a-z0-9-]+)$' or length(coalesce(item->>'name','')) not between 1 and 60 or (item->>'kind')||':'||(item->>'id')=any(ids) then raise exception '하위 메뉴를 확인해 주세요.'; end if;
    ids=array_append(ids,(item->>'kind')||':'||(item->>'id'));
   end loop;
  end loop;
  for old_group in select jsonb_array_elements(coalesce(current_row.payload->'menus'->'groups','[]')) loop
   if not (old_group->>'slug'=any(slugs)) then raise exception '기존 메뉴는 삭제 대신 숨겨 주세요.'; end if;
   for old_item in select jsonb_array_elements(old_group->'children') loop
    if not ((old_item->>'kind')||':'||(old_item->>'id')=any(ids)) then raise exception '기존 메뉴는 삭제 대신 숨겨 주세요.'; end if;
   end loop;
  end loop;
 elsif section='slides' then
  if jsonb_typeof(new_value) is distinct from 'array' or jsonb_array_length(new_value)>20 then raise exception '슬라이드는 최대 20개입니다.'; end if;
  for item in select jsonb_array_elements(new_value) loop
   if length(coalesce(item->>'title',''))>160 or coalesce(item->>'type','') not in ('image','video') or coalesce(item->>'url','') !~ '^(storage:|https://|/onmam-assets/)' or coalesce(item->>'link','') ~* '^\s*(javascript|data|file):' or coalesce(item->>'link','') like '//%' then raise exception '슬라이드 주소를 확인해 주세요.'; end if;
   if item->>'url' like 'storage:%' and not exists(select 1 from public.church_cms_assets where object_path=substr(item->>'url',9) and owner_key='slides') then raise exception '슬라이드 첨부를 찾지 못했습니다.'; end if;
  end loop;
 else raise exception '지원하지 않는 설정입니다.';
 end if;
 insert into public.church_cms_history(entity,source_key,previous) values('site','main',current_row.payload);
 update public.church_cms_site set payload=jsonb_set(payload,array[section],new_value),revision=revision+1,updated_at=now() where id='main' returning revision into expected_revision;
 return expected_revision;
end; $$;

-- 2) 대표 페이지(안내 페이지)의 저장과 복원은 주 관리자만
create or replace function public.save_church_content(record_key text,new_value jsonb,expected_revision bigint,restore_original boolean default false)
returns bigint language plpgsql security invoker set search_path='' as $$
declare current_row public.church_cms_site%rowtype; previous jsonb; f jsonb; clean jsonb;
begin
 if not public.is_church_admin() then raise exception '관리자만 저장할 수 있습니다.' using errcode='42501'; end if;
 if (restore_original or new_value->>'kind'='page' or record_key like 'page-%') and not public.is_church_master() then
   raise exception '대표 페이지는 주 관리자만 수정할 수 있습니다.' using errcode='42501';
 end if;
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

-- 3) 표에 직접 쓰는 경우에도 대표 페이지는 주 관리자만
drop policy if exists cms_edits_admin on public.church_cms_edits;
create policy cms_edits_admin on public.church_cms_edits for all to authenticated
  using (public.is_church_admin() and (payload->>'kind' = 'post' or public.is_church_master()))
  with check (public.is_church_admin() and (payload->>'kind' = 'post' or public.is_church_master()));

-- 4) 사이트 설정(메뉴·슬라이더) 표 자체도 주 관리자만
drop policy if exists cms_site_write on public.church_cms_site;
create policy cms_site_write on public.church_cms_site for update to authenticated
  using (public.is_church_master()) with check (public.is_church_master());

commit;
