-- 마스터 관리자와 관리자 관리 기능.
-- 마스터 관리자만 관리자를 추가하거나 삭제할 수 있다. 마스터는 삭제할 수 없다.
begin;

alter table private.church_admins add column if not exists is_master boolean not null default false;
update private.church_admins set is_master = true where user_id = '14f296a4-c025-457a-a55f-d75d20874b9d';

create or replace function public.is_church_master() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.church_admins where user_id = auth.uid() and is_master);
$$;

create or replace function public.list_church_admins()
returns table(user_id uuid, email text, is_master boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_church_admin() then raise exception '관리자만 볼 수 있습니다.' using errcode='42501'; end if;
  return query select a.user_id, u.email::text, a.is_master
    from private.church_admins a join auth.users u on u.id = a.user_id
    order by a.is_master desc, u.email;
end; $$;

create or replace function public.add_church_admin(target_email text) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if not public.is_church_master() then raise exception '마스터 관리자만 추가할 수 있습니다.' using errcode='42501'; end if;
  select id into target from auth.users where lower(email) = lower(trim(target_email));
  if target is null then raise exception '해당 이메일로 가입된 계정이 없습니다. 먼저 회원가입을 해 주세요.'; end if;
  insert into private.church_admins(user_id, is_master)
  select target, false where not exists(select 1 from private.church_admins where user_id = target);
end; $$;

create or replace function public.remove_church_admin(target uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_church_master() then raise exception '마스터 관리자만 삭제할 수 있습니다.' using errcode='42501'; end if;
  if target = auth.uid() then raise exception '본인은 삭제할 수 없습니다.'; end if;
  if exists(select 1 from private.church_admins where user_id = target and is_master) then raise exception '마스터 관리자는 삭제할 수 없습니다.'; end if;
  delete from private.church_admins where user_id = target;
end; $$;

revoke all on function public.is_church_master(), public.list_church_admins(), public.add_church_admin(text), public.remove_church_admin(uuid) from public, anon;
grant execute on function public.is_church_master(), public.list_church_admins(), public.add_church_admin(text), public.remove_church_admin(uuid) to authenticated;

commit;
