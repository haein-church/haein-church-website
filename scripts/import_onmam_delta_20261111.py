"""Stage missing public records, then merge without replacing existing prepared records."""
import json, sys, shutil, subprocess
from pathlib import Path
import archive_onmam as archive
root=Path(__file__).resolve().parents[1]
stage=root/'migration/onmam/snapshots/2026-11-11-verification'
original=root/'src/data/onmam.json'
data=json.loads(original.read_text(encoding='utf-8'))
inventory=json.loads((stage/'inventory.json').read_text(encoding='utf-8'))
known={r['key'] for r in data['records']}
missing=[r for r in inventory['posts'] if r['key'] not in known]
archive.OUT=stage
records=[]
for item in missing:
    record=archive.record(item)
    if record['status']!='saved': raise RuntimeError('Cannot archive '+item['key'])
    record['assets']=[archive.asset(spec) for spec in record['assets']]
    records.append(record)
if not records:
    print('No missing records.');sys.exit(0)
(stage/'content.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records),encoding='utf-8')
target=stage/'prepared-delta.json'
subprocess.run([sys.executable,str(root/'scripts/prepare_onmam_site.py'),'--archive',str(stage),'--data-output',str(target)],check=True)
delta=json.loads(target.read_text(encoding='utf-8'))['records']
backup=root/'migration/references/2026-11-11/onmam-before-delta.json'
if not backup.exists(): shutil.copy2(original,backup)
data['records'].extend(delta)
pending=original.with_suffix('.pending.json')
pending.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
pending.replace(original)
print(json.dumps({'added':[{'key':r['key'],'title':r['title']} for r in delta],'preparedRecords':len(data['records'])},ensure_ascii=True))
