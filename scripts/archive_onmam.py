"""Archive public Onmam church content without logging in or changing the source.

Run with the bundled Python. Beautiful Soup is installed locally in .migration-tools.
Re-running reuses successful downloads and records; interrupted downloads use .part.
"""
from __future__ import annotations
import argparse, base64, concurrent.futures as futures, csv, hashlib, html, json, mimetypes, re
import sqlite3, sys, threading, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.migration-tools'))
from bs4 import BeautifulSoup, Comment

BASE = 'https://haein-church.onmam.com'
OUT = ROOT / 'migration' / 'onmam'
LOCK = threading.Lock()
ERRORS = []
HEADERS = {'User-Agent': 'HaeinChurchArchive/1.0', 'Referer': BASE + '/'}

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)

def now():
    return datetime.now(timezone.utc).isoformat()

def absolute(url):
    return urllib.parse.urljoin(BASE + '/', html.unescape(url or '').strip())

def failure(kind, url, error):
    item = {'kind': kind, 'url': url, 'error': str(error), 'time': now()}
    with LOCK:
        ERRORS.append(item)
        with (OUT / 'errors.jsonl').open('a', encoding='utf-8') as f:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')

def fetch_page(url, path):
    if path.exists():
        return path.read_text(encoding='utf-8')
    error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=35) as response:
                if urllib.parse.urlparse(response.url).hostname != urllib.parse.urlparse(BASE).hostname:
                    raise ValueError('Unexpected redirect; owner review required')
                content = response.read().decode('utf-8', errors='replace')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
            return content
        except Exception as exc:
            error = exc
            time.sleep(0.5 * (attempt + 1))
    failure('page', url, error)
    return None

def soup_of(content):
    return BeautifulSoup(content, 'html.parser')

def txt(node):
    return node.get_text(' ', strip=True) if node else ''

def catalog():
    raw = fetch_page(BASE + '/bbs/viewPage/2', OUT / 'raw' / 'intro.html')
    if not raw:
        raise RuntimeError('Cannot read church menu')
    soup = soup_of(raw)
    groups = []
    for group in soup.select('#gnb_nav > ul > li'):
        head = group.find('a', recursive=False)
        if not head:
            continue
        name = txt(head)
        children = []
        for link in group.select('.gnbSub a'):
            url = absolute(link.get('href'))
            match = re.search(r'/bbs/(viewPage|bbsList)/(\d+)', url)
            if not match:
                continue
            # The request includes bulletins, but not the other church-news boards.
            if name == '교회소식' and match[2] != '51':
                continue
            children.append({'name': txt(link), 'kind': 'page' if match[1] == 'viewPage' else 'board',
                             'id': match[2], 'url': url, 'group': name})
        if children:
            groups.append({'name': name, 'children': children})
    if not groups:
        raise RuntimeError('No menu found; source format changed')
    dump(OUT / 'catalog.json', {'source': BASE, 'captured_at': now(), 'groups': groups})
    return [child for group in groups for child in group['children']]

def list_page(item, number):
    url = item['url'] + '?page=' + str(number)
    raw = fetch_page(url, OUT / 'raw' / 'lists' / item['id'] / f'{number}.html')
    if raw is None:
        return {'number': number, 'ok': False, 'posts': [], 'max_page': number}
    soup = soup_of(raw)
    section = soup.select_one('section.conts')
    if not section:
        failure('list', url, 'Content missing or login required')
        return {'number': number, 'ok': False, 'posts': [], 'max_page': number}
    posts = {}
    for a in section.select('a[href]'):
        match = re.search(r'/bbs/bbsView/(\d+)/(\d+)', a.get('href', ''))
        if match and match[1] == item['id']:
            canonical = BASE + f'/bbs/bbsView/{match[1]}/{match[2]}'
            posts[match[2]] = {'source_id': match[2], 'url': canonical, 'listing_title': txt(a)}
    pages = [number]
    for a in section.select('.paging a'):
        match = re.search(r'goPage\((\d+)\)', a.get('href', ''))
        if match:
            pages.append(int(match[1]))
        match = re.search(r'[?&]page=(\d+)', a.get('href', ''))
        if match:
            pages.append(int(match[1]))
    return {'number': number, 'ok': True, 'posts': list(posts.values()), 'max_page': max(pages),
            'empty_text': txt(section) if not posts else ''}

