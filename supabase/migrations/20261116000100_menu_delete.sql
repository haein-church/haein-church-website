-- 주 관리자는 메뉴(상위 메뉴·하위 메뉴)를 완전히 삭제할 수 있다.
-- 삭제된 메뉴의 글과 자료는 백업으로 남고, 메뉴 목록에서만 사라진다.
begin;

create or replace function public.save_church_site(section text,new_value jsonb,expected_revision bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare current_row public.church_cms_site%rowtype; g jsonb; item jsonb; ids text[]='{}'; slugs text[]='{}';
begin
 if not public.is_church_master() then raise exception '주 관리자만 메뉴와 대표 슬라이더를 저장할 수 있습니다.' using errcode='42501'; end if;
 select * into current_row from public.church_cms_site where id='main' for update;
 if current_row.revision<>expected_revision then raise exception '다른 화면에서 수정되었습니다. 새로고침해 주세요.' using errcode='40001'; end if;
 if section='menus' then
  if jsonb_typeof(new_value->'groups') is distinct from 'array' or jsonb_array_length(new_value->'groups') not between 0 and 16 then raise exception '메뉴 구성이 올바르지 않습니다.'; end if;
  for g in select jsonb_array_elements(new_value->'groups') loop
   if coalesce(g->>'slug','') !~ '^[a-z][a-z0-9-]{0,39}$' or g->>'slug'=any(slugs) or length(coalesce(g->>'name','')) not between 1 and 40 or jsonb_typeof(g->'children') is distinct from 'array' then raise exception '상위 메뉴를 확인해 주세요.'; end if;
   slugs=array_append(slugs,g->>'slug');
   for item in select jsonb_array_elements(g->'children') loop
    if coalesce(item->>'kind','') not in ('board','page') or coalesce(item->>'id','') !~ '^(\d+|local-[a-z0-9-]+)$' or length(coalesce(item->>'name','')) not between 1 and 60 or (item->>'kind')||':'||(item->>'id')=any(ids) then raise exception '하위 메뉴를 확인해 주세요.'; end if;
    ids=array_append(ids,(item->>'kind')||':'||(item->>'id'));
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

revoke all on function public.save_church_site(text,jsonb,bigint) from public, anon;
grant execute on function public.save_church_site(text,jsonb,bigint) to authenticated;

commit;
