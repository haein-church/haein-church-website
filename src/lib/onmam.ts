import sourceData from '../data/onmam.json';

export interface ArchiveRecord {
  key: string; kind: 'page' | 'post'; id: string; boardId: string | null;
  boardName: string | null; group: string; title: string; author: string | null;
  date: string | null; sourceUrl: string; html: string; images: string[];
  files: { name: string; url: string | null }[]; embeds: string[]; unavailableFiles: number;
}
export interface MenuItem { name: string; kind: 'page' | 'board'; id: string; group: string; url: string }
const data = sourceData as unknown as {
  groups: { name: string; children: MenuItem[] }[]; records: ArchiveRecord[];
};
export const groups = data.groups;
export const records = data.records;
export const boards = groups.flatMap(g => g.children).filter(i => i.kind === 'board');
export const pages = records.filter(r => r.kind === 'page');
export const posts = records.filter(r => r.kind === 'post').sort((a,b) =>
  (b.date ?? '').localeCompare(a.date ?? '') || Number(b.id) - Number(a.id));
export const postsFor = (id: string) => posts.filter(p => p.boardId === id);
export const postUrl = (p: ArchiveRecord) => `/posts/${p.boardId}/${p.id}/`;
export const menuUrl = (item: MenuItem) => item.kind === 'page' ? `/church/${item.id}/` : `/boards/${item.id}/`;