def inventory(items):
    boards = [i for i in items if i['kind'] == 'board']
    firsts = {}
    with futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(list_page, i, 1): i for i in boards}
        for job in futures.as_completed(jobs):
            i = jobs[job]
            result = job.result()
            firsts[i['id']] = result
            print(f"CATALOG {i['group']}/{i['name']}: {result['max_page']} pages", flush=True)
    dump(OUT / 'board-summary.json', [{**i, 'max_page': firsts[i['id']]['max_page'],
                                     'first_ok': firsts[i['id']]['ok']} for i in boards])
    all_posts = {}
    summaries = []
    for item in boards:
        first = firsts[item['id']]
        results = [first]
        with futures.ThreadPoolExecutor(max_workers=3) as pool:
            results += list(pool.map(lambda n: list_page(item, n), range(2, first['max_page'] + 1)))
        ids = set()
        for result in results:
            for post in result['posts']:
                key = f"post-{item['id']}-{post['source_id']}"
                all_posts[key] = {**post, 'key': key, 'board_id': item['id'], 'board_name': item['name'],
                                  'group': item['group'], 'kind': 'post'}
                ids.add(post['source_id'])
        summaries.append({**item, 'pages': first['max_page'], 'post_count': len(ids),
                          'failed_pages': [r['number'] for r in results if not r['ok']]})
        print(f"INDEXED {item['name']}: {len(ids)} posts", flush=True)
        dump(OUT / 'inventory.json', {'captured_at': now(), 'boards': summaries, 'posts': list(all_posts.values())})
    return list(all_posts.values())

def clean_html(node):
    clone = soup_of(str(node))
    for tag in clone.select('script, form, input, button, style, #hwpEditorBoardContent'):
        tag.decompose()
    for comment in clone.find_all(string=lambda s: isinstance(s, Comment)):
        comment.extract()
    for tag in clone.find_all(True):
        for attr in list(tag.attrs):
            if attr.lower().startswith('on'):
                del tag[attr]
        for attr in ('src', 'href', 'poster'):
            value = tag.get(attr)
            if not value:
                continue
            if str(value).strip().lower().startswith(('javascript:', 'data:text/html')):
                del tag[attr]
            else:
                tag[attr] = absolute(value)
    return str(clone)

def record(item):
    path = OUT / 'records' / f"{item['key']}.json"
    if path.exists():
        old = json.loads(path.read_text(encoding='utf-8'))
        if old.get('status') == 'saved':
            return old
    rawpath = OUT / 'raw' / 'content' / f"{item['key']}.html"
    raw = fetch_page(item['url'], rawpath)
    if not raw:
        return {**item, 'status': 'failed'}
    soup = soup_of(raw)
    section = soup.select_one('section.conts')
    content = soup.select_one('.pageArticle') if item['kind'] == 'page' else soup.select_one('article.bbs_view')
    if not content:
        error = 'Missing article; restricted/deleted or unsupported page; original HTML retained'
        failure('content', item['url'], error)
        result = {**item, 'status': 'needs_review', 'reason': error, 'raw_path': str(rawpath.relative_to(OUT))}
        dump(path, result)
        return result
    title = txt(soup.select_one('.bbs_tit')) if item['kind'] == 'post' else txt(soup.select_one('.titWrap h1'))
    metadata = [txt(s) for s in soup.select('.etcInfo > div:first-child > span')]
    body = soup.select_one('.bbs_cont') if item['kind'] == 'post' else content
    body_text = txt(body)
    media = []
    for node in content.select('img[src], video[src], audio[src], source[src], video[poster]'):
        attr = 'poster' if node.name == 'video' and node.get('poster') else 'src'
        media.append({'url': absolute(node[attr]), 'kind': 'image' if node.name == 'img' or attr == 'poster' else 'media',
                      'name': node.get('alt') or node.get('title') or ''})
    attachments = []
    for a in content.select('.fileDiv a[href]'):
        url = absolute(a['href'])
        attachments.append({'url': url, 'kind': 'attachment', 'name': txt(a)})
    # Also capture direct file links embedded in the body.
    if body:
        for a in body.select('a[href]'):
            url = absolute(a['href'])
            if re.search(r'\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?|zip|jpg|png|jpeg|mp3|mp4)(?:[?#]|$)', url, re.I):
                attachments.append({'url': url, 'kind': 'attachment', 'name': txt(a)})
    embeds = [{'url': absolute(n.get('src') or n.get('data')), 'tag': n.name}
              for n in content.select('iframe[src], embed[src], object[data]')]
    external_links = [{'url': absolute(a['href']), 'name': txt(a)} for a in (body.select('a[href]') if body else [])
                      if a['href'].startswith(('http:', 'https:'))]
    comments = soup.select_one('.bbs_comment .comment_list')
    result = {**item, 'title': title or item.get('name') or item.get('listing_title', ''), 'metadata': metadata,
              'author': metadata[0] if metadata else None,
              'published_at': next((x for x in metadata if re.match(r'\d{4}-\d{2}-\d{2}', x)), None),
              'body_text': body_text, 'body_html': clean_html(body) if body else '',
              'article_html': clean_html(content), 'comments_html': clean_html(comments) if comments else '',
              'assets': list({m['url']: m for m in media + attachments}.values()),
              'embeds': embeds, 'external_links': external_links,
              'raw_path': str(rawpath.relative_to(OUT)), 'captured_at': now(), 'status': 'saved'}
    dump(path, result)
    return result

