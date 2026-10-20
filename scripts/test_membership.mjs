import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('membership approval and privacy policies run in PostgreSQL', async () => {
  const db = new PGlite();
  const admin = '00000000-0000-4000-8000-000000000001';
  const alice = '00000000-0000-4000-8000-000000000002';
  const bob = '00000000-0000-4000-8000-000000000003';
  let checks = 0;
  async function actor(role, id = '') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec(`set role ${role}`);
  }
  async function denied(sql, args = []) {
    await assert.rejects(db.query(sql, args)); checks++;
  }
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema public, auth, storage to anon, authenticated;
      create table public.news (id int primary key, title text);
      create table public.gallery (id int primary key, title text);
      create table storage.objects (id int primary key, bucket_id text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on public.news, public.gallery, storage.objects to anon, authenticated;
      create policy legacy_news on public.news for all to anon, authenticated using (true) with check (true);
      create policy legacy_gallery on public.gallery for all to anon, authenticated using (true) with check (true);
      create policy legacy_storage on storage.objects for all to anon, authenticated using (true) with check (true);
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202610200002_membership_approval.sql', import.meta.url), 'utf8'));
    for (const [id, email, confirmed] of [[admin,'admin@example.invalid',true],[alice,'alice@example.invalid',true],[bob,'bob@example.invalid',false]]) {
      await db.query('insert into auth.users values ($1,$2,$3,$4)', [id,email,confirmed ? new Date() : null, JSON.stringify({name:'<img src=x onerror=alert(1)>',message:'Test only',membership_consent:true,role:'admin',status:'approved'})]);
    }
    await db.query('insert into private.church_admins(user_id) values ($1)', [admin]);
    const initial = await db.query('select id,user_id,status,consent_at from public.join_requests');
    assert.equal(initial.rows.length,3);
    assert.ok(initial.rows.every(r => r.status === 'pending' && r.consent_at)); checks++;
    const aliceRequest = initial.rows.find(r => r.user_id === alice).id;
    const bobRequest = initial.rows.find(r => r.user_id === bob).id;
    await actor('anon');
    await denied('select * from public.join_requests');
    await denied("insert into public.join_requests(name,email,status) values ('X','x@example.invalid','approved')");
    await denied('select public.review_join_request($1,$2)',[aliceRequest,'approved']);
    await actor('authenticated', alice);
    const own = await db.query('select * from public.join_requests');
    assert.equal(own.rows.length,1); assert.equal(own.rows[0].user_id,alice); checks++;
    assert.equal((await db.query('select public.is_church_admin() as admin')).rows[0].admin,false); checks++;
    assert.equal((await db.query('select public.is_approved_member() as member')).rows[0].member,false); checks++;
    await denied('select * from private.church_admins');
    await denied("update public.join_requests set status='approved' where user_id=$1",[alice]);
    await denied('select public.review_join_request($1,$2)',[aliceRequest,'approved']);
    await denied("insert into public.news values (1,'unauthorized')");
    await denied("insert into storage.objects values (1,'news-images')");
    await actor('authenticated',admin);
    assert.equal((await db.query('select * from public.join_requests')).rows.length,3); checks++;
    await denied('select public.review_join_request($1,$2)',[bobRequest,'approved']);
    await denied('select public.review_join_request($1,$2)',[aliceRequest,'admin']);
    await db.query('select public.review_join_request($1,$2)',[aliceRequest,'approved']);
    await denied('select public.review_join_request($1,$2)',[aliceRequest,'rejected']);
    await db.query('select public.review_join_request($1,$2)',[bobRequest,'rejected']);
    await db.query("insert into public.news values (1,'approved admin write')"); checks++;
    await db.query("insert into storage.objects values (1,'news-images')"); checks++;
    const review = (await db.query('select reviewed_by,reviewed_at,status from public.join_requests where id=$1',[aliceRequest])).rows[0];
    assert.equal(review.status,'approved'); assert.equal(review.reviewed_by,admin); assert.ok(review.reviewed_at); checks++;
    await actor('authenticated',alice);
    assert.equal((await db.query('select public.is_approved_member() as member')).rows[0].member,true); checks++;
    await denied("insert into public.gallery values (1,'ordinary member is not admin')");
    assert.equal((await db.query("update public.news set title='tamper' returning *")).rows.length,0); checks++;
    assert.equal((await db.query('delete from storage.objects returning *')).rows.length,0); checks++;
    await actor('authenticated',bob);
    assert.equal((await db.query('select public.is_approved_member() as member')).rows[0].member,false); checks++;
    assert.equal((await db.query('select status from public.join_requests')).rows[0].status,'rejected'); checks++;
    console.log(`${checks} privacy/approval assertions passed; synthetic users only, no remote connection.`);
  } finally { await db.close(); }
});
