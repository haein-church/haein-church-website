-- Apply after membership_approval, only to ambojhrewxsxdavlmkpt (Seoul).
begin;
create table public.church_cms_site (
 id text primary key check(id='main'),
 payload jsonb not null default '{"menus":{"groups":[]},"slides":[]}',
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
insert into public.church_cms_site(id) values('main');
create table public.church_cms_edits (
 source_key text primary key check(source_key ~ '^(page|post)-[a-z0-9-]+$'),
 payload jsonb not null,
 updated_at timestamptz not null default now(),
 check(payload->>'key'=source_key),
 check(payload->>'kind' in ('page','post')),
 check(length(payload->>'title') between 1 and 160),
 check(length(coalesce(payload->>'bodyText',''))<=200000),
 check(jsonb_typeof(payload->'addedFiles')='array')
);
create table public.church_cms_assets (
 object_path text primary key check(object_path ~ '^[a-f0-9-]+/[a-f0-9-]+\.(jpg|jpeg|png|webp|gif|pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx|zip|mp3|mp4|m4a|wav)$'),
 owner_key text not null,
 name text not null check(length(name) between 1 and 255),
 mime text not null,
 bytes bigint not null check(bytes>0 and bytes<=52428800),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.church_cms_history (
 id bigint generated always as identity primary key,
 entity text not null,
 source_key text not null,
 previous jsonb,
 changed_by uuid not null default auth.uid(),
 changed_at timestamptz not null default now()
);
alter table public.church_cms_site enable row level security;
alter table public.church_cms_edits enable row level security;
alter table public.church_cms_assets enable row level security;
alter table public.church_cms_history enable row level security;
revoke all on public.church_cms_site,public.church_cms_edits,public.church_cms_assets,public.church_cms_history from public,anon,authenticated;
grant select on public.church_cms_site to anon,authenticated;
grant select,insert,update,delete on public.church_cms_edits to authenticated;
grant update on public.church_cms_site to authenticated;
grant select,insert on public.church_cms_assets,public.church_cms_history to authenticated;
grant usage on sequence public.church_cms_history_id_seq to authenticated;
create policy cms_site_read on public.church_cms_site for select to anon,authenticated using(true);
create policy cms_site_write on public.church_cms_site for update to authenticated using(public.is_church_admin()) with check(public.is_church_admin());
create policy cms_edits_admin on public.church_cms_edits for all to authenticated using(public.is_church_admin()) with check(public.is_church_admin());
create policy cms_assets_admin on public.church_cms_assets for select to authenticated using(public.is_church_admin());
create policy cms_assets_insert on public.church_cms_assets for insert to authenticated with check(public.is_church_admin() and created_by=auth.uid());
create policy cms_history_read on public.church_cms_history for select to authenticated using(public.is_church_admin());
create policy cms_history_insert on public.church_cms_history for insert to authenticated with check(public.is_church_admin() and changed_by=auth.uid());

-- Intentionally public projections. Hidden bodies and draft assets never leave these functions.
create function public.read_church_content(requested_keys text[] default null, requested_board text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(case when e.payload->>'hidden'='true'
  then jsonb_build_object('key',e.source_key,'hidden',true,'kind',e.payload->>'kind','boardId',e.payload->>'boardId')
  else e.payload - 'html' - 'sourceUrl' end),'[]'::jsonb)
 from public.church_cms_edits e
 where (requested_keys is null or e.source_key=any(requested_keys))
 and (requested_board is null or e.payload->>'boardId'=requested_board);
$$;
revoke all on function public.read_church_content(text[],text) from public;
grant execute on function public.read_church_content(text[],text) to anon,authenticated;

create function public.church_asset_is_public(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.church_cms_assets a where a.object_path=path and (
  exists(select 1 from public.church_cms_edits e,
   lateral jsonb_array_elements(coalesce(e.payload->'addedFiles','[]')) f
   where e.source_key=a.owner_key and coalesce(e.payload->>'hidden','false')<>'true' and f->>'url'='storage:'||a.object_path)
  or exists(select 1 from public.church_cms_site s,
   lateral jsonb_array_elements(coalesce(s.payload->'slides','[]')) slide
   where a.owner_key='slides' and slide->>'active'='true' and slide->>'url'='storage:'||a.object_path)
 ));
$$;
revoke all on function public.church_asset_is_public(text) from public;
grant execute on function public.church_asset_is_public(text) to anon,authenticated;
grant select on public.church_cms_assets to anon;
create policy cms_assets_published on public.church_cms_assets for select to anon,authenticated using(public.church_asset_is_public(object_path));

create function public.save_church_site(section text,new_value jsonb,expected_revision bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare current_row public.church_cms_site%rowtype; g jsonb; item jsonb; old_group jsonb; old_item jsonb; ids text[]='{}'; slugs text[]='{}';
begin
 if not public.is_church_admin() then raise exception '관리자만 저장할 수 있습니다.' using errcode='42501'; end if;
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
revoke all on function public.save_church_site(text,jsonb,bigint) from public,anon;
grant execute on function public.save_church_site(text,jsonb,bigint) to authenticated;

create function public.save_church_content(record_key text,new_value jsonb,expected_revision bigint,restore_original boolean default false)
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

insert into storage.buckets(id,name,public,file_size_limit) values('church-media','church-media',false,52428800) on conflict(id) do nothing;
create policy church_media_upload on storage.objects for insert to authenticated with check(bucket_id='church-media' and public.is_church_admin() and name ~ '^[a-f0-9-]+/[a-f0-9-]+\.(jpg|jpeg|png|webp|gif|pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx|zip|mp3|mp4|m4a|wav)$');
create policy church_media_admin_read on storage.objects for select to authenticated using(bucket_id='church-media' and public.is_church_admin());
create policy church_media_published_read on storage.objects for select to anon,authenticated using(bucket_id='church-media' and public.church_asset_is_public(name));
commit;
