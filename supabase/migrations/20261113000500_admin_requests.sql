-- 보조 관리자 신청과 마스터 승인.
-- 신청은 로그인한 회원이 하고, 승인·거절은 마스터 관리자만 한다.
begin;

create table if not exists private.admin_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
revoke all on private.admin_requests from public, anon, authenticated;

create or replace function public.request_church_admin() returns text
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  if public.is_church_admin() then raise exception '이미 관리자입니다.'; end if;
  insert into private.admin_requests(user_id, email)
    values (auth.uid(), (select email from auth.users where id = auth.uid()))
  on conflict (user_id) do update set status = 'pending', created_at = now(), reviewed_at = null
    where private.admin_requests.status = 'rejected';
  return (select status from private.admin_requests where user_id = auth.uid());
end; $$;

create or replace function public.my_admin_request_status() returns text
language sql stable security definer set search_path='' as $$
  select status from private.admin_requests where user_id = auth.uid();
$$;

create or replace function public.list_admin_requests()
returns table(user_id uuid, email text, created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_church_master() then raise exception '마스터 관리자만 볼 수 있습니다.' using errcode='42501'; end if;
  return query select r.user_id, r.email, r.created_at from private.admin_requests r
    where r.status = 'pending' order by r.created_at;
end; $$;

create or replace function public.review_admin_request(target uuid, decision text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_church_master() then raise exception '마스터 관리자만 처리할 수 있습니다.' using errcode='42501'; end if;
  if decision not in ('approved','rejected') then raise exception '처리 방식이 올바르지 않습니다.'; end if;
  if not exists(select 1 from private.admin_requests where user_id = target and status = 'pending') then
    raise exception '대기 중인 신청을 찾지 못했습니다.';
  end if;
  if decision = 'approved' then
    insert into private.church_admins(user_id, is_master)
    select target, false where not exists(select 1 from private.church_admins where user_id = target);
  end if;
  update private.admin_requests set status = decision, reviewed_at = now() where user_id = target;
end; $$;

revoke all on function public.request_church_admin(), public.my_admin_request_status(), public.list_admin_requests(), public.review_admin_request(uuid, text) from public, anon;
grant execute on function public.request_church_admin(), public.my_admin_request_status(), public.list_admin_requests(), public.review_admin_request(uuid, text) to authenticated;

commit;
