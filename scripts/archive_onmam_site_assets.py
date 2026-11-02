"""Preserve public homepage/logo/slide uploads separately from board content."""
import hashlib, json, sys, urllib.parse, urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.migration-tools'))
from bs4 import BeautifulSoup

def main():
    folder=ROOT/'migration/onmam/branding'
    folder.mkdir(parents=True,exist_ok=True)
    base='https://haein-church.onmam.com/'
    headers={'Referer':base,'User-Agent':'HaeinChurchArchive/1.0'}
    with urllib.request.urlopen(urllib.request.Request(base,headers=headers),timeout=40) as response:
        raw=response.read().decode('utf8',errors='replace')
    (folder/'homepage-original.html').write_text(raw,encoding='utf8')
    soup=BeautifulSoup(raw,'html.parser')
    urls=sorted({urllib.parse.urljoin(base,node['src']) for node in soup.select('img[src]') if '/100480/' in node['src']})
    assets=[]
    for url in urls:
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=40) as response:
                content=response.read();ctype=response.headers.get('Content-Type','')
            if not ctype.startswith('image/'):raise ValueError('Expected source image')
            sha=hashlib.sha256(content).hexdigest();suffix=Path(urllib.parse.urlparse(url).path).suffix
            path=folder/(sha[:24]+suffix)
            path.write_bytes(content)
            assets.append({'url':url,'status':'downloaded','file':path.name,'sha256':sha,'bytes':len(content),'content_type':ctype})
        except Exception as error:assets.append({'url':url,'status':'failed','reason':str(error)})
    manifest={'source':base,'captured_at':datetime.now(timezone.utc).isoformat(),'assets':assets}
    (folder/'homepage-assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'homepage_assets':len(assets),'downloaded':sum(asset['status']=='downloaded' for asset in assets),'failed':sum(asset['status']=='failed' for asset in assets)}))

if __name__=='__main__':main()
