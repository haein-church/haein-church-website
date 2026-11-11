import {createReadStream}from'node:fs';
import {readFile,writeFile,mkdir}from'node:fs/promises';
import {createInterface}from'node:readline';
const report=JSON.parse(await readFile('migration/onmam/report.json','utf8'));
const files=report.failed_assets.map((a,index)=>({number:index+1,type:a.kind==='media'?'영상':'이미지',host:new URL(a.url).hostname,reason:a.reason,url:a.url,posts:[]}));
const byUrl=new Map(files.map(a=>[a.url,a]));
if(process.argv.includes('--reuse-details')){
 const previous=JSON.parse(await readFile('migration/references/2026-11-11/unavailable-files-detail.json','utf8'));
 for(const file of files)file.posts=previous.find(p=>p.url===file.url)?.posts??[];
}else for await(const line of createInterface({input:createReadStream('migration/onmam/content.jsonl',{encoding:'utf8'}),crlfDelay:Infinity})){
 if(!line.trim())continue;const r=JSON.parse(line);
 for(const url of new Set((r.assets??[]).map(a=>a.url))){const file=byUrl.get(url);if(file)file.posts.push({key:r.key,title:r.title,board:r.board_name,date:r.published_at,url:r.url});}
}
const base='migration/references/2026-11-11';await mkdir(base,{recursive:true});
const videoSources=JSON.parse(await readFile('src/data/video-source-links.json','utf8').catch(()=>'{}'));
await writeFile(base+'/unavailable-files-detail.json',JSON.stringify(files,null,2));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cell=s=>'"'+String(s??'').replaceAll('"','""')+'"';
const csv=[['번호','종류','게시판','게시글','날짜','게시글 주소','원본 파일 주소','백업 당시 결과','Band 영상 원본 게시글'],...files.flatMap(f=>f.posts.map(p=>[f.number,f.type,p.board,p.title,p.date,p.url,f.url,f.reason,(videoSources[p.key]?.bandPosts??[]).join(' ')]))].map(r=>r.map(cell).join(',')).join('\r\n');
await writeFile(base+'/unavailable-files-detail.csv','\uFEFF'+csv);
const boards={};for(const f of files)for(const p of f.posts)boards[p.board]=(boards[p.board]??0)+1;
const sourceButtons=(f,p)=>f.type==='영상'?(videoSources[p.key]?.bandPosts??[]).map((url,index)=>'<a style="display:inline-block;background:#326c47;color:white;padding:.35rem .6rem;border-radius:4px;margin:0 .3rem .5rem 0" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Band에서 영상 보기'+((videoSources[p.key]?.bandPosts.length??0)>1?' '+(index+1):'')+' ↗</a>').join(''):'';
const summary={files:files.length,videos:files.filter(f=>f.type==='영상').length,images:files.filter(f=>f.type==='이미지').length,affectedPosts:new Set(files.flatMap(f=>f.posts.map(p=>p.key))).size,boardReferences:boards};
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>온맘 원본 미확보 파일 목록</title><style>body{max-width:1250px;margin:3rem auto;padding:1rem;font:16px/1.7 system-ui;color:#243b4c}table{width:100%;border-collapse:collapse}th,td{padding:.7rem;border:1px solid #dce3e7;text-align:left;vertical-align:top}th{background:#f1f5f6}a{color:#245d89}small{color:#586c7b}</style><h1>온맘 원본 미확보 파일 94개</h1><p>영상 88개 · 이미지 6개. 아래 상태는 '+esc(report.completed_at)+' 백업 당시의 HTTP 404 응답입니다. 게시글 본문은 보존되어 있으며, 파일이 영구 삭제되었다는 뜻은 아닙니다.</p><p>영향받는 게시글: '+summary.affectedPosts+'건. 동일 파일이 여러 글에 쓰인 경우 각각 표시합니다. 영상은 Band 버튼으로 원본 게시글을 열 수 있으며, 로그인 또는 밴드 가입이 필요할 수 있습니다.</p><table><thead><tr><th>파일 번호</th><th>종류</th><th>게시판</th><th>게시글</th><th>파일·상태</th></tr></thead><tbody>'+files.flatMap(f=>f.posts.map(p=>'<tr><td>'+f.number+'</td><td>'+f.type+'</td><td>'+esc(p.board)+'</td><td><a href="'+esc(p.url)+'">'+esc(p.title)+'</a><br><small>'+esc(p.date)+'</small></td><td>'+sourceButtons(f,p)+'<a href="'+esc(f.url)+'">이전 파일 주소</a><br><small>'+esc(f.host)+'<br>'+esc(f.reason)+'</small></td></tr>')).join('')+'</tbody></table></html>';
await writeFile(base+'/unavailable-files-detail.html',html);
console.log(JSON.stringify({...summary,imagePosts:files.filter(f=>f.type==='이미지').map(f=>({number:f.number,posts:f.posts})),videoExamples:files.filter(f=>f.type==='영상').slice(0,4).map(f=>({number:f.number,posts:f.posts}))}));
