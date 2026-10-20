"""Validate by default; --apply imports into private Supabase staging.

Apply supabase/migrations/202610200001_onmam_staging.sql first.
Credentials are read from process environment only, never from source files/CLI args.
"""
import argparse, hashlib, json, os, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'migration' / 'onmam'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Upload to the private onmam-import bucket and staging tables')
    parser.add_argument('--allow-unavailable-assets', action='store_true', help='Import records retaining unavailable original-file references after review')
    args = parser.parse_args()
    inventory = json.loads((ARCHIVE / 'inventory.json').read_text(encoding='utf-8'))
    expected = {p['key'] for p in inventory['posts']}
    catalog = json.loads((ARCHIVE / 'catalog.json').read_text(encoding='utf-8'))
    expected.update('page-'+p['id'] for g in catalog['groups'] for p in g['children'] if p['kind']=='page')
    # JSON permits literal U+2028/U+2029 in strings; str.splitlines() would split
    # such original article text in the middle of a JSON record.
    with (ARCHIVE / 'content.jsonl').open(encoding='utf-8') as stream:
        records = [json.loads(line) for line in stream if line.strip()]
    saved = {r['key'] for r in records if r['status']=='saved'}
    missing = sorted(expected-saved)
    if missing:
        raise ValueError(f'{len(missing)} records are missing/restricted; resolve or review before import')
    assets = {}
    for record in records:
        for a in record.get('assets', []):
            assets[a['url']] = a
    failed_assets = [a for a in assets.values() if a['status']=='failed']
    if failed_assets and args.apply and not args.allow_unavailable_assets:
        raise ValueError(f'{len(failed_assets)} assets could not be downloaded; resolve before import')
    files = []
    for a in assets.values():
        if a['status'] != 'downloaded':
            continue
        path = (ARCHIVE / a['local_path']).resolve()
        if not path.is_relative_to(ARCHIVE.resolve()) or not path.is_file():
            raise ValueError('Missing/unsafe asset path')
        with path.open('rb') as stream:
            sha = hashlib.file_digest(stream, 'sha256').hexdigest()
        if sha != a['sha256'] or path.stat().st_size != a['bytes']:
            raise ValueError('Asset checksum mismatch: '+a['local_path'])
        files.append((a,path))
    failed_pages = [(b['name'],b['failed_pages']) for b in inventory['boards'] if b['failed_pages']]
    if failed_pages:
        raise ValueError('Some listing pages are missing; rerun archive')
    print(json.dumps({'validated_records':len(records),'validated_files':len(files),
                      'unavailable_original_files':len(failed_assets),
                      'mode':'apply' if args.apply else 'dry-run'},ensure_ascii=False))
    if not args.apply:
        return
    base = os.environ.get('SUPABASE_URL','').rstrip('/')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY','')
    parsed = urllib.parse.urlparse(base)
    if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co') or parsed.path not in ('','/') or not key:
        raise ValueError('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the process environment')
    def request(path,data,content_type='application/json',prefer=None):
        headers={'Authorization':'Bearer '+key,'apikey':key,'Content-Type':content_type}
        if prefer:
            headers['Prefer']=prefer
        if path.startswith('/storage/'):
            headers['x-upsert']='true'
        req=urllib.request.Request(base+path,data=data,headers=headers,method='POST')
        with urllib.request.urlopen(req,timeout=180) as response:
            response.read()
    for n,(a,path) in enumerate(files,1):
        object_path='originals/'+path.name
        request('/storage/v1/object/onmam-import/'+urllib.parse.quote(object_path,safe='/'),path.read_bytes(),a.get('content_type') or 'application/octet-stream')
        row={'source_url':a['url'],'object_path':object_path,'sha256':a['sha256'],'bytes':a['bytes'],
             'content_type':a.get('content_type'),'payload':a}
        request('/rest/v1/legacy_assets?on_conflict=source_url',json.dumps(row).encode(),prefer='resolution=merge-duplicates')
        if n%50==0:
            print(f'Uploaded files {n}/{len(files)}',flush=True)
    rows=[]
    for r in records:
        rows.append({'source_key':r['key'],'source_url':r['url'],'kind':r['kind'],'category':r['group'],
                     'board_id':r.get('board_id'),'board_name':r.get('board_name'), 'title':r['title'],
                     'original_published_at':r.get('published_at'), 'body_text':r.get('body_text',''),
                     'body_html':r.get('body_html',''), 'payload':r,'published':False})
    for offset in range(0,len(rows),50):
        request('/rest/v1/legacy_content?on_conflict=source_key',json.dumps(rows[offset:offset+50]).encode(),prefer='resolution=merge-duplicates')
    print('Imported into private staging. No content has been published.')

if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        # Avoid printing HTTP request headers or environment secrets.
        print(f'Import stopped: {type(exc).__name__}: {exc}',file=sys.stderr)
        sys.exit(1)
