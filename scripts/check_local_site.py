"""Integration checks against the built local website, without Internet requests."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote,urlsplit

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'

class References(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls=[]; self.noindex=False
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='meta' and attrs.get('name')=='robots' and 'noindex' in attrs.get('content',''): self.noindex=True
        for key in ('href','src','poster'):
            value=attrs.get(key,'')
            if value.startswith('/') and not value.startswith('//'): self.urls.append(value)

def main():
    data=json.loads((ROOT/'src/data/onmam.json').read_text(encoding='utf-8'))
    missing_records=[]
    for r in data['records']:
        path=(DIST/'posts'/r['boardId']/r['id']/'index.html') if r['kind']=='post' else DIST/'church'/r['id']/'index.html'
        if not path.is_file(): missing_records.append(r['key'])
    missing_links=set(); indexed=[]
    pages=list(DIST.rglob('*.html'))
    for path in pages:
        parser=References(); parser.feed(path.read_text(encoding='utf-8'))
        if not parser.noindex: indexed.append(str(path.relative_to(DIST)))
        for url in parser.urls:
            target=DIST/unquote(urlsplit(url).path).lstrip('/')
            if not target.is_file() and not (target/'index.html').is_file(): missing_links.add(url)
    report={'built_pages':len(pages),'imported_records':len(data['records']),
            'missing_record_pages':missing_records,'missing_local_links':sorted(missing_links),
            'pages_without_noindex':indexed,
            'robots_disallow_all':'Disallow: /' in (DIST/'robots.txt').read_text(encoding='utf-8'),
            'header_noindex':'X-Robots-Tag: noindex' in (DIST/'_headers').read_text(encoding='utf-8')}
    target=ROOT/'migration/references/local-site-validation.json'
    target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True))
    if missing_records or missing_links or indexed or not report['robots_disallow_all'] or not report['header_noindex']: raise SystemExit(1)

if __name__=='__main__':main()