def asset(spec):
    url = spec['url']
    parsed = urllib.parse.urlparse(url)
    # Only direct asset URLs present in the source content are downloaded.
    # Embedded YouTube players remain references in the separate embeds list.
    if parsed.scheme == 'data' and url.startswith('data:image/'):
        uid = hashlib.sha256(url.encode()).hexdigest()[:24]
        header, data = url.split(',', 1)
        ctype = header[5:].split(';')[0]
        suffix = mimetypes.guess_extension(ctype) or '.bin'
        content = base64.b64decode(data) if ';base64' in header else urllib.parse.unquote_to_bytes(data)
        path = OUT / 'assets' / (uid + suffix)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        result = {**spec, 'status': 'downloaded', 'local_path': path.relative_to(OUT).as_posix(),
                  'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content), 'content_type': ctype}
        dump(OUT / 'asset-records' / f'{uid}.json', result)
        return result
    if parsed.scheme not in ('https', 'http'):
        return {**spec, 'status': 'external_reference'}
    uid = hashlib.sha256(url.encode()).hexdigest()[:24]
    meta_path = OUT / 'asset-records' / f'{uid}.json'
    if meta_path.exists():
        old = json.loads(meta_path.read_text(encoding='utf-8'))
        if old.get('status') == 'downloaded' and (OUT / old['local_path']).exists():
            return old
    suffix = Path(urllib.parse.unquote(parsed.path)).suffix.lower()
    if not re.fullmatch(r'\.[a-z0-9]{1,7}', suffix):
        suffix = Path(spec.get('name', '')).suffix.lower()
        if not re.fullmatch(r'\.[a-z0-9]{1,7}', suffix):
            suffix = '.bin'
    path = OUT / 'assets' / f'{uid}{suffix}'
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + '.part')
    error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=45) as response:
                ctype = response.headers.get('Content-Type', '')
                if 'text/html' in ctype:
                    raise ValueError('HTML returned for file; login/error page retained as failure')
                sha = hashlib.sha256()
                size = 0
                with partial.open('wb') as f:
                    while True:
                        chunk = response.read(256 * 1024)
                        if not chunk:
                            break
                        f.write(chunk)
                        sha.update(chunk)
                        size += len(chunk)
                disposition = response.headers.get('Content-Disposition', '')
            if suffix == '.bin':
                guessed = mimetypes.guess_extension(ctype.split(';')[0].strip())
                if guessed:
                    path = path.with_suffix(guessed)
            partial.replace(path)
            result = {**spec, 'status': 'downloaded', 'local_path': path.relative_to(OUT).as_posix(),
                      'sha256': sha.hexdigest(), 'bytes': size, 'content_type': ctype,
                      'content_disposition': disposition, 'downloaded_at': now()}
            dump(meta_path, result)
            return result
        except Exception as exc:
            error = exc
            time.sleep(0.5 * (attempt + 1))
    failure('asset', url, error)
    result = {**spec, 'status': 'failed', 'reason': str(error)}
    dump(meta_path, result)
    return result

