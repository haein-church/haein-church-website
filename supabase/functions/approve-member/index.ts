import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Compatibility endpoint: acts as the verified caller, never as service_role.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: {
    ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  } });
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'POST 요청만 허용됩니다.' });
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: '로그인이 필요합니다.' });
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user) return json(401, { error: '로그인이 필요합니다.' });
    const { data: admin, error: roleError } = await client.rpc('is_church_admin');
    if (roleError || admin !== true) return json(403, { error: '관리자만 처리할 수 있습니다.' });
    let body;
    try { body = await req.json(); } catch { return json(400, { error: '잘못된 요청입니다.' }); }
    if (!body || !['string','number'].includes(typeof body.id)) return json(400, { error: '가입 신청 ID가 필요합니다.' });
    const { error } = await client.rpc('review_join_request', { request_id: String(body.id), decision: 'approved' });
    if (error) return json(error.code === '42501' ? 403 : 409, { error: '승인하지 못했습니다. 인증 및 신청 상태를 확인해 주세요.' });
    return json(200, { success: true });
  } catch {
    return json(500, { error: '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});
