// Recover stable source-post links, never reuse expired video.band.us file addresses.
import {readFile,writeFile,mkdir}from'node:fs/promises';
import {basename}from'node:path';
const details=JSON.parse(await readFile('migration/references/2026-11-11/unavailable-files-detail.json','utf8'));
const videos=details.filter(file=>file.type==='영상');
const groups=new Map();
for(const video of videos)for(const post of video.posts){let group=groups.get(post.key);if(!group){group={post,files:[]};groups.set(post.key,group);}group.files.push(video.number);}
const entries={};
for(const [key,{post,files}]of groups){
 const record=JSON.parse(await readFile('migration/onmam/records/'+key+'.json','utf8'));
 const posts=new Set();
 for(const item of record.external_links??[]){
  try{const url=new URL(item.url);if(['band.us','www.band.us'].includes(url.hostname)&&/^\/band\/\d+\/post\/\d+\/?$/.test(url.pathname))posts.add('https://band.us'+url.pathname.replace(/\/$/,''));}catch{}
 }
 const savedVideoAssets=(record.assets??[]).filter(a=>a.status==='downloaded'&&a.kind==='media'&&/\.mp4(?:[?#]|$)/i.test(a.url)&&a.local_path);
 entries[key]={title:record.title,missingVideos:files.length,bandPosts:[...posts],onmamPost:record.url,
  savedVideos:savedVideoAssets.length,savedVideoLinks:savedVideoAssets.map((asset,index)=>({url:'/onmam-assets/'+basename(asset.local_path),label:'저장된 영상'+(savedVideoAssets.length>1?' '+(index+1):'')+' 열기'}))};
}
await writeFile('src/data/video-source-links.json',JSON.stringify(entries,null,2)+'\n');
const summary={videoFiles:videos.length,affectedPosts:groups.size,postsWithBandLink:Object.values(entries).filter(e=>e.bandPosts.length).length,
 videoFilesWithBandLink:new Set([...groups].filter(([key])=>entries[key].bandPosts.length).flatMap(([,g])=>g.files)).size,
 postsWithoutBandLink:Object.entries(entries).filter(([,e])=>!e.bandPosts.length).map(([key,e])=>({key,title:e.title})),
 postsWithSavedVideo:Object.values(entries).filter(e=>e.savedVideos>0).length};
await mkdir('migration/references/2026-11-11',{recursive:true});
await writeFile('migration/references/2026-11-11/video-source-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
