import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=process.cwd();const data=JSON.parse(await readFile(resolve(root,'src/data/onmam.json'),'utf8'));
const folder=resolve(root,'public/cms');await mkdir(resolve(folder,'records'),{recursive:true});
const summaries=[];
for(const record of data.records){
 if(!/^(page|post)-[a-z0-9-]+$/.test(record.key))throw new Error('Invalid source key');
 const {key,kind,id,boardId,title,date}=record;summaries.push({key,kind,id,boardId,title,date});
 await writeFile(resolve(folder,'records',record.key+'.json'),JSON.stringify(record));
}
await writeFile(resolve(folder,'catalog.json'),JSON.stringify({records:summaries}));
console.log(JSON.stringify({publicCmsRecords:summaries.length}));
