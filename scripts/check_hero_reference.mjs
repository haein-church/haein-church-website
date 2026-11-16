// The approved hero is shared by every assistant working in this checkout.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const reference=JSON.parse(await readFile(new URL('docs/hero-reference.json',root),'utf8'));
for(const item of reference.lockedFiles){
 const bytes=await readFile(new URL(item.path,root));
 const data=item.textNormalization==='LF'?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes;
 if(createHash('sha256').update(data).digest('hex')!==item.sha256)
  throw new Error(`Protected hero changed: ${item.path}. Restore the approved file. Update the baseline only for an explicit owner-authorized hero change; unrelated AI work must not change it.`);
}
const homepage=await readFile(new URL('src/pages/index.astro',root),'utf8');
if(!/import\s+HeroSlider\s+from\s+['"]\.\.\/components\/HeroSlider\.astro['"]/.test(homepage)||!/<HeroSlider\s*\/>/.test(homepage))
 throw new Error('The approved HeroSlider must remain on the homepage. Do not remove it during unrelated work.');
console.log(`Approved hero verified: ${reference.slides.length} slides, ${reference.lockedFiles.length} unchanged source/assets.`);
