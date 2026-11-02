import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyContentEdits } from '../src/lib/content-edits.ts';
const original={key:'post-51-1',kind:'post',id:'1',boardId:'51',title:'원본',group:'교회소식',boardName:'주보',author:'운영자',date:'2026-11-01',sourceUrl:'https://haein-church.onmam.com/bbs/bbsView/51/1',html:'<table><tr><td>원본</td></tr></table><img src="/onmam-assets/photo.jpg"/><audio controls><source src="/onmam-assets/audio.mp3"/></audio>',images:['/onmam-assets/photo.jpg'],files:[{name:'원본.pdf',url:'/onmam-assets/original.pdf'}],embeds:['https://www.youtube.com/embed/test'],unavailableFiles:0};
test('title edits preserve original formatting; body edits escape code and preserve media',()=>{
 const edit={...original,bodyText:'<script>alert(1)</script>',replaceBody:false,hidden:false,addedFiles:[]};
 const titleOnly=applyContentEdits([original],{[original.key]:{...edit,title:'새 제목'}})[0];
 assert.equal(titleOnly.html,original.html);assert.equal(titleOnly.title,'새 제목');
 const changed=applyContentEdits([original],{[original.key]:{...edit,replaceBody:true}})[0];
 assert.ok(changed.html.includes('&lt;script&gt;'));assert.ok(!changed.html.includes('<script>'));
 assert.ok(changed.html.includes('/onmam-assets/photo.jpg'));assert.ok(changed.html.includes('/onmam-assets/audio.mp3'));assert.deepEqual(changed.files,original.files);assert.deepEqual(changed.embeds,original.embeds);
 assert.equal(applyContentEdits([original],{[original.key]:{...edit,hidden:true}}).length,0);
 assert.deepEqual(applyContentEdits([original],{}),[original]);
});
