// Package only the built public-facing site for a manual Pages preview.
// Archives, credentials, local editing data and local APIs are never copied.
import { readdir, stat, readFile, writeFile, mkdir, link, copyFile } from 'node:fs/promises';
import { resolve, relative, dirname, basename, extname } from 'node:path';
const root=process.cwd(), source=resolve(root,'dist');
const target=resolve(root,'.migration-tools',`share-preview-${Date.now()}`);
const snapshot=resolve(root,'migration/onmam/snapshots/2026-11-02');
const replacements=new Map();let files=0,bytes=0;
for(const entry of await readdir(resolve(source,'onmam-assets'),{withFileTypes:true})) {
 if(!entry.isFile())continue;
 const info=await stat(resolve(source,'onmam-assets',entry.name));
 if(info.size<=25*1024*1024)continue;
 const meta=JSON.parse(await readFile(resolve(snapshot,'asset-records',basename(entry.name,extname(entry.name))+'.json'),'utf8'));
 if(!/^https?:\/\//.test(meta.url))throw new Error('Oversized file has no usable original URL: '+entry.name);
 replacements.set('/onmam-assets/'+entry.name,meta.url.replaceAll('&','&amp;').replaceAll('"','&quot;'));
}
async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){
 const path=resolve(folder,entry.name), rel=relative(source,path), destination=resolve(target,rel);
 if(entry.isDirectory()){await walk(path);continue;}
 if(!entry.isFile())throw new Error('Unexpected non-file in build');
 if(replacements.has('/'+rel.replaceAll('\\','/')))continue;
 await mkdir(dirname(destination),{recursive:true});
 if(extname(path)==='.html'){
  let content=await readFile(path,'utf8');for(const [from,to]of replacements)content=content.replaceAll(from,to);
  await writeFile(destination,content);
 }else{try{await link(path,destination);}catch{await copyFile(path,destination);}}
 const info=await stat(destination);if(info.size>25*1024*1024)throw new Error('Pages file limit exceeded');files++;bytes+=info.size;
}}
await walk(source);
const manifest={directory:target,project:'haein-church',environment:'preview',production:false,files,bytes,oversizedOriginalReferences:[...replacements.keys()],created_at:new Date().toISOString()};
await writeFile(resolve(root,'migration/references/share-preview-package.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest));
