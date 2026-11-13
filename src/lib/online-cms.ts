import {membershipClient,requireAdministrator} from './membership';
import siteMenu from '../data/site-menu.json';
import type {SupabaseClient} from '@supabase/supabase-js';
export const mediaBucket='church-media';
export type Slide={id:string;title:string;description:string;url:string;link:string;active:boolean;type:'image'|'video'};
let client:SupabaseClient|null=null;
let catalog:any[]|null=null;
const checked=(result:any)=>{if(result.error)throw new Error(result.error.code==='40001'?'다른 화면에서 수정되었습니다. 새로고침해 주세요.':result.error.code==='42501'?'관리자 권한이 필요합니다.':result.error.message??'저장하지 못했습니다.');return result.data;};
export async function onlineCmsClient(){
 client=await membershipClient();
 if(!client)return null;
 if(!await requireAdministrator(client))throw new Error('관리자 로그인이 필요합니다.');
 return client;
}
async function originals(){if(!catalog){const response=await fetch('/cms/catalog.json');if(!response.ok)throw new Error('원본 자료 목록을 준비하지 못했습니다.');catalog=(await response.json()).records;}return catalog!;}
async function editRows(){const rows:any[]=[];for(let start=0;;start+=1000){const part=checked(await client!.from('church_cms_edits').select('source_key,payload').order('source_key').range(start,start+999));rows.push(...part);if(part.length<1000)return rows;}}
async function site(){return checked(await client!.from('church_cms_site').select('payload,revision').eq('id','main').single());}
export async function onlineCmsRequest(path:string,input:any={}){
 if(!client)throw new Error('관리자 연결을 확인해 주세요.');
 if(path==='state'){
  let settings=await site();
  if(!settings.payload.menus?.groups?.length){checked(await client.rpc('save_church_site',{section:'menus',new_value:siteMenu,expected_revision:settings.revision}));settings=await site();}
  const records=new Map((await originals()).map(record=>[record.key,record]));
  for(const row of await editRows())records.set(row.source_key,{...records.get(row.source_key),...row.payload});
  return {menus:settings.payload.menus,slides:settings.payload.slides??[],revision:settings.revision,records:[...records.values()]};
 }
 if(path.startsWith('record?key=')){
  const key=decodeURIComponent(path.slice('record?key='.length));if(!/^(page|post)-[a-z0-9-]+$/.test(key))throw new Error('잘못된 자료 주소입니다.');
  const {data:{session}}=await client.auth.getSession();
  const base=await fetch('/cms/records/'+key+'.json',{headers:session?{Authorization:'Bearer '+session.access_token}:{}});const record=base.ok?await base.json():{};
  const edited=checked(await client.from('church_cms_edits').select('payload').eq('source_key',key).maybeSingle());
  return {record:{...record,...edited?.payload},revision:(await site()).revision};
 }
 if(path==='menus'||path==='slides')return {revision:checked(await client.rpc('save_church_site',{section:path,new_value:input[path],expected_revision:input.revision}))};
 if(path==='record'||path==='restore')return {revision:checked(await client.rpc('save_church_content',{record_key:input.record?.key??input.key,new_value:input.record??null,expected_revision:input.revision,restore_original:path==='restore'}))};
 if(path==='upload'){
  const extension=String(input.name).split('.').pop()?.toLowerCase();
  if(!extension||!['jpg','jpeg','png','webp','gif','pdf','hwp','hwpx','doc','docx','xls','xlsx','ppt','pptx','zip','mp3','mp4','m4a','wav'].includes(extension))throw new Error('지원하지 않는 파일 형식입니다.');
  const mime=input.mime||'application/octet-stream';if(/^(text\/html|image\/svg\+xml|application\/javascript)/.test(mime))throw new Error('지원하지 않는 파일 형식입니다.');
  const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('다시 로그인해 주세요.');
  const bytes=Uint8Array.from(atob(input.base64),character=>character.charCodeAt(0));if(!bytes.length||bytes.length>50*1024*1024)throw new Error('파일은 50MB 이내로 올려 주세요.');
  const members=input.visibility==='members'&&input.ownerKey!=='slides';
  const objectPath=(members?'members':user.id)+'/'+crypto.randomUUID()+'.'+extension;
  checked(await client.storage.from(mediaBucket).upload(objectPath,bytes,{contentType:mime,upsert:false}));
  checked(await client.from('church_cms_assets').insert({object_path:objectPath,owner_key:input.ownerKey,name:input.name,mime,bytes:bytes.length,created_by:user.id}));
  return {file:{name:input.name,url:'storage:'+objectPath,mime,bytes:bytes.length}};
 }
 throw new Error('지원하지 않는 관리 작업입니다.');
}
export async function deleteAsset(objectPath:string){
 if(!client)throw new Error('관리자 연결을 확인해 주세요.');
 checked(await client.storage.from(mediaBucket).remove([objectPath]));
 checked(await client.from('church_cms_assets').delete().eq('object_path',objectPath));
}
export async function resolveMediaUrl(value:string){
 if(value.startsWith('storage:')){const connection=await membershipClient();if(!connection)return '';const result=await connection.storage.from(mediaBucket).createSignedUrl(value.slice(8),3600);return result.data?.signedUrl??'';}
 if(value.startsWith('/')&&!value.startsWith('//'))return value;
 try{const parsed=new URL(value);return ['https:','http:'].includes(parsed.protocol)?parsed.href:'';}catch{return '';}
}
