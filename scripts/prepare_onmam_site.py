"""Build local website content from the verified archive; never upload anything."""
import json, os, re, shutil, sys
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.migration-tools'))
from bs4 import BeautifulSoup, Comment

ARCHIVE=ROOT/'migration/onmam'
ALLOWED=set('article div span p br table tbody thead tfoot tr td th colgroup col ul ol li strong b em i u s sub sup blockquote h1 h2 h3 h4 h5 h6 img figure figcaption a video audio source hr pre code dl dd dt'.split())

def main():
    with (ARCHIVE/'content.jsonl').open(encoding='utf-8') as stream:
        records=[json.loads(line) for line in stream if line.strip()]
    catalog=json.loads((ARCHIVE/'catalog.json').read_text(encoding='utf-8'))
    assets={a['url']:a for r in records for a in r.get('assets',[])}
    destination=ROOT/'public/onmam-assets'
    destination.mkdir(parents=True,exist_ok=True)
    copied=0
    for a in assets.values():
        if a.get('status')!='downloaded': continue
        source=(ARCHIVE/a['local_path']).resolve()
        if not source.is_relative_to(ARCHIVE.resolve()): raise ValueError('Unsafe asset path')
        target=destination/source.name
        if not target.exists():
            try: os.link(source,target)
            except OSError: shutil.copy2(source,target)
        copied+=1
    def link(url):
        a=assets.get(url)
        if a and a.get('status')=='downloaded': return '/onmam-assets/'+Path(a['local_path']).name
        m=re.search(r'haein-church\.onmam\.com/bbs/bbsView/(\d+)/(\d+)',url)
        if m: return f'/posts/{m[1]}/{m[2]}/'
        m=re.search(r'haein-church\.onmam\.com/bbs/viewPage/(\d+)',url)
        if m: return f'/church/{m[1]}/'
        return url
    def sanitize(value,title):
        soup=BeautifulSoup(value,'html.parser')
        for n in soup.select('script,style,form,input,button,object,embed,iframe,svg,link,meta,template'):
            n.decompose()
        for n in soup.find_all(string=lambda x:isinstance(x,Comment)): n.extract()
        for n in list(soup.find_all(True)):
            if n.name not in ALLOWED:
                n.unwrap(); continue
            before=dict(n.attrs)
            keep={}
            for attr in ('colspan','rowspan'):
                if str(before.get(attr,'')).isdigit(): keep[attr]=before[attr]
            if n.name=='a':
                href=before.get('href','')
                if href.startswith(('https://','http://','mailto:','tel:','/')):
                    keep['href']=link(href)
                    if not keep['href'].startswith('/'): keep['rel']='noopener noreferrer'
            if n.name in ('img','video','audio','source'):
                src=before.get('src','')
                a=assets.get(src)
                if a and a.get('status')=='downloaded': keep['src']=link(src)
                elif src:
                    # Do not contact a missing remote media URL from the new site.
                    n.decompose(); continue
                if n.name=='img':
                    keep.update(alt=before.get('alt') or title+' 사진',loading='lazy',decoding='async')
                elif n.name in ('video','audio'):
                    keep.update(controls='',preload='metadata')
                if before.get('poster') in assets:
                    a=assets[before['poster']]
                    if a.get('status')=='downloaded': keep['poster']=link(before['poster'])
            n.attrs=keep
        return str(soup)
    output=[]
    for r in records:
        title=r['title']
        file_items=[]
        for a in r.get('assets',[]):
            if a.get('kind')=='attachment':
                file_items.append({'name':a.get('name') or Path(a.get('local_path','file')).name,
                                   'url':link(a['url']) if a.get('status')=='downloaded' else None})
        images=[link(a['url']) for a in r.get('assets',[]) if a.get('kind')=='image' and a.get('status')=='downloaded']
        embeds=[]
        for e in r.get('embeds',[]):
            parsed=urlparse(e['url'])
            if parsed.hostname in ('www.youtube.com','youtube.com','www.youtube-nocookie.com','player.vimeo.com'):
                embeds.append(e['url'])
        output.append({'key':r['key'],'kind':r['kind'],'id':r.get('source_id',r.get('id')),
                       'boardId':r.get('board_id'),'boardName':r.get('board_name'), 'group':r['group'],
                       'title':title,'author':r.get('author'),'date':r.get('published_at'),
                       'sourceUrl':r['url'],'html':sanitize(r.get('body_html',''),title),
                       'images':images,'files':file_items,'embeds':embeds,
                       'unavailableFiles':sum(a.get('status')=='failed' for a in r.get('assets',[]))})
    data=ROOT/'src/data/onmam.json'
    data.parent.mkdir(parents=True,exist_ok=True)
    data.write_text(json.dumps({'groups':catalog['groups'],'records':output},ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'prepared_records':len(output),'linked_asset_files':copied,'publication':'local only'},ensure_ascii=True))

if __name__=='__main__': main()
