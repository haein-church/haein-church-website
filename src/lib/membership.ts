import type { SupabaseClient } from '@supabase/supabase-js';

export const connectionMessage = '회원가입 서비스 연결을 준비 중입니다. 연결이 완료되면 신청할 수 있습니다.';
export const membershipStatus = {
  pending: '승인 대기', approved: '승인 완료', rejected: '승인 거절',
} as const;
export type MembershipStatus = keyof typeof membershipStatus;

export async function membershipClient(): Promise<SupabaseClient | null> {
  if (!import.meta.env.PUBLIC_SUPABASE_URL || !import.meta.env.PUBLIC_SUPABASE_ANON_KEY) return null;
  return (await import('./supabase')).supabase;
}

// This check controls navigation only. Database policies and RPCs enforce authorization.
export async function isAdministrator(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc('is_church_admin');
  if (error) throw new Error('관리자 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return data === true;
}

export async function requireAdministrator(client: SupabaseClient): Promise<boolean> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) { window.location.replace('/login/'); return false; }
  if (!await isAdministrator(client)) { window.location.replace('/membership/'); return false; }
  return true;
}
