import type { ArchiveRecord } from './onmam';
export interface ContentEdit {
 key:string;kind:'page'|'post';id:string;boardId:string|null;title:string;bodyText:string;date:string|null;hidden:boolean;
 addedFiles:{name:string;url:string}[];
 replaceBody?:boolean;
}
export function applyContentEdits(original:ArchiveRecord[],entries:Record<string,ContentEdit>):ArchiveRecord[]{
 const merged=new Map(original.map(record=>[record.key,record]));
 for(const edit of Object.values(entries)){
  if(edit.hidden&&edit.kind==='post'){merged.delete(edit.key);continue;}
  const record=merged.get(edit.key);
  const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const images=edit.addedFiles.filter(file=>/\.(jpe?g|png|webp|gif)$/i.test(file.url));
  const videos=edit.addedFiles.filter(file=>/\.mp4$/i.test(file.url)).map(file=>`<video controls preload="metadata" playsinline src="${escape(file.url)}" style="max-width:100%"></video>`).join('');
  const preserve=edit.replaceBody===false&&record;
  const body=preserve?record.html:edit.bodyText.split('\n').map(line=>`<p>${escape(line)||'&nbsp;'}</p>`).join('')+(record?.images??[]).map(url=>`<img src="${escape(url)}" alt="${escape(edit.title)}" loading="lazy"/>`).join('')+(record?.html.match(/<(video|audio)\b[^>]*>[\s\S]*?<\/\1>/gi)??[]).join('');
  merged.set(edit.key,{key:edit.key,kind:edit.kind,id:edit.id,boardId:edit.boardId,boardName:record?.boardName??null,group:record?.group??'',author:record?.author??'운영자',sourceUrl:record?.sourceUrl??'',embeds:record?.embeds??[],unavailableFiles:record?.unavailableFiles??0,
   title:edit.title,date:edit.date,html:body+images.map(file=>`<img src="${escape(file.url)}" alt="${escape(file.name)}" loading="lazy"/>`).join('')+videos,
   images:[...(record?.images??[]),...images.map(file=>file.url)],files:[...(record?.files??[]),...edit.addedFiles]});
 }
 return [...merged.values()];
}