def finalize(items, records, assets):
    # Earlier attachment URLs may have no filename extension; restore it from
    # the original attachment label, retaining its byte-for-byte content.
    for a in assets:
        if a.get('status') == 'downloaded' and a.get('local_path', '').endswith('.bin'):
            suffix = Path(a.get('name', '')).suffix.lower()
            if re.fullmatch(r'\.[a-z0-9]{1,7}', suffix or ''):
                old = OUT / a['local_path']
                new = old.with_suffix(suffix)
                if old.exists():
                    old.replace(new)
                    a['local_path'] = new.relative_to(OUT).as_posix()
                    uid = hashlib.sha256(a['url'].encode()).hexdigest()[:24]
                    dump(OUT / 'asset-records' / f'{uid}.json', a)
    asset_map = {a['url']: a for a in assets}
    conn = sqlite3.connect(OUT / 'archive.sqlite')
    conn.execute('CREATE TABLE IF NOT EXISTS content (source_key TEXT PRIMARY KEY, kind TEXT, category TEXT, board TEXT, title TEXT, published_at TEXT, source_url TEXT, body_text TEXT, record_json TEXT)')
    with (OUT / 'content.jsonl').open('w', encoding='utf-8') as f:
        for r in records:
            r['assets'] = [asset_map.get(a['url'], a) for a in r.get('assets', [])]
            local_html = r.get('article_html', '')
            for a in r['assets']:
                if a.get('local_path'):
                    local_html = local_html.replace(html.escape(a['url'], quote=True), '../' + a['local_path'])
                    local_html = local_html.replace(a['url'], '../' + a['local_path'])
            if r.get('status') == 'saved':
                page = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' + html.escape(r['title']) + '</title><style>body{max-width:1000px;margin:32px auto;padding:20px;font:16px/1.7 sans-serif}img,video,iframe{max-width:100%;height:auto}iframe{min-height:320px}a{overflow-wrap:anywhere}</style><a href="../index.html">자료 목록</a><p>원문: <a href="' + html.escape(r['url'], quote=True) + '">' + html.escape(r['url']) + '</a></p>' + local_html
                folder = OUT / 'preview'
                folder.mkdir(exist_ok=True)
                (folder / f"{r['key']}.html").write_text(page, encoding='utf-8')
            dump(OUT / 'records' / f"{r['key']}.json", r)
            serialized = json.dumps(r, ensure_ascii=False)
            f.write(serialized + '\n')
            conn.execute('INSERT OR REPLACE INTO content VALUES (?,?,?,?,?,?,?,?,?)',
                         (r['key'], r['kind'], r['group'], r.get('board_name'), r.get('title'), r.get('published_at'), r['url'], r.get('body_text'), serialized))
    conn.commit()
    conn.close()
    with (OUT / 'content-index.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['source_key','category','board','title','published_at','source_url','status','assets','embeds'])
        for r in records:
            writer.writerow([r['key'],r['group'],r.get('board_name',''),r.get('title',''),r.get('published_at',''),r['url'],r['status'],len(r.get('assets',[])),len(r.get('embeds',[]))])
    report = {'source': BASE, 'completed_at': now(), 'menu_items': len(items), 'records': len(records),
              'saved_pages': sum(r['kind']=='page' and r['status']=='saved' for r in records),
              'saved_posts': sum(r['kind']=='post' and r['status']=='saved' for r in records),
              'records_needing_review': [r['key'] for r in records if r['status']!='saved'],
              'assets':len(assets), 'downloaded_assets':sum(a['status']=='downloaded' for a in assets),
              'downloaded_bytes':sum(a.get('bytes',0) for a in assets),
              'failed_assets':[a for a in assets if a['status']=='failed'],
              'external_assets':[a for a in assets if a['status']=='external_reference'],
              'video_embeds':sum(len(r.get('embeds',[])) for r in records),
              'current_run_errors': len(ERRORS), 'publication':'local staging only; not deployed or uploaded to Supabase'}
    dump(OUT / 'report.json', report)
    asset_owners = {}
    for r in records:
        for a in r.get('assets', []):
            asset_owners.setdefault(a['url'], []).append({'source_key':r['key'],'title':r.get('title'), 'source_url':r['url']})
    with (OUT / 'unavailable-files.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer=csv.writer(f)
        writer.writerow(['source_key','title','source_url','asset_url','reason'])
        for a in report['failed_assets']:
            for owner in asset_owners.get(a['url'], []):
                writer.writerow([owner['source_key'],owner['title'],owner['source_url'],a['url'],a.get('reason')])
    rows = []
    for r in records:
        title = html.escape(r.get('title',r.get('listing_title',r['key'])))
        rows.append('<tr><td>'+html.escape(r['group'])+'</td><td>'+html.escape(r.get('board_name',r.get('name','')))+'</td><td><a href="preview/'+r['key']+'.html">'+title+'</a></td><td>'+html.escape(r.get('published_at') or '')+'</td><td>'+html.escape(r['status'])+'</td></tr>')
    summary = f"고정 페이지 {report['saved_pages']}개 · 게시글 {report['saved_posts']}개 · 파일 {report['downloaded_assets']}개 저장 · 원본 파일 오류 {len(report['failed_assets'])}개"
    (OUT / 'index.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>해인교회 온맘 이관 자료</title><style>body{font:15px/1.6 sans-serif;margin:28px}table{border-collapse:collapse;width:100%}td,th{padding:8px;border-bottom:1px solid #ddd}input{padding:10px;width:60%}</style><h1>해인교회 온맘 이관 자료</h1><p>원문 보존용 비공개 로컬 자료입니다. 외부 영상 플레이어는 원본 링크로 보존하며 로그인 자료는 포함하지 않습니다.</p><p>'+html.escape(summary)+'</p><p><a href="content-index.csv">전체 목록 CSV</a> · <a href="unavailable-files.csv">원본 파일 오류 목록</a> · <a href="catalog.json">하위 메뉴 목록</a></p><input placeholder="제목·게시판 검색" oninput="for(const r of document.querySelectorAll(\'tbody tr\'))r.hidden=!r.textContent.toLowerCase().includes(this.value.toLowerCase())"><table><thead><tr><th>분류</th><th>게시판</th><th>제목</th><th>게시일</th><th>상태</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table></html>',encoding='utf-8')
    print('FINAL '+json.dumps({k:v for k,v in report.items() if k not in ('failed_assets','external_assets')},ensure_ascii=False),flush=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--inventory-only',action='store_true')
    parser.add_argument('--finalize-only',action='store_true')
    parser.add_argument('--assets-only',action='store_true')
    parser.add_argument('--external-assets-only',action='store_true')
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    items=catalog()
    if args.external_assets_only:
        specs=json.loads((OUT/'asset-inventory.json').read_text(encoding='utf-8'))
        specs=[a for a in specs if not (urllib.parse.urlparse(a['url']).hostname or '').endswith('.onmam.com')]
        with futures.ThreadPoolExecutor(max_workers=3) as pool:
            for n,a in enumerate(pool.map(asset,specs),1):
                if n%50==0 or n==len(specs):
                    print(f'EXTERNAL ASSETS {n}/{len(specs)}',flush=True)
        return
    if args.finalize_only:
        records=[json.loads(p.read_text(encoding='utf-8')) for p in sorted((OUT/'records').glob('*.json'))]
        assets=[json.loads(p.read_text(encoding='utf-8')) for p in sorted((OUT/'asset-records').glob('*.json'))]
        finalize(items,records,assets)
        return
    if args.assets_only:
        records=[json.loads(p.read_text(encoding='utf-8')) for p in sorted((OUT/'records').glob('*.json'))]
        specs=list({a['url']:a for r in records for a in r.get('assets',[])}.values())
        assets=[]
        with futures.ThreadPoolExecutor(max_workers=3) as pool:
            for n,a in enumerate(pool.map(asset,specs),1):
                assets.append(a)
                if n%50==0 or n==len(specs):
                    print(f'ASSETS {n}/{len(specs)}',flush=True)
        finalize(items,records,assets)
        return
    posts=inventory(items)
    if args.inventory_only:
        return
    work=[{**i,'key':'page-'+i['id']} for i in items if i['kind']=='page']+posts
    records=[]
    with futures.ThreadPoolExecutor(max_workers=3) as pool:
        for n,r in enumerate(pool.map(record,work),1):
            records.append(r)
            if n%25==0 or n==len(work):
                print(f'CONTENT {n}/{len(work)}',flush=True)
    specs=list({a['url']:a for r in records for a in r.get('assets',[])}.values())
    dump(OUT/'asset-inventory.json',specs)
    assets=[]
    with futures.ThreadPoolExecutor(max_workers=3) as pool:
        for n,a in enumerate(pool.map(asset,specs),1):
            assets.append(a)
            if n%50==0 or n==len(specs):
                print(f'ASSETS {n}/{len(specs)}',flush=True)
    finalize(items,records,assets)

if __name__=='__main__':
    main()
