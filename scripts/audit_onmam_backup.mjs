// Read-only verification of the existing archive; no network requests or imports.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { readFile, writeFile, stat, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const archiveRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'migration', 'onmam');
const option = process.argv.indexOf('--archive');
const root = option>=0 ? resolve(process.argv[option+1]??'') : archiveRoot;
const selected = relative(archiveRoot,root);
if(selected.startsWith('..')||isAbsolute(selected))throw new Error('Archive must stay under migration/onmam');
const readJson = async name => JSON.parse(await readFile(resolve(root, name), 'utf8'));
const inventory = await readJson('inventory.json');
const catalog = await readJson('catalog.json');
const records = [];
const lines = createInterface({input:createReadStream(resolve(root,'content.jsonl'),{encoding:'utf8'}),crlfDelay:Infinity});
for await(const line of lines) if(line.trim()) {
 const record=JSON.parse(line);
 // Keep only verification fields; original HTML and embedded data may be very large.
 records.push({key:record.key,status:record.status,assets:record.assets});
}
const expected = new Set(inventory.posts.map(post => post.key));
for (const group of catalog.groups) for (const item of group.children) if (item.kind === 'page') expected.add(`page-${item.id}`);
const saved = new Set(records.filter(record => record.status === 'saved').map(record => record.key));
const assets = new Map();
for (const record of records) for (const asset of record.assets ?? []) assets.set(asset.url, asset);
const errors = [];
const archiveReal = await realpath(root);
let verifiedFiles = 0;
let verifiedBytes = 0;
const kinds = {};
for (const asset of assets.values()) {
  if (asset.status !== 'downloaded') continue;
  try {
    const path = await realpath(resolve(root, asset.local_path));
    const rel = relative(archiveReal, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path outside archive');
    const info = await stat(path);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    if (!info.isFile() || info.size !== asset.bytes || hash.digest('hex') !== asset.sha256) throw new Error('Size or SHA-256 mismatch');
    verifiedFiles++;
    verifiedBytes += info.size;
    kinds[asset.kind] = (kinds[asset.kind] ?? 0) + 1;
  } catch (error) { errors.push({ path: asset.local_path, error: error.message }); }
}
const result = {
  checked_at: new Date().toISOString(), mode: 'local-read-only',
  scope: 'Saved public archive selected by --archive; inaccessible/deleted source material is not implied',
  records: records.length, verifiedFiles, verifiedBytes, downloadedKinds: kinds,
  missingRecords: [...expected].filter(key => !saved.has(key)),
  failedListingPages: inventory.boards.filter(board => board.failed_pages?.length),
  unavailableAssets: [...assets.values()].filter(asset => asset.status === 'failed').length,
  errors,
  boards: inventory.boards.map(({ id, name, group, post_count, pages }) => ({ id, name, group, post_count, pages })),
  liveObservedMissingBoards: [
    { id: '29', name: '사진·동영상', group: '교회소식', pages: 3, count: null },
    { id: '55', name: '교회소식', group: '교회소식', pages: 91, highestDisplayedNumber: 909 },
    { id: '13', name: '주일설교 BMP', group: '교회소식', pages: 33, highestDisplayedNumber: 322 }
  ].filter(board=>!inventory.boards.some(item=>item.id===board.id)),
  completeBackup: false
};
await writeFile(resolve(root, 'audit-2026-11-02.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ records: result.records, verifiedFiles, verifiedBytes, downloadedKinds: kinds, missingRecords: result.missingRecords.length, failedListingPages: result.failedListingPages.length, unavailableAssets: result.unavailableAssets, errors: errors.length }));
if (errors.length || result.missingRecords.length || result.failedListingPages.length) process.exitCode = 1;
