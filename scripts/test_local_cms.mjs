import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { createLocalCms, validateMenus, localRequestAllowed } from './local-cms.mjs';

test('local CMS rejects remote/cross-origin writes and preserves source identities',()=>{
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:4321',origin:'http://127.0.0.1:4321'}};
 assert.equal(localRequestAllowed(req,true),true);
 assert.equal(localRequestAllowed({...req,headers:{...req.headers,origin:'https://example.invalid'}},true),false);
 assert.equal(localRequestAllowed({...req,socket:{remoteAddress:'192.168.1.3'}},false),false);
 assert.equal(localRequestAllowed({...req,headers:{host:'example.invalid:4321'}},false),false);
 const current={groups:[{name:'교회',slug:'church',children:[{name:'안내',id:'2',kind:'page'}]}]};
 assert.throws(()=>validateMenus({groups:[{name:'교회',slug:'church',children:[]}]},current));
 assert.throws(()=>validateMenus({groups:[{name:'교회',slug:'../x',children:[]}]},current));
 const changed=validateMenus({groups:[{name:'교회소개',slug:'church',children:[{name:'소개',id:'2',kind:'page',url:'javascript:alert(1)'}]}]},current);
 assert.equal(changed.groups[0].children[0].url,'https://haein-church.onmam.com/bbs/viewPage/2');
});

test('local CMS saves, restores, detects conflicts, and snapshots previous state',async()=>{
 const base=resolve('.migration-tools');await mkdir(base,{recursive:true});const root=await mkdtemp(resolve(base,'cms-test-'));
 await mkdir(resolve(root,'src/data'),{recursive:true});
 const menus={groups:[{name:'교회소식',slug:'news',description:'',children:[{id:'51',name:'주보',kind:'board',group:'교회소식'}]}]};
 const record={key:'post-51-100',kind:'post',id:'100',boardId:'51',title:'원본',html:'<p>원본 본문</p>',date:'2026-11-01'};
 await writeFile(resolve(root,'src/data/site-menu.json'),JSON.stringify(menus));
 await writeFile(resolve(root,'src/data/onmam.json'),JSON.stringify({records:[record]}));
 const middleware=createLocalCms(root);const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`;
 const get=async path=>(await fetch(origin+'/__church-cms/'+path)).json();
 const post=(path,data,sendOrigin=true)=>fetch(origin+'/__church-cms/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(sendOrigin?{Origin:origin}:{})},body:JSON.stringify(data)});
 try{
  const initial=await get('state');assert.equal(initial.records.length,1);
  assert.equal((await post('record',{},false)).status,403);
  const edit={...record,title:'수정',bodyText:'<script>alert(1)</script>',addedFiles:[],hidden:false};
  const saved=await post('record',{revision:initial.revision,record:edit});assert.equal(saved.status,200);const savedData=await saved.json();
  assert.equal((await post('record',{revision:initial.revision,record:edit})).status,409);
  assert.deepEqual(JSON.parse(await readFile(resolve(root,'src/data/onmam.json'),'utf8')).records,[record]);
  assert.equal((await get('record?key=post-51-100')).record.title,'수정');
  const restore=await post('restore',{revision:savedData.revision,key:record.key});assert.equal(restore.status,200);
  assert.equal((await get('record?key=post-51-100')).record.title,'원본');
  const state=await get('state');const changed=structuredClone(menus);changed.groups[0].children[0].name='주간 주보';
  assert.equal((await post('menus',{revision:state.revision,menus:changed})).status,200);
  assert.equal((await get('state')).menus.groups[0].children[0].name,'주간 주보');
  assert.equal((await readdir(resolve(root,'migration/onmam/local-history'))).length,3);
  const fresh=await get('state');assert.equal((await post('upload',{revision:fresh.revision,name:'attack.html',base64:'eA=='})).status,400);
  assert.equal((await post('record',{revision:fresh.revision,record:{...edit,key:'post-51-local-test',id:'local-test',title:'새 글'}})).status,200);
  assert.equal((await get('state')).records.length,2);
 }finally{await new Promise(done=>server.close(done));}
});
