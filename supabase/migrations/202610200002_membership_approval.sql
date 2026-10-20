-- Apply to the intended Seoul project only. No administrator is auto-assigned.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.church_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.church_admins enable row level security;
revoke all on private.church_admins from public, anon, authenticated;

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null,
  message text not null default '' check (char_length(message) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.join_requests
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists consent_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
create unique index join_requests_user_id_unique on public.join_requests(user_id);

create function public.is_church_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.church_admins where user_id = auth.uid());
$$;
create function public.is_approved_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_church_admin() or exists (
    select 1 from public.join_requests where user_id = auth.uid() and status = 'approved'
  );
$$;
revoke all on function public.is_church_admin(), public.is_approved_member() from public;
grant execute on function public.is_church_admin(), public.is_approved_member() to authenticated;

-- Requests are created by Auth, never by a client-supplied user id or approval status.
create function private.create_membership_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and new.raw_user_meta_data->>'membership_consent' = 'true' then
    insert into public.join_requests(user_id, name, email, message, status, consent_at)
    values (new.id,
      coalesce(nullif(left(trim(new.raw_user_meta_data->>'name'), 80), ''), '새 회원'),
      lower(new.email), left(coalesce(new.raw_user_meta_data->>'message', ''), 2000), 'pending', now());
  end if;
  return new;
end;
$$;
revoke all on function private.create_membership_request() from public, anon, authenticated;
create trigger church_membership_signup after insert on auth.users
for each row execute function private.create_membership_request();

alter table public.join_requests enable row level security;
-- Replace legacy policies that may have allowed anonymous inserts or arbitrary status updates.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='join_requests'
  loop execute format('drop policy %I on public.join_requests', p.policyname); end loop;
end $$;
revoke all on public.join_requests from public, anon, authenticated;
grant select on public.join_requests to authenticated;
create policy membership_read on public.join_requests for select to authenticated
using (user_id = auth.uid() or public.is_church_admin());

-- Atomic review: verifies the caller and confirmed account, locks the row, records reviewer/time.
create function public.review_join_request(request_id text, decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.join_requests%rowtype;
begin
  if not public.is_church_admin() then
    raise exception '관리자만 처리할 수 있습니다.' using errcode = '42501';
  end if;
  if decision not in ('approved', 'rejected') or decision is null then
    raise exception '올바르지 않은 처리 상태입니다.' using errcode = '22023';
  end if;
  select * into target from public.join_requests where id::text = request_id for update;
  if not found then raise exception '가입 신청을 찾을 수 없습니다.' using errcode = 'P0002'; end if;
  if target.status <> 'pending' then
    raise exception '이미 처리된 신청입니다. 목록을 새로고침해 주세요.' using errcode = '40001';
  end if;
  if decision = 'approved' and not exists (
    select 1 from auth.users where id = target.user_id and email_confirmed_at is not null
  ) then raise exception '가입자의 이메일 인증이 완료되어야 승인할 수 있습니다.' using errcode = '22023'; end if;
  update public.join_requests set status = decision, reviewed_at = now(), reviewed_by = auth.uid()
    where id = target.id;
end;
$$;
revoke all on function public.review_join_request(text, text) from public, anon;
grant execute on function public.review_join_request(text, text) to authenticated;

-- Existing news/gallery permissive policies still apply; these additional gates require an admin for writes.
do $$ declare t text; begin
  foreach t in array array['news','gallery'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('create policy church_admin_insert on public.%I as restrictive for insert to anon, authenticated with check ((select auth.uid()) is not null and public.is_church_admin())', t);
      execute format('create policy church_admin_update on public.%I as restrictive for update to anon, authenticated using ((select auth.uid()) is not null and public.is_church_admin()) with check ((select auth.uid()) is not null and public.is_church_admin())', t);
      execute format('create policy church_admin_delete on public.%I as restrictive for delete to anon, authenticated using ((select auth.uid()) is not null and public.is_church_admin())', t);
    end if;
  end loop;
end $$;
-- Functions used by anon write gates return false when not signed in; never grant table access.
grant execute on function public.is_church_admin() to anon;
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute $policy$create policy church_admin_media_insert on storage.objects as restrictive for insert to anon, authenticated
      with check (bucket_id not in ('news-images', 'gallery-image') or public.is_church_admin())$policy$;
    execute $policy$create policy church_admin_media_update on storage.objects as restrictive for update to anon, authenticated
      using (bucket_id not in ('news-images', 'gallery-image') or public.is_church_admin())
      with check (bucket_id not in ('news-images', 'gallery-image') or public.is_church_admin())$policy$;
    execute $policy$create policy church_admin_media_delete on storage.objects as restrictive for delete to anon, authenticated
      using (bucket_id not in ('news-images', 'gallery-image') or public.is_church_admin())$policy$;
  end if;
end $$;
commit;
