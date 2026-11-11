// 빌드할 때 DB에서 '숨김' 처리된 글 목록을 가져온다.
// 숨김 글은 정적 페이지로 만들지 않는다. 목록을 못 가져오면 빌드를 멈춰 숨김 글이 공개되지 않게 한다.
const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

async function loadHiddenKeys(): Promise<Set<string>> {
  if (!url || !anonKey) throw new Error('숨김 글 확인을 위한 Supabase 설정이 없어 빌드를 중단합니다.');
  const response = await fetch(`${url}/rest/v1/rpc/read_church_content`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`숨김 글 목록을 불러오지 못해 빌드를 중단합니다. (${response.status})`);
  const rows = (await response.json()) as { key: string; hidden?: boolean }[];
  return new Set(rows.filter(row => row.hidden === true).map(row => row.key));
}

export const hiddenKeys: Set<string> = await loadHiddenKeys();
