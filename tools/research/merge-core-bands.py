"""Merge Overpass bands into research/core/data/osm-core.json (by element type and id).

    python -P tools/research/merge-core-bands.py mufu east

Each band is research/core/data/osm-core-<name>.json from tools/research/fetch-core-band.sh.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / 'research' / 'core' / 'data'
core = json.loads((DATA / 'osm-core.json').read_text(encoding='utf-8'))
els = core['elements'] if isinstance(core, dict) else core
seen = {(e['type'], e['id']) for e in els}
for name in sys.argv[1:]:
    band = json.loads((DATA / f'osm-core-{name}.json').read_text(encoding='utf-8'))['elements']
    new = [e for e in band if (e['type'], e['id']) not in seen]
    seen.update((e['type'], e['id']) for e in new)
    els += new
    print(name, len(band), 'elements,', len(new), 'new')
out = {'version': 0.6, 'generator': 'merged Overpass bands', 'elements': els} if not isinstance(core, dict) else {**core, 'elements': els}
(DATA / 'osm-core.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('osm-core.json', len(els), 'elements')
