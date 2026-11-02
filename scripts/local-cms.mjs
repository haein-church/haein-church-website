// Dev-server-only CMS. Never installed as a production endpoint.
import { readFile, writeFile, mkdir, link, copyFile, rename } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const allowedExtensions = new Set(['.jpg','.jpeg','.png','.webp','.gif','.pdf','.hwp','.hwpx','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.zip','.mp3','.mp4','.m4a','.wav']);
function check(condition, message) { if(!condition) throw new Error(message); }
function title(value, max=160) { check(typeof value === 'string' && value.trim().length>0 && value.length<=max, '이름 또는 제목의 길이를 확인해 주세요.'); return value.trim(); }
export function validateMenus(input, current) {
 check(input && Array.isArray(input.groups) && input.groups.length>0 && input.groups.length<=16,'상위 메뉴는 1~16개여야 합니다.');
 const ids=new Set(), slugs=new Set();
 const groups=input.groups.map(group=>{
  check(typeof group.slug==='string' && /^[a-z][a-z0-9-]{0,39}$/.test(group.slug) && !slugs.has(group.slug),'상위 메뉴 주소가 중복되거나 올바르지 않습니다.'); slugs.add(group.slug);
  check(Array.isArray(group.children) && group.children.length<=100,'하위 메뉴를 확인해 주세요.');
  const name=title(group.name,40);
  return {name,slug:group.slug,description:typeof group.description==='string'?group.description.slice(0,500):'',visible:group.visible!==false,children:group.children.map(item=>{
   check(['board','page'].includes(item.kind) && typeof item.id==='string' && /^(\d+|local-[a-z0-9-]+)$/.test(item.id),'메뉴 종류와 원본 ID를 확인해 주세요.');
   const key=item.kind+':'+item.id;check(!ids.has(key),'중복 메뉴가 있습니다.');ids.add(key);
   return {id:item.id,name:title(item.name,60),kind:item.kind,group:name,visible:item.visible!==false,url:/^\d+$/.test(item.id)?`https://haein-church.onmam.com/bbs/${item.kind==='page'?'viewPage':'bbsList'}/${item.id}`:''};
  })};
 });
 for(const group of current.groups){check(slugs.has(group.slug),'기존 상위 메뉴는 삭제 대신 숨김으로 보존해 주세요.');for(const item of group.children)check(ids.has(item.kind+':'+item.id),'기존 메뉴는 삭제 대신 숨김으로 보존해 주세요.');}
 return {groups};
}
export function validateEdit(input, records, menus, previous) {
 check(input && typeof input.key==='string'&&/^(page|post)-[a-z0-9-]+$/.test(input.key),'글 식별자가 없습니다.');
 const original=records.find(record=>record.key===input.key) ?? previous.entries[input.key];
 let identity;
 if(original){identity={key:original.key,kind:original.kind,id:original.id,boardId:original.boardId};}
 else {
  check(['post','page'].includes(input.kind) && /^local-[a-z0-9-]+$/.test(input.id),'새 글 식별자가 올바르지 않습니다.');
  check(input.key===(input.kind==='post'?`post-${input.boardId}-${input.id}`:`page-${input.id}`),'새 글 식별자가 올바르지 않습니다.');
  check(menus.groups.some(group=>group.children.some(item=>item.kind===(input.kind==='post'?'board':'page')&&item.id===(input.kind==='post'?input.boardId:input.id))),'메뉴를 찾을 수 없습니다.');
  identity={key:input.key,kind:input.kind,id:input.id,boardId:input.kind==='post'?input.boardId:null};
 }
 check(typeof input.bodyText==='string' && input.bodyText.length<=200000,'본문은 20만 자 이내로 입력해 주세요.');
 check(input.date==='' || (typeof input.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.date)&&!Number.isNaN(Date.parse(input.date))),'날짜 형식을 확인해 주세요.');
 const files=input.addedFiles ?? [];
 check(Array.isArray(files)&&files.length<=100,'첨부파일 수를 확인해 주세요.');
 for(const file of files)check(typeof file.name==='string'&&file.name.length<=255&&typeof file.url==='string'&&/^\/onmam-assets\/local-[a-f0-9-]+\.[a-z0-9]+$/.test(file.url)&&allowedExtensions.has(extname(file.url)),'첨부파일 경로가 올바르지 않습니다.');
 return {...identity,title:title(input.title),bodyText:input.bodyText,replaceBody:!records.some(record=>record.key===input.key)||input.replaceBody!==false,date:input.date,hidden:identity.kind==='post'&&input.hidden===true,addedFiles:files.map(file=>({name:file.name,url:file.url})),updatedAt:new Date().toISOString()};
}
export function localRequestAllowed(req, mutation) {
 const address=req.socket.remoteAddress;
 const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address);
 const host=req.headers.host;
 if(!local || !/^127\.0\.0\.1:\d+$/.test(host??'')) return false;
 return !mutation || req.headers.origin===`http://${host}`;
}
export function createLocalCms(root) {
 const menuPath=resolve(root,'src/data/site-menu.json'), editsPath=resolve(root,'src/data/onmam-edits.json');
 const archiveRoot=resolve(root,'migration/onmam');
 async function readJson(path,fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT'&&fallback!==undefined)return fallback;throw error;}}
 async function state(){const menus=await readJson(menuPath);const edits=await readJson(editsPath,{entries:{}});const data=await readJson(resolve(root,'src/data/onmam.json'));return {menus,edits,records:data.records,revision:hash({menus,edits})};}
 async function save(path,value){const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n','utf8');await rename(temp,path);}
 async function history(snapshot){const folder=resolve(archiveRoot,'local-history');await mkdir(folder,{recursive:true});await save(resolve(folder,`${Date.now()}-${randomUUID()}.json`),{menus:snapshot.menus,edits:snapshot.edits,revision:snapshot.revision});}
 let queue=Promise.resolve();
 return async function middleware(req,res,next){
  const url=new URL(req.url??'/',`http://${req.headers.host}`);
  if(!url.pathname.startsWith('/__church-cms/'))return next();
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  function respond(status,value){res.statusCode=status;res.end(JSON.stringify(value));}
  if(!localRequestAllowed(req,req.method!=='GET'))return respond(403,{error:'이 컴퓨터의 127.0.0.1 로컬 관리 화면에서만 사용할 수 있습니다.'});
  const handle=async()=>{
   try{
    const snapshot=await state();
    if(req.method==='GET'&&url.pathname==='/__church-cms/state'){
     const records=[...snapshot.records,...Object.values(snapshot.edits.entries).filter(edit=>!snapshot.records.some(record=>record.key===edit.key))].map(record=>({...record,...snapshot.edits.entries[record.key]}));
     return respond(200,{menus:snapshot.menus,revision:snapshot.revision,records:records.map(({key,kind,id,boardId,title,date,hidden})=>({key,kind,id,boardId,title,date,hidden}))});
    }
    if(req.method==='GET'&&url.pathname==='/__church-cms/record'){
     const key=url.searchParams.get('key');const original=snapshot.records.find(record=>record.key===key);const edit=snapshot.edits.entries[key];
     return original||edit?respond(200,{record:{...original,...edit},revision:snapshot.revision}):respond(404,{error:'글을 찾지 못했습니다.'});
    }
    if(req.method!=='POST')return respond(405,{error:'지원하지 않는 요청입니다.'});
    const chunks=[];let size=0;const limit=url.pathname==='/__church-cms/upload'?70*1024*1024:3*1024*1024;
    for await(const chunk of req){size+=chunk.length;if(size>limit)return respond(413,{error:'파일은 50MB, 본문은 20만 자 이내로 나누어 올려 주세요.'});chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(input.revision!==snapshot.revision)return respond(409,{error:'다른 화면에서 자료가 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.'});
    if(url.pathname==='/__church-cms/menus'){
     const menus=validateMenus(input.menus,snapshot.menus);await history(snapshot);await save(menuPath,menus);return respond(200,{revision:hash({menus,edits:snapshot.edits})});
    }
    if(url.pathname==='/__church-cms/record'){
     const edit=validateEdit(input.record,snapshot.records,snapshot.menus,snapshot.edits);await history(snapshot);
     const edits={entries:{...snapshot.edits.entries,[edit.key]:edit}};await save(editsPath,edits);return respond(200,{revision:hash({menus:snapshot.menus,edits})});
    }
    if(url.pathname==='/__church-cms/restore'){
     check(typeof input.key==='string'&&snapshot.edits.entries[input.key],'저장된 수정본이 없습니다.');await history(snapshot);
     const edits=structuredClone(snapshot.edits);delete edits.entries[input.key];await save(editsPath,edits);return respond(200,{revision:hash({menus:snapshot.menus,edits})});
    }
    if(url.pathname==='/__church-cms/upload'){
     const extension=extname(input.name??'').toLowerCase();check(allowedExtensions.has(extension),'사진·문서·압축파일·음성·영상 파일을 선택해 주세요.');
     check(typeof input.base64==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64),'파일 데이터가 올바르지 않습니다.');
     const bytes=Buffer.from(input.base64,'base64');check(bytes.length>0&&bytes.length<=50*1024*1024,'파일은 50MB 이내로 선택해 주세요.');
     const name=`local-${randomUUID()}${extension}`;const folder=resolve(archiveRoot,'local-uploads');await mkdir(folder,{recursive:true});const path=resolve(folder,name);await writeFile(path,bytes,{flag:'wx'});
     const publicFolder=resolve(root,'public/onmam-assets');await mkdir(publicFolder,{recursive:true});try{await link(path,resolve(publicFolder,name));}catch{await copyFile(path,resolve(publicFolder,name));}
     return respond(200,{file:{name:title(input.name,255),url:`/onmam-assets/${name}`}});
    }
    return respond(404,{error:'관리 기능을 찾지 못했습니다.'});
   }catch(error){respond(400,{error:error.message??'저장하지 못했습니다.'});}
  };
  // A single queue covers read, revision check, history and save to prevent lost updates.
  queue=queue.then(handle,handle);await queue;
 };
}
export default function localCmsPlugin(root){return {name:'haein-local-cms',configureServer(server){server.middlewares.use(createLocalCms(root));}};}
