-- Private staging for the original Onmam archive. Nothing is published by import.
create table if not exists public.legacy_content (
  source_key text primary key,
  source_url text not null unique,
  kind text not null check (kind in ('page', 'post')),
  category text not null,
  board_id text,
  board_name text,
  title text not null,
  original_published_at date,
  body_text text not null default '',
  body_html text not null default '',
  payload jsonb not null,
  published boolean not null default false,
  imported_at timestamptz not null default now()
);
create index if not exists legacy_content_category_idx on public.legacy_content (category, board_id, original_published_at desc);
alter table public.legacy_content enable row level security;
revoke all on public.legacy_content from anon, authenticated;
grant all on public.legacy_content to service_role;

create table if not exists public.legacy_assets (
  source_url text primary key,
  object_path text not null,
  sha256 text not null,
  bytes bigint not null,
  content_type text,
  payload jsonb not null,
  imported_at timestamptz not null default now()
);
alter table public.legacy_assets enable row level security;
revoke all on public.legacy_assets from anon, authenticated;
grant all on public.legacy_assets to service_role;

insert into storage.buckets (id, name, public)
values ('onmam-import', 'onmam-import', false)
on conflict (id) do nothing;
-- No public Storage policy: publishing is a separate reviewable step.
