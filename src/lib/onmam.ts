import sourceData from '../data/onmam.json';
import siteMenu from '../data/site-menu.json';
import { applyContentEdits, type ContentEdit } from './content-edits';

export interface ArchiveRecord {
  key: string; kind: 'page' | 'post'; id: string; boardId: string | null;
  boardName: string | null; group: string; title: string; author: string | null;
  date: string | null; sourceUrl: string; html: string; images: string[];
  files: { name: string; url: string | null }[]; embeds: string[]; unavailableFiles: number;
}
export interface MenuItem { name: string; kind: 'page' | 'board'; id: string; group: string; url: string; visible?:boolean }
export interface MenuGroup {name:string;slug:string;description:string;visible?:boolean;children:MenuItem[]}
const data = sourceData as unknown as {
  groups: { name: string; children: MenuItem[] }[]; records: ArchiveRecord[];
};
// Navigation is versioned separately so uncollected boards remain discoverable.
export const groups = siteMenu.groups as MenuGroup[];
const archivedBoardIds = new Set(data.groups.flatMap(g => g.children).filter(i => i.kind === 'board').map(i => i.id));
export const isBoardArchived = (id: string) => archivedBoardIds.has(id);
const editModules = import.meta.glob<{default:{entries:Record<string,ContentEdit>}}>('../data/onmam-edits.json',{eager:true});
const edits = Object.values(editModules)[0]?.default.entries ?? {};
const contentRecords = applyContentEdits(data.records,edits);
for(const group of groups) for(const item of group.children) {
 if(item.kind==='page'&&!contentRecords.some(record=>record.kind==='page'&&record.id===item.id)) contentRecords.push({key:`page-${item.id}`,kind:'page',id:item.id,boardId:null,boardName:null,group:group.name,title:item.name,author:null,date:null,sourceUrl:'',html:'<p>안내 내용을 준비하고 있습니다.</p>',images:[],files:[],embeds:[],unavailableFiles:0});
}
import { hiddenKeys } from './hidden-records';
export const records = contentRecords.filter(record=>!hiddenKeys.has(record.key)).map(record=>{
 const group=groups.find(group=>group.children.some(item=>item.kind===(record.kind==='page'?'page':'board')&&item.id===(record.boardId??record.id)));
 const item=group?.children.find(item=>item.kind===(record.kind==='page'?'page':'board')&&item.id===(record.boardId??record.id));
 return {...record,group:group?.name??record.group,boardName:record.kind==='post'?(item?.name??record.boardName):record.boardName};
});
export const boards = groups.flatMap(g => g.children).filter(i => i.kind === 'board');
export const pages = records.filter(r => r.kind === 'page');
export const posts = records.filter(r => r.kind === 'post').sort((a,b) =>
  (b.date ?? '').localeCompare(a.date ?? '') || Number(b.id) - Number(a.id));
export const postsFor = (id: string) => posts.filter(p => p.boardId === id);
export const postUrl = (p: ArchiveRecord) => `/posts/${p.boardId}/${p.id}/`;
export const menuUrl = (item: MenuItem) => item.kind === 'page' ? `/church/${item.id}/` : `/boards/${item.id}/`;
